// ============================================
// CAPACITY ENGINE — Calculate & Feed capEntries
// METHOD: POST
// ============================================
// Runs the Capacity Planning Engine for a
// capPlan and selected week range.
//
// Responsibilities:
//   1. Load the effective engine configuration
//   2. Load forecasts, patterns, and shrinkage
//   3. Run Capacity Engine v4
//   4. Store interval and weekly results
//   5. Feed weekly requirements into capEntries
// ============================================

import { ObjectId } from "mongodb";

import { connectToDatabase } from "../../../lib/mongodb";

import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../lib/verification";

import {
  calculateCapPlanWeek,
  CAPACITY_ENGINE_VERSION,
} from "../../../lib/engine/capacityEngineV4";

// ============================================
// GENERAL HELPERS
// ============================================

function toPositiveNumber(value) {
  const number = Number(value);

  if (
    Number.isFinite(number) &&
    number > 0
  ) {
    return number;
  }

  return null;
}

function getAuthenticatedUsername(verification) {
  return (
    verification?.user?.username ||
    verification?.username ||
    "unknown"
  );
}

function normalizeModel(model) {
  return String(model || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function validateBlendingPlan(
  rawPlan,
  channelsConfig
) {
  if (
    !rawPlan ||
    typeof rawPlan !== "object" ||
    Array.isArray(rawPlan)
  ) {
    throw new Error(
      "A valid blending plan is required."
    );
  }

  const week = String(
    rawPlan.week || ""
  ).trim();

  if (!week) {
    throw new Error(
      "The blending plan must include a week."
    );
  }

  const occupancyTarget = Number(
    rawPlan.occupancyTarget
  );

  if (
    !Number.isFinite(
      occupancyTarget
    ) ||
    occupancyTarget < 70 ||
    occupancyTarget > 100
  ) {
    throw new Error(
      "The blending occupancy target must be between 70% and 100%."
    );
  }

  const rawAllocations =
    rawPlan.allocations;

  if (
    rawAllocations &&
    (
      typeof rawAllocations !==
        "object" ||
      Array.isArray(rawAllocations)
    )
  ) {
    throw new Error(
      "Blending allocations must be an object."
    );
  }

  const allocations = {};

  Object.entries(
    rawAllocations || {}
  ).forEach(
    ([
      allocationKey,
      rawHours,
    ]) => {
      const parts = String(
        allocationKey
      )
        .split(/→|->/)
        .map((part) =>
          part.trim()
        );

      if (parts.length !== 2) {
        throw new Error(
          `Invalid blending allocation: "${allocationKey}".`
        );
      }

      const [
        sourceKey,
        destinationKey,
      ] = parts;

      if (
        sourceKey ===
        destinationKey
      ) {
        throw new Error(
          "A channel cannot blend capacity into itself."
        );
      }

      const sourceConfig =
        channelsConfig?.[
          sourceKey
        ];

      const destinationConfig =
        channelsConfig?.[
          destinationKey
        ];

      if (!sourceConfig) {
        throw new Error(
          `Unknown blending source channel: "${sourceKey}".`
        );
      }

      if (!destinationConfig) {
        throw new Error(
          `Unknown blending destination channel: "${destinationKey}".`
        );
      }

      if (
        normalizeModel(
          sourceConfig.model
        ) !== "erlangc"
      ) {
        throw new Error(
          `Channel "${sourceConfig.name || sourceKey}" cannot provide blend capacity because it is not an Erlang C channel.`
        );
      }

      const hours = Number(
        rawHours
      );

      if (
        !Number.isFinite(hours) ||
        hours < 0
      ) {
        throw new Error(
          `Invalid blending hours for "${allocationKey}".`
        );
      }

      if (hours > 0) {
        allocations[
          `${sourceKey}→${destinationKey}`
        ] = hours;
      }
    }
  );

  return {
    week,
    occupancyTarget,
    allocations,
  };
}

// ============================================
// WEEK DATE HELPER
// Generates Monday–Sunday dates using UTC.
// ============================================

function getWeekDates(weekDoc) {
  if (!weekDoc?.firstDate) {
    throw new Error(
      `Week "${weekDoc?.code || "Unknown"}" does not have firstDate`
    );
  }

  let startDate;

  if (weekDoc.firstDate instanceof Date) {
    startDate = new Date(
      Date.UTC(
        weekDoc.firstDate.getUTCFullYear(),
        weekDoc.firstDate.getUTCMonth(),
        weekDoc.firstDate.getUTCDate()
      )
    );
  } else {
    const firstDateString = String(
      weekDoc.firstDate
    ).slice(0, 10);

    startDate = new Date(
      `${firstDateString}T00:00:00.000Z`
    );
  }

  if (
    Number.isNaN(startDate.getTime())
  ) {
    throw new Error(
      `Invalid firstDate for week "${weekDoc?.code || "Unknown"}": ${String(
        weekDoc.firstDate
      )}`
    );
  }

  const dates = [];

  for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
    const date = new Date(
      startDate.getTime()
    );

    date.setUTCDate(
      date.getUTCDate() + dayOffset
    );

    dates.push(
      date.toISOString().slice(0, 10)
    );
  }

  return dates;
}

// ============================================
// CONFIGURATION VALIDATION
// ============================================

function buildEffectiveConfig(capPlan) {
  const interval =
    toPositiveNumber(
      capPlan.engineInterval
    );

  const fteHours =
    toPositiveNumber(
      capPlan.fteHoursWeekly
    );

  if (!interval) {
    throw new Error(
      `Invalid or missing engineInterval in capPlan. Received: ${String(
        capPlan.engineInterval
      )}`
    );
  }

  if (!fteHours) {
    throw new Error(
      `Invalid or missing fteHoursWeekly in capPlan. Received: ${String(
        capPlan.fteHoursWeekly
      )}`
    );
  }

  if (
    !capPlan.engineChannels ||
    typeof capPlan.engineChannels !== "object" ||
    Array.isArray(capPlan.engineChannels) ||
    Object.keys(
      capPlan.engineChannels
    ).length === 0
  ) {
    throw new Error(
      "No channels are configured for this capPlan"
    );
  }

  return {
    channels: capPlan.engineChannels,
    interval,
    fteHours,
  };
}

// ============================================
// CONSTRAINT DIAGNOSTIC
// Supports Capacity Engine v4.2 output.
// ============================================

function buildConstraintAnalysis(
  channelResults
) {
  const byConstraint = {
    serviceLevel: {
      intervals: 0,
      productiveHours: 0,
    },
    abandonment: {
      intervals: 0,
      productiveHours: 0,
    },
    occupancyCap: {
      intervals: 0,
      productiveHours: 0,
    },
    minimum: {
      intervals: 0,
      productiveHours: 0,
    },
    workload: {
      intervals: 0,
      productiveHours: 0,
    },
    none: {
      intervals: 0,
      productiveHours: 0,
    },
    unknown: {
      intervals: 0,
      productiveHours: 0,
    },
  };

  let intervalCount = 0;
  let totalProductiveHours = 0;

  (channelResults || []).forEach(
    (day) => {
      (day.intervals || []).forEach(
        (interval) => {
          const constraint =
            interval.finalConstraint ||
            interval.modelConstraint ||
            "unknown";

          const productiveHours =
            Number(
              interval.hours_productive
            ) || 0;

          if (!byConstraint[constraint]) {
            byConstraint[constraint] = {
              intervals: 0,
              productiveHours: 0,
            };
          }

          intervalCount += 1;
          totalProductiveHours +=
            productiveHours;

          byConstraint[
            constraint
          ].intervals += 1;

          byConstraint[
            constraint
          ].productiveHours +=
            productiveHours;
        }
      );
    }
  );

  return {
    intervalCount,
    totalProductiveHours,
    byConstraint,
  };
}

// ============================================
// WEEKLY SHRINKAGE SUMMARY
//
// Planned:
//   Average of the daily shrinkage plan.
//
// Effective:
//   Derived from the final interval hours used
//   by the engine. This reflects interval-level
//   internal shrinkage overrides.
//
// Internal:
//   1 - productive / inCenter
//
// External:
//   1 - inCenter / gross
//
// Combined:
//   1 - productive / gross
// ============================================

function roundShrinkage(
  value,
  decimals = 4
) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return 0;
  }

  const multiplier =
    10 ** decimals;

  return (
    Math.round(
      (
        numericValue +
        Number.EPSILON
      ) * multiplier
    ) / multiplier
  );
}

function clampPercentage(value) {
  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numericValue
    )
  );
}

function calculateCombinedShrinkage(
  internal,
  external
) {
  const internalFraction =
    clampPercentage(
      internal
    ) / 100;

  const externalFraction =
    clampPercentage(
      external
    ) / 100;

  return (
    1 -
    (
      1 -
      internalFraction
    ) *
      (
        1 -
        externalFraction
      )
  ) * 100;
}

function calculatePlannedShrinkage({
  weekDates,
  weekShrinkage,
}) {
  const dates =
    Array.isArray(weekDates)
      ? weekDates
      : [];

  if (dates.length === 0) {
    return {
      internal: 0,
      external: 0,
      combined: 0,

      paid: null,
      unpaid: null,

      billable: null,
      nonBillable: null,

      classificationCoverage: {
        compensationDays: 0,
        billingDays: 0,
        totalDays: 0,
      },
    };
  }

  const totals = {
    internal: 0,
    external: 0,
    combined: 0,

    paid: 0,
    unpaid: 0,

    billable: 0,
    nonBillable: 0,
  };

  let compensationDays = 0;
  let billingDays = 0;

  dates.forEach((date) => {
    const daily =
      weekShrinkage?.[date] ||
      {};

    const internal =
      clampPercentage(
        daily.internal
      );

    const external =
      clampPercentage(
        daily.external
      );

    const suppliedCombined =
      Number(daily.combined);

    const combined =
      Number.isFinite(
        suppliedCombined
      )
        ? clampPercentage(
            suppliedCombined
          )
        : calculateCombinedShrinkage(
            internal,
            external
          );

    totals.internal += internal;
    totals.external += external;
    totals.combined += combined;

    // Compensation classification
    const suppliedPaid =
      Number(
        daily.totalPaid ??
          daily.paid
      );

    const suppliedUnpaid =
      Number(
        daily.totalUnpaid ??
          daily.unpaid
      );

    const hasCompensation =
      Number.isFinite(
        suppliedPaid
      ) &&
      Number.isFinite(
        suppliedUnpaid
      );

    if (hasCompensation) {
      totals.paid += Math.max(
        0,
        suppliedPaid
      );

      totals.unpaid += Math.max(
        0,
        suppliedUnpaid
      );

      compensationDays += 1;
    }

    // Client-billing classification
    const suppliedBillable =
      Number(
        daily.totalBillable ??
          daily.billable
      );

    const suppliedNonBillable =
      Number(
        daily.totalNonBillable ??
          daily.nonBillable
      );

    const hasBilling =
      Number.isFinite(
        suppliedBillable
      ) &&
      Number.isFinite(
        suppliedNonBillable
      );

    if (hasBilling) {
      totals.billable += Math.max(
        0,
        suppliedBillable
      );

      totals.nonBillable += Math.max(
        0,
        suppliedNonBillable
      );

      billingDays += 1;
    }
  });

  return {
    internal:
      roundShrinkage(
        totals.internal /
          dates.length
      ),

    external:
      roundShrinkage(
        totals.external /
          dates.length
      ),

    combined:
      roundShrinkage(
        totals.combined /
          dates.length
      ),

    paid:
      compensationDays > 0
        ? roundShrinkage(
            totals.paid /
              compensationDays
          )
        : null,

    unpaid:
      compensationDays > 0
        ? roundShrinkage(
            totals.unpaid /
              compensationDays
          )
        : null,

    billable:
      billingDays > 0
        ? roundShrinkage(
            totals.billable /
              billingDays
          )
        : null,

    nonBillable:
      billingDays > 0
        ? roundShrinkage(
            totals.nonBillable /
              billingDays
          )
        : null,

    classificationCoverage: {
      compensationDays,
      billingDays,
      totalDays: dates.length,
    },
  };
}

function calculateEffectiveShrinkage(
  channelResults
) {
  const hours =
    Object.values(
      channelResults || {}
    ).reduce(
      (
        accumulator,
        dailyResults
      ) => {
        (
          dailyResults || []
        ).forEach((day) => {
          (
            day?.intervals || []
          ).forEach(
            (interval) => {
              accumulator
                .productive +=
                Number(
                  interval
                    ?.hours_productive
                ) || 0;

              accumulator
                .inCenter +=
                Number(
                  interval
                    ?.hours_inCenter
                ) || 0;

              accumulator.gross +=
                Number(
                  interval
                    ?.hours_gross
                ) || 0;
            }
          );
        });

        return accumulator;
      },
      {
        productive: 0,
        inCenter: 0,
        gross: 0,
      }
    );

  const internal =
    hours.inCenter > 0
      ? (
          1 -
          hours.productive /
            hours.inCenter
        ) * 100
      : 0;

  const external =
    hours.gross > 0
      ? (
          1 -
          hours.inCenter /
            hours.gross
        ) * 100
      : 0;

  const combined =
    hours.gross > 0
      ? (
          1 -
          hours.productive /
            hours.gross
        ) * 100
      : 0;

  return {
    internal:
      roundShrinkage(
        clampPercentage(
          internal
        )
      ),

    external:
      roundShrinkage(
        clampPercentage(
          external
        )
      ),

    combined:
      roundShrinkage(
        clampPercentage(
          combined
        )
      ),

    // These values make the KPI auditable
    // and help future reporting.
    basisHours: {
      productive:
        roundShrinkage(
          hours.productive
        ),

      inCenter:
        roundShrinkage(
          hours.inCenter
        ),

      gross:
        roundShrinkage(
          hours.gross
        ),
    },
  };
}

function buildWeeklyShrinkageSummary({
  weekDates,
  weekShrinkage,
  channelResults,
}) {
  return {
    planned:
      calculatePlannedShrinkage({
        weekDates,
        weekShrinkage,
      }),

    effective:
      calculateEffectiveShrinkage(
        channelResults
      ),

    calculationMethod: {
      planned:
        "average-daily-rate",

      effective:
        "final-engine-hours-ratio",

      internal:
        "1-productivity-hours-divided-by-incenter-hours",

      external:
        "1-incenter-hours-divided-by-gross-hours",

      combined:
        "1-productive-hours-divided-by-gross-hours",

      compensation:
        "planned-daily-item-classification",

      billing:
        "planned-daily-item-classification",
    },
  };
}

// ============================================
// API HANDLER
// ============================================

export default async function handler(
  req,
  res
) {
  const {
    method,
    body = {},
    headers = {},
  } = req;

  if (method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      message:
        "Method not allowed. Use POST only.",
    });
  }

  const { db } =
    await connectToDatabase();

  const authorization =
    headers.authorization;

  const verification = authorization
    ? await verifySession(
        db,
        authorization
      )
    : {
        verified: false,
        message:
          "Authorization header is missing",
      };

  if (!verification.verified) {
    return res.status(401).json(
      verification
    );
  }

  const hasPermission =
    await verifyPermissions(
      ROLES.MANAGER,
      null,
      db,
      authorization
    );

  if (!hasPermission) {
    return res.status(403).json({
      message:
        "You do not have permission to run the Capacity Planning Engine.",
    });
  }

const capPlanId = body.capPlan;
const weekCodes = body.weeks;

// Optional week-specific blending commands.
const submittedBlendingPlan =
  body.blendingPlan || null;

const clearBlendingWeek =
  body.clearBlendingWeek
    ? String(
        body.clearBlendingWeek
      ).trim()
    : null;

    if (
  submittedBlendingPlan &&
  clearBlendingWeek
) {
  return res.status(400).json({
    message:
      "Submit or clear a blending plan, but not both in the same request.",
  });
}

  if (
    !capPlanId ||
    !ObjectId.isValid(capPlanId)
  ) {
    return res.status(400).json({
      message:
        "A valid capPlan identifier is required.",
    });
  }

  if (
    !Array.isArray(weekCodes) ||
    weekCodes.length === 0
  ) {
    return res.status(400).json({
      message:
        "At least one week must be selected.",
    });
  }

  const normalizedWeekCodes = [
    ...new Set(
      weekCodes
        .map((week) =>
          String(week).trim()
        )
        .filter(Boolean)
    ),
  ];

  if (
    normalizedWeekCodes.length === 0
  ) {
    return res.status(400).json({
      message:
        "The weeks array does not contain valid week codes.",
    });
  }

  try {
    const calculatedBy =
      getAuthenticatedUsername(
        verification
      );

    // ========================================
    // 1. FETCH CAPPLAN AND ENGINE CONFIG
    // ========================================

    const capPlan =
      await db
        .collection("capPlans")
        .findOne({
          _id: new ObjectId(
            capPlanId
          ),
        });

    if (!capPlan) {
      return res.status(404).json({
        message: "CapPlan not found.",
      });
    }

    if (!capPlan.engineEnabled) {
      return res.status(400).json({
        message:
          "The Capacity Planning Engine is not enabled for this capPlan. Enable it in Management → CapPlans → Edit.",
      });
    }

    const config =
      buildEffectiveConfig(capPlan);

    console.log(
      "[Capacity Engine — Effective Config]",
      JSON.stringify(
        {
          engineVersion:
            CAPACITY_ENGINE_VERSION,
          capPlanId,
          intervalMinutes:
            config.interval,
          fteHoursWeekly:
            config.fteHours,
          channels:
            config.channels,
        },
        null,
        2
      )
    );
    // ========================================
    // 2. FETCH WEEK DOCUMENTS
    // ========================================

    const weekDocs =
      await db
        .collection("weeks")
        .find({
          code: {
            $in: normalizedWeekCodes,
          },
        })
        .sort({
          firstDate: 1,
        })
        .toArray();

    if (weekDocs.length === 0) {
      return res.status(404).json({
        message:
          "No matching week documents were found.",
      });
    }

    const foundWeekCodes =
      new Set(
        weekDocs.map(
          (week) => week.code
        )
      );

    const missingWeekCodes =
      normalizedWeekCodes.filter(
        (weekCode) =>
          !foundWeekCodes.has(
            weekCode
          )
      );

    if (
      missingWeekCodes.length > 0
    ) {
      return res.status(400).json({
        message:
          "Some selected weeks were not found.",
        missingWeeks:
          missingWeekCodes,
      });
    }

    // ========================================
// BLENDING PLAN PERSISTENCE
// One plan per capPlan + week.
// ========================================

const blendingCollection =
  db.collection(
    "capBlendingPlans"
  );

if (submittedBlendingPlan) {
  const validatedPlan =
    validateBlendingPlan(
      submittedBlendingPlan,
      config.channels
    );

  if (
    !normalizedWeekCodes.includes(
      validatedPlan.week
    )
  ) {
    return res.status(400).json({
      message:
        "The blending plan week must be included in the selected calculation range.",
    });
  }

  await blendingCollection.updateOne(
    {
      capPlan: capPlanId,
      week: validatedPlan.week,
    },
    {
      $set: {
        capPlan: capPlanId,
        week:
          validatedPlan.week,

        occupancyTarget:
          validatedPlan
            .occupancyTarget,

        allocations:
          validatedPlan.allocations,

        updatedAt: new Date(),
        updatedBy: calculatedBy,
      },

      $setOnInsert: {
        createdAt: new Date(),
        createdBy: calculatedBy,
      },
    },
    {
      upsert: true,
    }
  );
}

if (clearBlendingWeek) {
  if (
    !normalizedWeekCodes.includes(
      clearBlendingWeek
    )
  ) {
    return res.status(400).json({
      message:
        "The blending plan week to clear must be included in the selected calculation range.",
    });
  }

  await blendingCollection.deleteMany({
    capPlan: capPlanId,
    week: clearBlendingWeek,
  });
}

// Load the effective plans after any requested
// update or deletion.
const persistedBlendingPlans =
  await blendingCollection
    .find({
      capPlan: capPlanId,
      week: {
        $in: normalizedWeekCodes,
      },
    })
    .toArray();

const blendingPlansByWeek =
  Object.fromEntries(
    persistedBlendingPlans.map(
      (plan) => [
        plan.week,
        {
          occupancyTarget:
            plan.occupancyTarget,

          allocations:
            plan.allocations || {},
        },
      ]
    )
  );

    // ========================================
    // 3. BUILD COMPLETE DATE RANGE
    // ========================================

    const allDates = weekDocs
      .flatMap((weekDoc) =>
        getWeekDates(weekDoc)
      )
      .sort();

    const minDate = allDates[0];
    const maxDate =
      allDates[
        allDates.length - 1
      ];

    // ========================================
    // 4. FETCH FORECASTS
    // ========================================

    const forecasts =
      await db
        .collection(
          "capForecasts"
        )
        .find({
          capPlan: capPlanId,
          date: {
            $gte: minDate,
            $lte: maxDate,
          },
        })
        .toArray();

    // ========================================
    // 5. FETCH AND TRANSFORM PATTERNS
    // ========================================

    const patternsRaw =
      await db
        .collection(
          "capPatterns"
        )
        .find({
          capPlan: capPlanId,
          date: {
            $gte: minDate,
            $lte: maxDate,
          },
        })
        .toArray();

    const patterns = {};

    patternsRaw.forEach(
      (patternDocument) => {
        const channelName =
          patternDocument.channel;

        const patternDate =
          patternDocument.date;

        if (
          !channelName ||
          !patternDate
        ) {
          return;
        }

        if (
          !patterns[channelName]
        ) {
          patterns[channelName] = {};
        }

        patterns[channelName][
          patternDate
        ] = Array.isArray(
          patternDocument.intervals
        )
          ? patternDocument.intervals
          : [];
      }
    );

    // ========================================
    // 6. FETCH AND TRANSFORM SHRINKAGE
    // ========================================

    const shrinkagePlans =
      await db
        .collection(
          "capShrinkagePlans"
        )
        .find({
          capPlan: capPlanId,
          week: {
            $in:
              normalizedWeekCodes,
          },
        })
        .toArray();

    const shrinkageByDate = {};

    shrinkagePlans.forEach(
      (plan) => {
        if (
          Array.isArray(
            plan.dates
          ) &&
          plan.summary &&
          typeof plan.summary ===
            "object"
        ) {
          plan.dates.forEach(
            (date) => {
              if (
                plan.summary[date]
              ) {
                shrinkageByDate[
                  date
                ] =
                  plan.summary[
                    date
                  ];
              }
            }
          );
        }

        if (
          plan.summaryFlat &&
          typeof plan.summaryFlat ===
            "object"
        ) {
          const matchingWeek =
            weekDocs.find(
              (weekDoc) =>
                weekDoc.code ===
                plan.week
            );

          if (matchingWeek) {
            getWeekDates(
              matchingWeek
            ).forEach((date) => {
              if (
                !shrinkageByDate[
                  date
                ]
              ) {
                shrinkageByDate[
                  date
                ] =
                  plan.summaryFlat;
              }
            });
          }
        }
      }
    );

    // ========================================
    // 7. RUN ENGINE FOR EACH WEEK
    // ========================================

    const weeklyResults = [];
    const allCalculationResults =
      [];

    for (
      const weekDoc of weekDocs
    ) {
      const weekDates =
        getWeekDates(weekDoc);

      const weekDateSet =
        new Set(weekDates);

      const weekForecasts =
        forecasts.filter(
          (forecast) =>
            weekDateSet.has(
              forecast.date
            )
        );

      const weekShrinkage = {};

      weekDates.forEach(
        (date) => {
          weekShrinkage[date] =
            shrinkageByDate[
              date
            ] || {
              internal: 0,
              external: 0,
            };
        }
      );

      const result =
  calculateCapPlanWeek({
    channelsConfig:
      config.channels,

    weekDates,

    forecasts:
      weekForecasts,

    patterns,

    shrinkagePlan:
      weekShrinkage,

    intervalMinutes:
      config.interval,

    fteHours:
      config.fteHours,

    blendingPlan:
      blendingPlansByWeek[
        weekDoc.code
      ] || null,
  });

const shrinkageSummary =
  buildWeeklyShrinkageSummary({
    weekDates,

    weekShrinkage,

    channelResults:
      result.channelResults,
  });

      // ======================================
      // TEMPORARY CONSTRAINT DIAGNOSTICS
      // Can be removed after validation.
      // ======================================

      Object.entries(
        result.channelResults
      ).forEach(
        ([
          channelKey,
          days,
        ]) => {
          const analysis =
            buildConstraintAnalysis(
              days
            );

          console.log(
            "[Capacity constraint analysis]",
            {
              engineVersion:
                CAPACITY_ENGINE_VERSION,
              week:
                weekDoc.code,
              channelKey,
              ...analysis,
            }
          );
        }
      );

      const calculatedAt =
        new Date();

      const calculationDocument = {
        capPlan: capPlanId,
        week: weekDoc.code,
        weekDates,

        engineVersion:
          CAPACITY_ENGINE_VERSION,

        calculationConfig: {
          intervalMinutes:
            config.interval,

          fteHoursWeekly:
            config.fteHours,

          channelCount:
            Object.keys(
              config.channels
            ).length,

          blendingEnabled:
            Boolean(
            blendingPlansByWeek[
              weekDoc.code
            ] &&
            Object.keys(
              blendingPlansByWeek[
                weekDoc.code
              ].allocations || {}
            ).length > 0
          ),  
                },

        sourceCounts: {
          forecasts:
            weekForecasts.length,

          patterns:
            patternsRaw.filter(
              (pattern) =>
                weekDateSet.has(
                  pattern.date
                )
            ).length,

          shrinkagePlans:
            shrinkagePlans.filter(
              (plan) =>
                plan.week ===
                weekDoc.code
            ).length,
        },

        channelResults:
          result.channelResults,

       channelWeeklyFTE:
          result.channelWeeklyFTE,

        combinedWeeklyFTE:
          result.combinedWeeklyFTE,

        shrinkageSummary,

        blendingPlan:
          result.blendingPlan,

        blendingSummary:
          result.blendingSummary,

        calculatedAt,
        calculatedBy,
      };

      allCalculationResults.push(
        calculationDocument
      );

      weeklyResults.push({
        week: weekDoc.code,

        engineVersion:
          CAPACITY_ENGINE_VERSION,

        ...result.combinedWeeklyFTE,

        shrinkageSummary,
      });
    }
    // ========================================
    // 8. STORE CALCULATION RESULTS
    // Upsert one result per capPlan + week.
    // ========================================

    const resultBulkOperations =
      allCalculationResults.map(
        (calculationResult) => ({
          updateOne: {
            filter: {
              capPlan: capPlanId,
              week:
                calculationResult.week,
            },

            update: {
              $set:
                calculationResult,

              $setOnInsert: {
                createdAt:
                  new Date(),

                createdBy:
                  calculatedBy,
              },
            },

            upsert: true,
          },
        })
      );

    if (
      resultBulkOperations.length >
      0
    ) {
      await db
        .collection(
          "capCalculationResults"
        )
        .bulkWrite(
          resultBulkOperations
        );
    }

    // ========================================
    // 9. FEED WEEKLY REQUIREMENTS TO capEntries
    // ========================================

    const entryBulkOperations =
      weeklyResults.map(
        (weeklyResult) => ({
          updateOne: {
            filter: {
              capPlan: capPlanId,
              week:
                weeklyResult.week,
            },

            update: {
              $set: {
                engineGrossReq:
                  weeklyResult.grossFTE,

                engineInCenterReq:
                  weeklyResult.inCenterFTE,

                engineProductiveReq:
                  weeklyResult.productiveFTE,

                engineHoursGross:
                  weeklyResult.hours_gross,

                engineHoursInCenter:
                  weeklyResult.hours_inCenter,

                engineHoursProductive:
                  weeklyResult.hours_productive,

                // Canonical planned shrinkage represents what
                // the engine applied to the final planned hours.
                // Internal shrinkage uses interval patterns when
                // available and falls back to the daily plan.
                enginePlannedShrinkageInternal:
                  weeklyResult
                    .shrinkageSummary
                    ?.effective
                    ?.internal ?? 0,

                enginePlannedShrinkageExternal:
                  weeklyResult
                    .shrinkageSummary
                    ?.effective
                    ?.external ?? 0,

                enginePlannedShrinkageCombined:
                  weeklyResult
                    .shrinkageSummary
                    ?.effective
                    ?.combined ?? 0,

              enginePlannedShrinkagePaid:
                weeklyResult
                  .shrinkageSummary
                  ?.planned
                  ?.paid ?? null,

              enginePlannedShrinkageUnpaid:
                weeklyResult
                  .shrinkageSummary
                  ?.planned
                  ?.unpaid ?? null,

              enginePlannedShrinkageBillable:
                weeklyResult
                  .shrinkageSummary
                  ?.planned
                  ?.billable ?? null,

              enginePlannedShrinkageNonBillable:
                weeklyResult
                  .shrinkageSummary
                  ?.planned
                  ?.nonBillable ?? null,

                engineVersion:
                  CAPACITY_ENGINE_VERSION,

                engineSource:
                  "capacityEngineV4",

                engineCalculationConfig: {
                  intervalMinutes:
                    config.interval,

                  fteHoursWeekly:
                    config.fteHours,
                },

                engineCalculatedAt:
                  new Date(),

                engineCalculatedBy:
                  calculatedBy,
              },

              $unset: {
                engineEffectiveShrinkageInternal: "",
                engineEffectiveShrinkageExternal: "",
                engineEffectiveShrinkageCombined: "",
              },

              $setOnInsert: {
                capPlan: capPlanId,
                week: weeklyResult.week,
                createdAt: new Date(),
                createdBy: calculatedBy,
              },
            },

            upsert: true,
          },
        })
      );

    if (
      entryBulkOperations.length >
      0
    ) {
      await db
        .collection("capEntries")
        .bulkWrite(
          entryBulkOperations
        );
    }

    // ========================================
    // 10. RETURN CALCULATION RESULTS
    // ========================================

    return res
      .status(200)
      .json({
        message: `Calculated ${weeklyResults.length} week(s) for ${Object.keys(
          config.channels
        ).length} channel(s).`,

        engineVersion:
          CAPACITY_ENGINE_VERSION,

        calculationConfig: {
          intervalMinutes:
            config.interval,

          fteHoursWeekly:
            config.fteHours,

          channelCount:
            Object.keys(
              config.channels
            ).length,
        },

        sourceCounts: {
          forecasts:
            forecasts.length,

          patterns:
            patternsRaw.length,

          shrinkagePlans:
            shrinkagePlans.length,
        },

        weeklyResults,

        channelBreakdown:
          allCalculationResults.map(
            (result) => ({
              week:
                result.week,

              channels:
                result.channelWeeklyFTE,

              combined:
                result.combinedWeeklyFTE,

              shrinkageSummary:
                result.shrinkageSummary,

              blendingPlan:
                result.blendingPlan,

              blendingSummary:
                result.blendingSummary,
            })
          ),
      });
  } catch (error) {
    console.error(
      "[Capacity Engine — Calculation Error]",
      {
        engineVersion:
          CAPACITY_ENGINE_VERSION,

        capPlanId:
          body?.capPlan,

        weeks:
          body?.weeks,

        message:
          error?.message,

        stack:
          error?.stack,
      }
    );

    return res
      .status(500)
      .json({
        message:
          "Capacity calculation failed.",

        engineVersion:
          CAPACITY_ENGINE_VERSION,

        error:
          error?.message ||
          "Unknown calculation error",
      });
  }
}