import { connectToDatabase } from "../../../lib/mongodb"
import { generateCapacity } from "../../../lib/capacityCalculations"
import { ObjectId } from "mongodb"
import {
  ROLES,
  verifyPermissions,
  verifySession,
} from "../../../lib/verification"

const MAX_CAPACITY_PLANS = 100

const normalizeWeekCode = (value) => {
  if (!value || typeof value !== "string") {
    return value
  }

  const match = value.match(
    /^(\d{4})w0*(\d{1,2})$/i
  )

  if (!match) {
    return value
  }

  return `${match[1]}w${Number(match[2])}`
}

const getWeekCode = (week) => {
  if (typeof week === "string") {
    return week
  }

  return week?.code
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])

    return res.status(405).json({
      message:
        "Method not allowed. Use GET only.",
    })
  }

  try {
    const { db } = await connectToDatabase()

    const verification = await verifySession(
      db,
      req.headers.authorization
    )

    if (!verification.verified) {
      return res.status(401).json({
        message: "A valid session is required.",
      })
    }

    const hasPermission = await verifyPermissions(
      ROLES.GUEST,
      verification.user
    )

    if (!hasPermission) {
      return res.status(403).json({
        message:
          "You do not have permission to access this resource.",
      })
    }

    const selectedParameter =
      req.query.selected

    if (
      typeof selectedParameter !== "string" ||
      selectedParameter.trim() === ""
    ) {
      return res.status(400).json({
        message:
          "At least one Capacity Plan must be selected.",
      })
    }

    /*
     * Support the new comma-separated format and the
     * previous space-separated format.
     */
    const selected = [
      ...new Set(
        selectedParameter
          .split(/[,\s]+/)
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ]

    if (
      selected.length === 0 ||
      selected.length > MAX_CAPACITY_PLANS
    ) {
      return res.status(400).json({
        message:
          "The number of selected Capacity Plans is invalid.",
      })
    }

    if (
      selected.some(
        (id) => !ObjectId.isValid(id)
      )
    ) {
      return res.status(400).json({
        message:
          "One or more Capacity Plan IDs are invalid.",
      })
    }

    const fromWeek = normalizeWeekCode(
      typeof req.query.from === "string"
        ? req.query.from
        : null
    )

    const toWeek = normalizeWeekCode(
      typeof req.query.to === "string"
        ? req.query.to
        : null
    )

    const allWeeks = await db
      .collection("weeks")
      .find({})
      .sort({ firstDate: 1 })
      .toArray()

    if (allWeeks.length === 0) {
      return res.status(404).json({
        message: "No weeks were found.",
      })
    }

    const fromIndex = fromWeek
      ? allWeeks.findIndex(
          (week) =>
            normalizeWeekCode(week.code) ===
            fromWeek
        )
      : 0

    const toIndex = toWeek
      ? allWeeks.findIndex(
          (week) =>
            normalizeWeekCode(week.code) ===
            toWeek
        )
      : allWeeks.length - 1

    if (fromWeek && fromIndex === -1) {
      return res.status(400).json({
        message: `From-week not found: ${fromWeek}`,
      })
    }

    if (toWeek && toIndex === -1) {
      return res.status(400).json({
        message: `To-week not found: ${toWeek}`,
      })
    }

    if (fromIndex > toIndex) {
      return res.status(400).json({
        message:
          "The from-week must be before or equal to the to-week.",
      })
    }

    /*
     * Earlier weeks may be needed for carry-forward
     * calculations.
     */
    const calculationWeeks = allWeeks.slice(
      0,
      toIndex + 1
    )

    const calculationWeekCodes = new Set(
      calculationWeeks.map((week) =>
        normalizeWeekCode(week.code)
      )
    )

    const requestedWeekCodes = new Set(
      allWeeks
        .slice(fromIndex, toIndex + 1)
        .map((week) =>
          normalizeWeekCode(week.code)
        )
    )

    const multiple = []

    for (const capPlanId of selected) {
      const capPlan = await db
        .collection("capPlans")
        .findOne({
          _id: new ObjectId(capPlanId),
        })

      if (!capPlan) {
        continue
      }

      const allEntries = await db
        .collection("capEntries")
        .find({
          capPlan: capPlanId,
        })
        .toArray()

      const entries = allEntries.filter(
        (entry) =>
          calculationWeekCodes.has(
            normalizeWeekCode(
              getWeekCode(entry.week)
            )
          )
      )

      const generatedResult =
        await generateCapacity(
          capPlan,
          entries,
          calculationWeeks
        )

      const generatedCapacity =
        Array.isArray(generatedResult)
          ? generatedResult
          : []

      const requestedCapacity =
        generatedCapacity.filter((weekly) =>
          requestedWeekCodes.has(
            normalizeWeekCode(
              getWeekCode(weekly.week)
            )
          )
        )

      for (const weekly of requestedCapacity) {
        multiple.push({
          ...weekly,
          week: getWeekCode(weekly.week),
          capPlan: capPlan.name,
          capPlanId: capPlan._id,
          country: capPlan.country,
          Comment: null,
        })
      }
    }

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    return res.status(200).json({
      message: "Capacity generated.",
      multiple,
      range: {
        from:
          allWeeks[fromIndex]?.code || null,
        to: allWeeks[toIndex]?.code || null,
      },
    })
  } catch (error) {
    console.error(
      "Multiple capacity generation failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to generate the capacity report.",
    })
  }
}
