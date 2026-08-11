// ============================================
// CAPACITY ENGINE — Pattern Data API
// METHODS: GET, POST, DELETE
// Handles and validates per-channel interval patterns
// ============================================

import { ObjectId } from "mongodb";
import { connectToDatabase } from "../../../lib/mongodb";
import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../lib/verification";

const ARRIVAL_TOLERANCE = 0.1;
const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── General helpers ──

function normalizeChannelName(value) {
  return String(value || "").trim().toLowerCase();
}

function isFiniteValue(value) {
  if (value === null || value === undefined || value === "") {
    return false;
  }

  return Number.isFinite(Number(value));
}

function parseDate(dateString) {
  if (typeof dateString !== "string") return null;

  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(Date.UTC(year, month - 1, day));

  // Prevent values such as 2026-02-31 from rolling into March.
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return date;
}

function timeToMinutes(time, allow24 = false) {
  if (typeof time !== "string") return null;

  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (allow24 && hours === 24 && minutes === 0) {
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

  return hours * 60 + minutes;
}

function minutesToTime(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(
    minutes
  ).padStart(2, "0")}`;
}

// Uses the same exclusive-end convention as capacityEngineV4.
function generateIntervals(startTime, endTime, intervalMinutes) {
  const startMinutes = timeToMinutes(startTime, false);
  const endMinutes = timeToMinutes(endTime, true);

  if (
    startMinutes === null ||
    endMinutes === null ||
    endMinutes <= startMinutes
  ) {
    return null;
  }

  const intervals = [];

  for (
    let minute = startMinutes;
    minute < endMinutes;
    minute += intervalMinutes
  ) {
    intervals.push(minutesToTime(minute));
  }

  return intervals;
}

function buildCapPlanFilter(capPlanId) {
  if (ObjectId.isValid(capPlanId)) {
    return {
      $or: [
        { _id: new ObjectId(capPlanId) },
        { _id: capPlanId },
      ],
    };
  }

  return { _id: capPlanId };
}

function findChannelConfig(engineChannels, channelName) {
  const requestedName = normalizeChannelName(channelName);

  return Object.values(engineChannels || {}).find(
    (channel) =>
      normalizeChannelName(channel?.name) === requestedName
  );
}

// ── Payload validator ──

function validatePatternPayload({
  payload,
  capPlan,
}) {
  const errors = [];
  const warnings = [];
  const days = [];
  const sanitizedPayload = [];

  const intervalMinutes = Number(capPlan?.engineInterval);
  const engineChannels = capPlan?.engineChannels;

  if (
    !Number.isInteger(intervalMinutes) ||
    intervalMinutes <= 0
  ) {
    errors.push({
      code: "INVALID_ENGINE_INTERVAL",
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
    typeof engineChannels !== "object" ||
    Object.keys(engineChannels).length === 0
  ) {
    errors.push({
      code: "MISSING_ENGINE_CHANNELS",
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

  const payloadKeys = new Set();

  payload.forEach((item, itemIndex) => {
    const channel =
      typeof item?.channel === "string"
        ? item.channel.trim()
        : "";

    const dateString =
      typeof item?.date === "string"
        ? item.date.trim()
        : "";

    const context = {
      itemIndex,
      channel: channel || null,
      date: dateString || null,
    };

    if (!channel) {
      errors.push({
        ...context,
        code: "MISSING_CHANNEL",
        message: "Pattern channel is required.",
      });
      return;
    }

    const channelConfig = findChannelConfig(
      engineChannels,
      channel
    );

    if (!channelConfig) {
      errors.push({
        ...context,
        code: "UNKNOWN_CHANNEL",
        message: `Channel "${channel}" is not configured in this capacity plan.`,
      });
      return;
    }

    const parsedDate = parseDate(dateString);

    if (!parsedDate) {
      errors.push({
        ...context,
        code: "INVALID_DATE",
        message:
          "Pattern date must be a valid YYYY-MM-DD date.",
      });
      return;
    }

    const payloadKey = `${normalizeChannelName(
      channel
    )}|${dateString}`;

    if (payloadKeys.has(payloadKey)) {
      errors.push({
        ...context,
        code: "DUPLICATE_CHANNEL_DATE",
        message: `The payload contains more than one record for ${channel} on ${dateString}.`,
      });
      return;
    }

    payloadKeys.add(payloadKey);

    if (!Array.isArray(item.intervals)) {
      errors.push({
        ...context,
        code: "INVALID_INTERVALS",
        message: "Intervals must be an array.",
      });
      return;
    }

    const dayKey = DAY_KEYS[parsedDate.getUTCDay()];
    const hoop = channelConfig?.hoop?.[dayKey];

    if (!hoop) {
      errors.push({
        ...context,
        code: "MISSING_HOOP",
        message: `No HOOP configuration was found for ${dayKey}.`,
      });
      return;
    }

    const open = hoop.open === true;

    const startTime = hoop.fullDay
      ? "00:00"
      : hoop.start || "08:00";

    const endTime = hoop.fullDay
      ? "24:00"
      : hoop.end || "18:00";

    const expectedTimes = open
      ? generateIntervals(
          startTime,
          endTime,
          intervalMinutes
        )
      : [];

    if (open && !expectedTimes) {
      errors.push({
        ...context,
        code: "INVALID_HOOP",
        message: `The configured HOOP ${startTime}–${endTime} is invalid for ${dayKey}.`,
      });
      return;
    }

    const intervalMap = new Map();
    let rowHasError = false;

    item.intervals.forEach((interval, intervalIndex) => {
      const rowContext = {
        ...context,
        intervalIndex,
        time: interval?.time || null,
      };

      const time =
        typeof interval?.time === "string"
          ? interval.time.trim()
          : "";

      const timeMinutes = timeToMinutes(time, false);

      if (timeMinutes === null) {
        errors.push({
          ...rowContext,
          code: "INVALID_TIME",
          message: `Interval time "${time}" must use valid HH:mm format.`,
        });
        rowHasError = true;
        return;
      }

      if (intervalMap.has(time)) {
        errors.push({
          ...rowContext,
          code: "DUPLICATE_TIME",
          message: `Time ${time} appears more than once for ${dateString}.`,
        });
        rowHasError = true;
        return;
      }

      const arrivalValid = isFiniteValue(
        interval.arrivalPct
      );
      const ahtValid = isFiniteValue(
        interval.ahtMultiplier
      );
      const shrinkageValid = isFiniteValue(
        interval.shrinkagePct
      );

      if (!arrivalValid) {
        errors.push({
          ...rowContext,
          code: "INVALID_ARRIVAL",
          message: `Arrival percentage at ${time} must be numeric.`,
        });
        rowHasError = true;
      }

      if (!ahtValid) {
        errors.push({
          ...rowContext,
          code: "INVALID_AHT",
          message: `AHT multiplier at ${time} must be numeric.`,
        });
        rowHasError = true;
      }

      if (!shrinkageValid) {
        errors.push({
          ...rowContext,
          code: "INVALID_SHRINKAGE",
          message: `Shrinkage at ${time} must be numeric.`,
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

      const arrivalPct = Number(
        interval.arrivalPct
      );

      const ahtMultiplier = Number(
        interval.ahtMultiplier
      );

      const shrinkagePct = Number(
        interval.shrinkagePct
      );

      if (arrivalPct < 0 || arrivalPct > 100) {
        errors.push({
          ...rowContext,
          code: "ARRIVAL_OUT_OF_RANGE",
          message: `Arrival percentage at ${time} must be between 0 and 100.`,
        });
        rowHasError = true;
      }

      if (ahtMultiplier <= 0) {
        errors.push({
          ...rowContext,
          code: "AHT_OUT_OF_RANGE",
          message: `AHT multiplier at ${time} must be greater than 0.`,
        });
        rowHasError = true;
      }

      if (
        shrinkagePct < 0 ||
        shrinkagePct >= 100
      ) {
        errors.push({
          ...rowContext,
          code: "SHRINKAGE_OUT_OF_RANGE",
          message: `Shrinkage at ${time} must be at least 0 and below 100.`,
        });
        rowHasError = true;
      }

      if (
        ahtMultiplier < 0.25 ||
        ahtMultiplier > 4
      ) {
        warnings.push({
          ...rowContext,
          code: "UNUSUAL_AHT",
          message: `AHT multiplier ${ahtMultiplier} at ${time} is unusually ${
            ahtMultiplier < 0.25 ? "low" : "high"
          }.`,
        });
      }

      if (shrinkagePct > 60) {
        warnings.push({
          ...rowContext,
          code: "HIGH_SHRINKAGE",
          message: `Shrinkage at ${time} is above 60%.`,
        });
      }

      intervalMap.set(time, {
        time,
        arrivalPct,
        ahtMultiplier,
        shrinkagePct,
      });
    });

    if (rowHasError) return;

    if (!open) {
      const positiveArrival = [...intervalMap.values()]
        .filter((interval) => interval.arrivalPct > 0)
        .reduce(
          (total, interval) =>
            total + interval.arrivalPct,
          0
        );

      if (positiveArrival > 0) {
        errors.push({
          ...context,
          code: "VOLUME_ON_CLOSED_DAY",
          message: `${dateString} is closed, but its pattern contains ${positiveArrival.toFixed(
            2
          )}% arrival volume.`,
        });
        return;
      }

      if (intervalMap.size > 0) {
        warnings.push({
          ...context,
          code: "ZERO_ROWS_ON_CLOSED_DAY",
          message: `${dateString} is closed. Zero-value interval rows will be stored.`,
        });
      }

      sanitizedPayload.push({
        channel: channelConfig.name,
        date: dateString,
        intervals: [...intervalMap.values()].sort(
          (a, b) => a.time.localeCompare(b.time)
        ),
      });

      days.push({
        channel: channelConfig.name,
        date: dateString,
        dayName: dayKey,
        open: false,
        arrivalTotal: 0,
        intervalCount: intervalMap.size,
        expectedIntervalCount: 0,
        valid: true,
      });

      return;
    }

    const expectedSet = new Set(expectedTimes);
    const actualTimes = [...intervalMap.keys()];

    const missingTimes = expectedTimes.filter(
      (time) => !intervalMap.has(time)
    );

    const unexpectedTimes = actualTimes.filter(
      (time) => !expectedSet.has(time)
    );

    if (missingTimes.length > 0) {
      errors.push({
        ...context,
        code: "MISSING_INTERVALS",
        message: `${dateString} is missing ${missingTimes.length} expected interval(s): ${missingTimes.join(
          ", "
        )}.`,
        times: missingTimes,
      });
    }

    if (unexpectedTimes.length > 0) {
      errors.push({
        ...context,
        code: "OUTSIDE_HOOP",
        message: `${dateString} contains interval(s) outside ${startTime}–${endTime}: ${unexpectedTimes.join(
          ", "
        )}.`,
        times: unexpectedTimes,
      });
    }

    const arrivalTotal = [...intervalMap.values()]
      .filter((interval) =>
        expectedSet.has(interval.time)
      )
      .reduce(
        (total, interval) =>
          total + interval.arrivalPct,
        0
      );

    const arrivalDifference = Math.abs(
      arrivalTotal - 100
    );

    if (
      arrivalDifference >
      ARRIVAL_TOLERANCE + Number.EPSILON
    ) {
      errors.push({
        ...context,
        code: "ARRIVAL_TOTAL",
        message: `${dateString} arrival distribution totals ${arrivalTotal.toFixed(
          4
        )}%. The accepted range is 99.90%–100.10%.`,
        arrivalTotal,
      });
    } else if (arrivalDifference > 0.001) {
      warnings.push({
        ...context,
        code: "ARRIVAL_ROUNDING",
        message: `${dateString} arrival distribution totals ${arrivalTotal.toFixed(
          4
        )}% and was accepted within tolerance.`,
        arrivalTotal,
      });
    }

    const dayErrorCount = errors.filter(
      (error) =>
        error.channel === context.channel &&
        error.date === context.date
    ).length;

    days.push({
      channel: channelConfig.name,
      date: dateString,
      dayName: dayKey,
      open: true,
      hoop: {
        start: startTime,
        end: endTime,
      },
      arrivalTotal,
      intervalCount: intervalMap.size,
      expectedIntervalCount: expectedTimes.length,
      valid: dayErrorCount === 0,
    });

    if (dayErrorCount === 0) {
      sanitizedPayload.push({
        channel: channelConfig.name,
        date: dateString,
        intervals: expectedTimes.map((time) =>
          intervalMap.get(time)
        ),
      });
    }
  });

  return {
    valid: errors.length === 0,
    intervalMinutes,
    tolerance: ARRIVAL_TOLERANCE,
    errors,
    warnings,
    days,
    sanitizedPayload,
  };
}

// ── API handler ──

export default async function handler(req, res) {
  const { query, method, body, headers } = req;
  const { db } = await connectToDatabase();

  const verification = headers.authorization
    ? await verifySession(db, headers.authorization)
    : { verified: false };

  const capPlanId = query.capPlan;

  switch (method) {
    // ── GET: Fetch patterns for a capPlan ──
    case "GET": {
      if (!capPlanId) {
        return res
          .status(400)
          .json({
            message: "Missing capPlan parameter",
          });
      }

      const filter = { capPlan: capPlanId };

      if (query.channel) {
        filter.channelNorm = normalizeChannelName(
          query.channel
        );
      }

      if (query.date) {
        filter.date = query.date;
      }

      const patterns = await db
        .collection("capPatterns")
        .find(filter)
        .sort({ date: 1, channel: 1 })
        .toArray();

      const formatted = {};

      patterns.forEach((pattern) => {
        if (!formatted[pattern.channel]) {
          formatted[pattern.channel] = {};
        }

        formatted[pattern.channel][pattern.date] =
          pattern.intervals || [];
      });

      return res.status(200).json({
        message: `Found ${patterns.length} pattern records`,
        data: patterns,
        formatted,
      });
    }

    // ── POST: Validate and bulk-upsert patterns ──
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
        return res.status(401).json(verification);
      }

      if (
        !capPlanId ||
        !Array.isArray(body?.payload) ||
        body.payload.length === 0
      ) {
        return res.status(400).json({
          message:
            "Missing capPlan or non-empty payload array",
        });
      }

      const capPlan = await db
        .collection("capPlans")
        .findOne(buildCapPlanFilter(capPlanId));

      if (!capPlan) {
        return res.status(404).json({
          message: "Capacity plan not found",
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
          payload: body.payload,
          capPlan,
        });

      if (!validation.valid) {
        return res.status(422).json({
          message: `Pattern validation failed with ${validation.errors.length} error(s).`,
          validation: {
            valid: false,
            intervalMinutes:
              validation.intervalMinutes,
            tolerance: validation.tolerance,
            errors: validation.errors,
            warnings: validation.warnings,
            days: validation.days,
          },
        });
      }

      const now = new Date();

      const isCopyOperation =
  body?.operation === "copy";

const copiedFromWeek =
  isCopyOperation &&
  typeof body?.copiedFromWeek === "string" &&
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

      const bulkOps =
        validation.sanitizedPayload.map((item) => {
          const channelNorm =
            normalizeChannelName(item.channel);

          return {
            updateOne: {
              filter: {
                capPlan: capPlanId,
                channelNorm,
                date: item.date,
              },
              update: {
                $set: {
                  capPlan: capPlanId,
                  channel: item.channel,
                  channelNorm,
                  date: item.date,
                  intervals: item.intervals,
                  patternSource: isCopyOperation
                    ? "copied"
                    : "uploaded",
                  copiedFromWeek: isCopyOperation
                    ? copiedFromWeek
                    : null,
                  updatedAt: now,
                  updatedBy:
                    verification.user.username,
                },
                $setOnInsert: {
                  createdAt: now,
                  createdBy:
                    verification.user.username,
                },
              },
              upsert: true,
            },
          };
        });

      const result = await db
        .collection("capPatterns")
        .bulkWrite(bulkOps);

      return res.status(200).json({
        message: `Validated and processed ${bulkOps.length} pattern record(s).`,
        data: {
          matched: result.matchedCount,
          upserted: result.upsertedCount,
          modified: result.modifiedCount,
        },
        validation: {
          valid: true,
          intervalMinutes:
            validation.intervalMinutes,
          tolerance: validation.tolerance,
          errors: [],
          warnings: validation.warnings,
          days: validation.days,
        },
      });
    }

    // ── DELETE: Remove patterns ──
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
        return res.status(401).json(verification);
      }

      if (!capPlanId) {
        return res.status(400).json({
          message: "Missing capPlan parameter",
        });
      }

      const deleteFilter = {
        capPlan: capPlanId,
      };

      if (query.channel) {
        deleteFilter.channelNorm =
          normalizeChannelName(query.channel);
      }

      const result = await db
        .collection("capPatterns")
        .deleteMany(deleteFilter);

      return res.status(200).json({
        message: `Deleted ${result.deletedCount} pattern records`,
        data: result,
      });
    }

    default:
      return res.status(405).json({
        message:
          "Method not allowed. Use GET, POST, or DELETE.",
      });
  }
}