// ============================================
// CAPACITY ENGINE — Pattern Data API
// METHODS: GET, POST, DELETE
//
// Stable pattern identity:
//   capPlan + channelKey + date
//
// channel and channelNorm are editable display
// snapshots. Legacy name-based records remain
// supported during migration.
// ============================================

import {
  ObjectId,
} from "mongodb";

import {
  connectToDatabase,
} from "../../../lib/mongodb";

import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../lib/verification";

// ============================================
// CONSTANTS
// ============================================

const ARRIVAL_TOLERANCE =
  0.1;

const DAY_KEYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

// ============================================
// GENERAL HELPERS
// ============================================

function normalizeChannelName(
  value
) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeModel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function isFiniteValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return false;
  }

  return Number.isFinite(
    Number(value)
  );
}

function parseDate(dateString) {
  if (
    typeof dateString !==
    "string"
  ) {
    return null;
  }

  const match =
    dateString.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
  ] = match;

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() !==
      month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function timeToMinutes(
  time,
  allow24 = false
) {
  if (
    typeof time !== "string"
  ) {
    return null;
  }

  const match =
    time.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

  if (
    allow24 &&
    hours === 24 &&
    minutes === 0
  ) {
    return 24 * 60;
  }

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    hours * 60 +
    minutes
  );
}

function minutesToTime(
  totalMinutes
) {
  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    minutes
  ).padStart(
    2,
    "0"
  )}`;
}

/*
 * Uses the same exclusive-end convention
 * as Capacity Engine v4.
 *
 * Example:
 *   09:00–18:00 at 30 minutes
 *   ends with 17:30.
 */
function generateIntervals(
  startTime,
  endTime,
  intervalMinutes
) {
  const startMinutes =
    timeToMinutes(
      startTime,
      false
    );

  const endMinutes =
    timeToMinutes(
      endTime,
      true
    );

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <=
      startMinutes
  ) {
    return null;
  }

  const intervals = [];

  for (
    let minute =
      startMinutes;
    minute < endMinutes;
    minute +=
      intervalMinutes
  ) {
    intervals.push(
      minutesToTime(
        minute
      )
    );
  }

  return intervals;
}

function buildCapPlanFilter(
  capPlanId
) {
  if (
    ObjectId.isValid(
      capPlanId
    )
  ) {
    return {
      $or: [
        {
          _id:
            new ObjectId(
              capPlanId
            ),
        },
        {
          _id: capPlanId,
        },
      ],
    };
  }

  return {
    _id: capPlanId,
  };
}

/*
 * Resolve a configured channel.
 *
 * Stable key takes priority. Display-name
 * matching exists only for compatibility
 * with older clients.
 */
function resolveConfiguredChannel({
  engineChannels,
  channelKey,
  channelName,
}) {
  const requestedKey =
    String(
      channelKey || ""
    ).trim();

  if (requestedKey) {
    const config =
      engineChannels?.[
        requestedKey
      ];

    if (!config) {
      return null;
    }

    return {
      key: requestedKey,
      config,
    };
  }

  const requestedName =
    normalizeChannelName(
      channelName
    );

  if (!requestedName) {
    return null;
  }

  const matches =
    Object.entries(
      engineChannels || {}
    ).filter(
      ([, config]) =>
        normalizeChannelName(
          config?.name
        ) ===
        requestedName
    );

  /*
   * Duplicate display names are ambiguous.
   */
  if (matches.length !== 1) {
    return null;
  }

  const [
    key,
    config,
  ] = matches[0];

  return {
    key,
    config,
  };
}

function buildChannelQueryFilter({
  queryChannelKey,
  queryChannel,
  engineChannels,
}) {
  const requestedKey =
    String(
      queryChannelKey || ""
    ).trim();

  if (requestedKey) {
    const config =
      engineChannels?.[
        requestedKey
      ];

    if (!config) {
      return {
        channelKey:
          requestedKey,
      };
    }

    return {
      $or: [
        {
          channelKey:
            requestedKey,
        },
        {
          channelKey: {
            $exists: false,
          },
          channelNorm:
            normalizeChannelName(
              config?.name
            ),
        },
      ],
    };
  }

  const requestedName =
    String(
      queryChannel || ""
    ).trim();

  if (!requestedName) {
    return null;
  }

  const resolved =
    resolveConfiguredChannel({
      engineChannels,
      channelName:
        requestedName,
    });

  if (resolved) {
    return {
      $or: [
        {
          channelKey:
            resolved.key,
        },
        {
          channelKey: {
            $exists: false,
          },
          channelNorm:
            normalizeChannelName(
              resolved.config
                ?.name
            ),
        },
      ],
    };
  }

  /*
   * Legacy fallback for an unconfigured
   * or removed display name.
   */
  return {
    channelNorm:
      normalizeChannelName(
        requestedName
      ),
  };
}

// ============================================
// LEGACY RECORD MIGRATION
// ============================================

async function findPatternIdentityConflicts({
  db,
  capPlanId,
  engineChannels,
}) {
  const conflicts = [];

  for (const [
    channelKey,
    channelConfig,
  ] of Object.entries(
    engineChannels || {}
  )) {
    const channelNorm =
      normalizeChannelName(
        channelConfig?.name
      );

    const documents =
      await db
        .collection(
          "capPatterns"
        )
        .find({
          capPlan:
            capPlanId,

          $or: [
            {
              channelKey,
            },
            {
              channelKey: {
                $exists: false,
              },
              channelNorm,
            },
          ],
        })
        .project({
          _id: 1,
          date: 1,
          channel: 1,
          channelKey: 1,
        })
        .toArray();

    const documentsByDate =
      new Map();

    documents.forEach(
      (document) => {
        const date =
          String(
            document.date ||
              ""
          );

        if (
          !documentsByDate.has(
            date
          )
        ) {
          documentsByDate.set(
            date,
            []
          );
        }

        documentsByDate
          .get(date)
          .push(document);
      }
    );

    documentsByDate.forEach(
      (
        dateDocuments,
        date
      ) => {
        if (
          dateDocuments.length >
          1
        ) {
          conflicts.push({
            channelKey,

            channel:
              channelConfig?.name ||
              channelKey,

            date,

            records:
              dateDocuments.length,

            ids:
              dateDocuments.map(
                (document) =>
                  String(
                    document._id
                  )
              ),
          });
        }
      }
    );
  }

  return conflicts;
}

async function backfillLegacyPatterns({
  db,
  capPlanId,
  engineChannels,
  username,
}) {
  const summary = {
    matched: 0,
    modified: 0,
  };

  for (const [
    channelKey,
    channelConfig,
  ] of Object.entries(
    engineChannels || {}
  )) {
    const channelName =
      String(
        channelConfig?.name ||
          channelKey
      ).trim();

    const channelNorm =
      normalizeChannelName(
        channelName
      );

    const result =
      await db
        .collection(
          "capPatterns"
        )
        .updateMany(
          {
            capPlan:
              capPlanId,

            channelKey: {
              $exists: false,
            },

            channelNorm,
          },
          {
            $set: {
              channelKey,

              channel:
                channelName,

              channelNorm,

              channelIdentityUpdatedAt:
                new Date(),

              channelIdentityUpdatedBy:
                username,
            },
          }
        );

    summary.matched +=
      result.matchedCount;

    summary.modified +=
      result.modifiedCount;
  }

  return summary;
}

// ============================================
// PAYLOAD VALIDATION
// ============================================

function validatePatternPayload({
  payload,
  capPlan,
}) {
  const errors = [];
  const warnings = [];
  const days = [];
  const sanitizedPayload = [];

  const intervalMinutes =
    Number(
      capPlan?.engineInterval
    );

  const engineChannels =
    capPlan?.engineChannels;

  if (
    !Number.isInteger(
      intervalMinutes
    ) ||
    intervalMinutes <= 0
  ) {
    errors.push({
      code:
        "INVALID_ENGINE_INTERVAL",

      message:
        "The capacity plan does not have a valid engine interval.",
    });

    return {
      valid: false,
      errors,
      warnings,
      days,
      sanitizedPayload,
    };
  }

  if (
    !engineChannels ||
    typeof engineChannels !==
      "object" ||
    Array.isArray(
      engineChannels
    ) ||
    Object.keys(
      engineChannels
    ).length === 0
  ) {
    errors.push({
      code:
        "MISSING_ENGINE_CHANNELS",

      message:
        "The capacity plan does not have channel configuration.",
    });

    return {
      valid: false,
      errors,
      warnings,
      days,
      sanitizedPayload,
    };
  }

  const payloadKeys =
    new Set();

  payload.forEach(
    (
      item,
      itemIndex
    ) => {
      const submittedChannelKey =
        typeof item?.channelKey ===
        "string"
          ? item.channelKey.trim()
          : "";

      const submittedChannelName =
        typeof item?.channel ===
        "string"
          ? item.channel.trim()
          : "";

      const dateString =
        typeof item?.date ===
        "string"
          ? item.date.trim()
          : "";

      const resolvedChannel =
        resolveConfiguredChannel({
          engineChannels,

          channelKey:
            submittedChannelKey,

          channelName:
            submittedChannelName,
        });

      const context = {
        itemIndex,

        channelKey:
          submittedChannelKey ||
          null,

        channel:
          submittedChannelName ||
          null,

        date:
          dateString ||
          null,
      };

      if (!resolvedChannel) {
        errors.push({
          ...context,

          code:
            "UNKNOWN_CHANNEL",

          message:
            submittedChannelKey
              ? `Channel key "${submittedChannelKey}" is not configured in this capacity plan.`
              : `Channel "${submittedChannelName}" does not match exactly one configured channel.`,
        });

        return;
      }

      const channelKey =
        resolvedChannel.key;

      const channelConfig =
        resolvedChannel.config;

      const channelName =
        String(
          channelConfig?.name ||
            channelKey
        ).trim();

      const channelModel =
        normalizeModel(
          channelConfig?.model
        );

      const requiresAHT =
        channelModel !== "hours";

      const canonicalContext = {
        ...context,
        channelKey,
        channel:
          channelName,
      };

      const parsedDate =
        parseDate(
          dateString
        );

      if (!parsedDate) {
        errors.push({
          ...canonicalContext,

          code:
            "INVALID_DATE",

          message:
            "Pattern date must be a valid YYYY-MM-DD date.",
        });

        return;
      }

      const payloadKey =
        `${channelKey}|${dateString}`;

      if (
        payloadKeys.has(
          payloadKey
        )
      ) {
        errors.push({
          ...canonicalContext,

          code:
            "DUPLICATE_CHANNEL_DATE",

          message:
            `The payload contains more than one record for ${channelName} on ${dateString}.`,
        });

        return;
      }

      payloadKeys.add(
        payloadKey
      );

      if (
        !Array.isArray(
          item.intervals
        )
      ) {
        errors.push({
          ...canonicalContext,

          code:
            "INVALID_INTERVALS",

          message:
            "Intervals must be an array.",
        });

        return;
      }

      const dayKey =
        DAY_KEYS[
          parsedDate.getUTCDay()
        ];

      const hoop =
        channelConfig?.hoop?.[
          dayKey
        ];

      if (!hoop) {
        errors.push({
          ...canonicalContext,

          code:
            "MISSING_HOOP",

          message:
            `No HOOP configuration was found for ${channelName} on ${dayKey}.`,
        });

        return;
      }

      const open =
        hoop.open === true;

      const startTime =
        hoop.fullDay
          ? "00:00"
          : hoop.start ||
            "08:00";

      const endTime =
        hoop.fullDay
          ? "24:00"
          : hoop.end ||
            "18:00";

      const expectedTimes =
        open
          ? generateIntervals(
              startTime,
              endTime,
              intervalMinutes
            )
          : [];

      if (
        open &&
        !expectedTimes
      ) {
        errors.push({
          ...canonicalContext,

          code:
            "INVALID_HOOP",

          message:
            `The configured HOOP ${startTime}–${endTime} is invalid for ${channelName} on ${dayKey}.`,
        });

        return;
      }

      const intervalMap =
        new Map();

      let rowHasError =
        false;

      item.intervals.forEach(
        (
          interval,
          intervalIndex
        ) => {
          const time =
            typeof interval?.time ===
            "string"
              ? interval.time.trim()
              : "";

          const rowContext = {
            ...canonicalContext,
            intervalIndex,
            time: time || null,
          };

          const timeMinutes =
            timeToMinutes(
              time,
              false
            );

          if (
            timeMinutes ===
            null
          ) {
            errors.push({
              ...rowContext,

              code:
                "INVALID_TIME",

              message:
                `Interval time "${time}" must use valid HH:mm format.`,
            });

            rowHasError =
              true;

            return;
          }

          if (
            intervalMap.has(
              time
            )
          ) {
            errors.push({
              ...rowContext,

              code:
                "DUPLICATE_TIME",

              message:
                `Time ${time} appears more than once for ${channelName} on ${dateString}.`,
            });

            rowHasError =
              true;

            return;
          }

          const arrivalValid =
            isFiniteValue(
              interval.arrivalPct
            );

          const ahtValid =
            !requiresAHT ||
            isFiniteValue(
              interval.ahtMultiplier
            );

          const shrinkageValid =
            isFiniteValue(
              interval.shrinkagePct
            );

          if (!arrivalValid) {
            errors.push({
              ...rowContext,

              code:
                "INVALID_ARRIVAL",

              message:
                channelModel === "hours"
                  ? `Hours distribution at ${time} must be numeric.`
                  : `Arrival percentage at ${time} must be numeric.`,
            });

            rowHasError = true;
          }

          if (
            requiresAHT &&
            !ahtValid
          ) {
            errors.push({
              ...rowContext,

              code:
                "INVALID_AHT",

              message:
                `AHT multiplier at ${time} must be numeric.`,
            });

            rowHasError = true;
          }

          if (!shrinkageValid) {
            errors.push({
              ...rowContext,

              code:
                "INVALID_SHRINKAGE",

              message:
                `Shrinkage at ${time} must be numeric.`,
            });

            rowHasError = true;
          }

          if (
            !arrivalValid ||
            !ahtValid ||
            !shrinkageValid
          ) {
            return;
          }

          const arrivalPct =
            Number(
              interval.arrivalPct
            );

          const ahtMultiplier =
            requiresAHT
              ? Number(
                  interval.ahtMultiplier
                )
              : null;

          const shrinkagePct =
            Number(
              interval.shrinkagePct
            );

          if (
            arrivalPct < 0 ||
            arrivalPct > 100
          ) {
            errors.push({
              ...rowContext,

              code:
                "ARRIVAL_OUT_OF_RANGE",

              message:
                channelModel === "hours"
                  ? `Hours distribution at ${time} must be between 0 and 100.`
                  : `Arrival percentage at ${time} must be between 0 and 100.`,
            });

            rowHasError = true;
          }

          if (
            requiresAHT &&
            ahtMultiplier <= 0
          ) {
            errors.push({
              ...rowContext,

              code:
                "AHT_OUT_OF_RANGE",

              message:
                `AHT multiplier at ${time} must be greater than 0.`,
            });

            rowHasError = true;
          }

          if (
            shrinkagePct < 0 ||
            shrinkagePct >= 100
          ) {
            errors.push({
              ...rowContext,

              code:
                "SHRINKAGE_OUT_OF_RANGE",

              message:
                `Shrinkage at ${time} must be at least 0 and below 100.`,
            });

            rowHasError = true;
          }

          if (
            requiresAHT &&
            (
              ahtMultiplier < 0.25 ||
              ahtMultiplier > 4
            )
          ) {
            warnings.push({
              ...rowContext,

              code:
                "UNUSUAL_AHT",

              message:
                `AHT multiplier ${ahtMultiplier} at ${time} is unusually ${
                  ahtMultiplier < 0.25
                    ? "low"
                    : "high"
                }.`,
            });
          }

          if (shrinkagePct > 60) {
            warnings.push({
              ...rowContext,

              code:
                "HIGH_SHRINKAGE",

              message:
                `Shrinkage at ${time} is above 60%.`,
            });
          }

          /*
           * Hours patterns intentionally omit AHT.
           * Other models retain the AHT multiplier.
           */
          intervalMap.set(
            time,
            {
              time,

              arrivalPct,

              ...(requiresAHT
                ? {
                    ahtMultiplier,
                  }
                : {}),

              shrinkagePct,
            }
          );
        }
      );

      if (rowHasError) {
        return;
      }

      /*
       * Closed dates may be represented by an
       * empty interval array.
       */
      if (!open) {
        const positiveArrival =
          [
            ...intervalMap.values(),
          ]
            .filter(
              (interval) =>
                interval
                  .arrivalPct >
                0
            )
            .reduce(
              (
                total,
                interval
              ) =>
                total +
                interval
                  .arrivalPct,
              0
            );

        if (
          positiveArrival > 0
        ) {
          errors.push({
            ...canonicalContext,

            code:
              "VOLUME_ON_CLOSED_DAY",

            message:
              `${dateString} is closed for ${channelName}, but its pattern contains ${positiveArrival.toFixed(
                2
              )}% arrival volume.`,
          });

          return;
        }

        if (
          intervalMap.size > 0
        ) {
          warnings.push({
            ...canonicalContext,

            code:
              "ZERO_ROWS_ON_CLOSED_DAY",

            message:
              `${dateString} is closed for ${channelName}. Zero-value interval rows will be stored.`,
          });
        }

        sanitizedPayload.push({
          channelKey,

          channel:
            channelName,

          channelNorm:
            normalizeChannelName(
              channelName
            ),

          date:
            dateString,

          intervals: [
            ...intervalMap.values(),
          ].sort(
            (a, b) =>
              a.time.localeCompare(
                b.time
              )
          ),
        });

        days.push({
          channelKey,

          channel:
            channelName,

          model:
            channelModel,

          requiresAHT,

          date:
            dateString,

          dayName:
            dayKey,

          open: false,

          arrivalTotal: 0,

          intervalCount:
            intervalMap.size,

          expectedIntervalCount:
            0,

          valid: true,
        });

        return;
      }

      const expectedSet =
        new Set(
          expectedTimes
        );

      const actualTimes = [
        ...intervalMap.keys(),
      ];

      const missingTimes =
        expectedTimes.filter(
          (time) =>
            !intervalMap.has(
              time
            )
        );

      const unexpectedTimes =
        actualTimes.filter(
          (time) =>
            !expectedSet.has(
              time
            )
        );

      const errorCountBefore =
        errors.length;

      if (
        missingTimes.length >
        0
      ) {
        errors.push({
          ...canonicalContext,

          code:
            "MISSING_INTERVALS",

          message:
            `${dateString} is missing ${missingTimes.length} expected interval(s): ${missingTimes.join(
              ", "
            )}.`,

          times:
            missingTimes,
        });
      }

      if (
        unexpectedTimes.length >
        0
      ) {
        errors.push({
          ...canonicalContext,

          code:
            "OUTSIDE_HOOP",

          message:
            `${dateString} contains interval(s) outside ${startTime}–${endTime}: ${unexpectedTimes.join(
              ", "
            )}.`,

          times:
            unexpectedTimes,
        });
      }

      const arrivalTotal =
        [
          ...intervalMap.values(),
        ]
          .filter(
            (interval) =>
              expectedSet.has(
                interval.time
              )
          )
          .reduce(
            (
              total,
              interval
            ) =>
              total +
              interval
                .arrivalPct,
            0
          );

      const arrivalDifference =
        Math.abs(
          arrivalTotal - 100
        );

      if (
        arrivalDifference >
        ARRIVAL_TOLERANCE +
          Number.EPSILON
      ) {
        errors.push({
          ...canonicalContext,

          code:
            "ARRIVAL_TOTAL",

          message:
            `${dateString} ${
              channelModel === "hours"
                ? "hours"
                : "arrival"
            } distribution totals ${arrivalTotal.toFixed(
              4
            )}%. The accepted range is 99.90%–100.10%.`,

          arrivalTotal,
        });
      } else if (
        arrivalDifference >
        0.001
      ) {
        warnings.push({
          ...canonicalContext,

          code:
            "ARRIVAL_ROUNDING",

          message:
            `${dateString} ${
              channelModel === "hours"
                ? "hours"
                : "arrival"
            } distribution totals ${arrivalTotal.toFixed(
              4
            )}% and was accepted within tolerance.`,

          arrivalTotal,
        });
      }

      const dayIsValid =
        errors.length ===
        errorCountBefore;

      days.push({
        channelKey,

        channel:
          channelName,

        model:
          channelModel,

        requiresAHT,

        date:
          dateString,

        dayName:
          dayKey,

        open: true,

        hoop: {
          start:
            startTime,

          end:
            endTime,
        },

        arrivalTotal,

        intervalCount:
          intervalMap.size,

        expectedIntervalCount:
          expectedTimes.length,

        valid:
          dayIsValid,
      });

      if (dayIsValid) {
        sanitizedPayload.push({
          channelKey,

          channel:
            channelName,

          channelNorm:
            normalizeChannelName(
              channelName
            ),

          date:
            dateString,

          intervals:
            expectedTimes.map(
              (time) =>
                intervalMap.get(
                  time
                )
            ),
        });
      }
    }
  );

  return {
    valid:
      errors.length === 0,

    intervalMinutes,

    tolerance:
      ARRIVAL_TOLERANCE,

    errors,
    warnings,
    days,
    sanitizedPayload,
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
    query = {},
    method,
    body = {},
    headers = {},
  } = req;

  const { db } =
    await connectToDatabase();

  const verification =
    headers.authorization
      ? await verifySession(
          db,
          headers.authorization
        )
      : {
          verified: false,
        };

  const capPlanId =
    String(
      query.capPlan || ""
    ).trim();

  if (!capPlanId) {
    return res.status(400).json({
      message:
        "Missing capPlan parameter",
    });
  }

  const capPlan =
    await db
      .collection(
        "capPlans"
      )
      .findOne(
        buildCapPlanFilter(
          capPlanId
        )
      );

  if (!capPlan) {
    return res.status(404).json({
      message:
        "Capacity plan not found.",
    });
  }

  const engineChannels =
    capPlan.engineChannels ||
    {};

  switch (method) {
    // ========================================
    // GET
    // ========================================

    case "GET": {
      const filter = {
        capPlan:
          capPlanId,
      };

      const channelFilter =
        buildChannelQueryFilter({
          queryChannelKey:
            query.channelKey,

          queryChannel:
            query.channel,

          engineChannels,
        });

      if (channelFilter) {
        Object.assign(
          filter,
          channelFilter
        );
      }

      if (query.date) {
        filter.date =
          query.date;
      }

      const patterns =
        await db
          .collection(
            "capPatterns"
          )
          .find(filter)
          .sort({
            date: 1,
            channel: 1,
          })
          .toArray();

      /*
       * Stable-key grouping.
       */
      const formatted = {};

      /*
       * Temporary name grouping for older
       * components during the transition.
       */
      const formattedByName =
        {};

      patterns.forEach(
        (pattern) => {
          const identity =
            pattern.channelKey ||
            pattern.channel;

          if (identity) {
            if (
              !formatted[
                identity
              ]
            ) {
              formatted[
                identity
              ] = {};
            }

            formatted[
              identity
            ][pattern.date] =
              pattern.intervals ||
              [];
          }

          if (pattern.channel) {
            if (
              !formattedByName[
                pattern.channel
              ]
            ) {
              formattedByName[
                pattern.channel
              ] = {};
            }

            formattedByName[
              pattern.channel
            ][pattern.date] =
              pattern.intervals ||
              [];
          }
        }
      );

      return res
        .status(200)
        .json({
          message:
            `Found ${patterns.length} pattern records`,

          data:
            patterns,

          formatted,

          formattedByName,
        });
    }

    // ========================================
    // POST
    // ========================================

    case "POST": {
      const allowed =
        verification.verified &&
        (await verifyPermissions(
          ROLES.MANAGER,
          null,
          db,
          headers.authorization
        ));

      if (!allowed) {
        return res
          .status(
            verification.verified
              ? 403
              : 401
          )
          .json(
            verification
          );
      }

      if (
        !Array.isArray(
          body?.payload
        ) ||
        body.payload.length ===
          0
      ) {
        return res.status(400).json({
          message:
            "Missing non-empty payload array",
        });
      }

      if (
        !capPlan.engineEnabled ||
        !capPlan.engineChannels
      ) {
        return res.status(400).json({
          message:
            "The capacity engine is not configured for this plan.",
        });
      }

      const validation =
        validatePatternPayload({
          payload:
            body.payload,

          capPlan,
        });

      if (
        !validation.valid
      ) {
        return res.status(422).json({
          message:
            `Pattern validation failed with ${validation.errors.length} error(s).`,

          validation: {
            valid: false,

            intervalMinutes:
              validation.intervalMinutes,

            tolerance:
              validation.tolerance,

            errors:
              validation.errors,

            warnings:
              validation.warnings,

            days:
              validation.days,
          },
        });
      }

      const identityConflicts =
        await findPatternIdentityConflicts({
          db,
          capPlanId,
          engineChannels,
        });

      if (
        identityConflicts.length >
        0
      ) {
        return res.status(409).json({
          message:
            "Pattern records contain duplicate channel identities for the same date. Resolve these records before uploading.",

          conflicts:
            identityConflicts.slice(
              0,
              50
            ),
        });
      }

      const username =
        verification?.user
          ?.username ||
        "unknown";

      const legacyMigration =
        await backfillLegacyPatterns({
          db,
          capPlanId,
          engineChannels,
          username,
        });

      const isCopyOperation =
        body?.operation ===
        "copy";

      const copiedFromWeek =
        isCopyOperation &&
        typeof body?.copiedFromWeek ===
          "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(
          body.copiedFromWeek
        )
          ? body.copiedFromWeek
          : null;

      if (
        isCopyOperation &&
        !copiedFromWeek
      ) {
        return res.status(400).json({
          message:
            "A valid copiedFromWeek value is required for a copy operation.",
        });
      }

      const now =
        new Date();

      const bulkOps =
        validation
          .sanitizedPayload
          .map((item) => ({
            updateOne: {
              filter: {
                capPlan:
                  capPlanId,

                channelKey:
                  item.channelKey,

                date:
                  item.date,
              },

              update: {
                $set: {
                  capPlan:
                    capPlanId,

                  channelKey:
                    item.channelKey,

                  channel:
                    item.channel,

                  channelNorm:
                    item.channelNorm,

                  date:
                    item.date,

                  intervals:
                    item.intervals,

                  patternSource:
                    isCopyOperation
                      ? "copied"
                      : "uploaded",

                  copiedFromWeek:
                    isCopyOperation
                      ? copiedFromWeek
                      : null,

                  updatedAt:
                    now,

                  updatedBy:
                    username,
                },

                $setOnInsert: {
                  createdAt:
                    now,

                  createdBy:
                    username,
                },
              },

              upsert: true,
            },
          }));

      const result =
        await db
          .collection(
            "capPatterns"
          )
          .bulkWrite(
            bulkOps
          );

      return res
        .status(200)
        .json({
          message:
            `Validated and processed ${bulkOps.length} pattern record(s).`,

          data: {
            matched:
              result.matchedCount,

            upserted:
              result.upsertedCount,

            modified:
              result.modifiedCount,

            legacyMigration,
          },

          validation: {
            valid: true,

            intervalMinutes:
              validation.intervalMinutes,

            tolerance:
              validation.tolerance,

            errors: [],

            warnings:
              validation.warnings,

            days:
              validation.days,
          },
        });
    }

    // ========================================
    // DELETE
    // ========================================

    case "DELETE": {
      const allowed =
        verification.verified &&
        (await verifyPermissions(
          ROLES.MANAGER,
          null,
          db,
          headers.authorization
        ));

      if (!allowed) {
        return res
          .status(
            verification.verified
              ? 403
              : 401
          )
          .json(
            verification
          );
      }

      const deleteFilter = {
        capPlan:
          capPlanId,
      };

      const channelFilter =
        buildChannelQueryFilter({
          queryChannelKey:
            query.channelKey,

          queryChannel:
            query.channel,

          engineChannels,
        });

      if (channelFilter) {
        Object.assign(
          deleteFilter,
          channelFilter
        );
      }

      if (query.date) {
        deleteFilter.date =
          query.date;
      }

      const result =
        await db
          .collection(
            "capPatterns"
          )
          .deleteMany(
            deleteFilter
          );

      return res
        .status(200)
        .json({
          message:
            `Deleted ${result.deletedCount} pattern records`,

          data:
            result,
        });
    }

    // ========================================
    // UNSUPPORTED METHOD
    // ========================================

    default: {
      res.setHeader(
        "Allow",
        [
          "GET",
          "POST",
          "DELETE",
        ]
      );

      return res
        .status(405)
        .json({
          message:
            "Method not allowed. Use GET, POST, or DELETE.",
        });
    }
  }
}