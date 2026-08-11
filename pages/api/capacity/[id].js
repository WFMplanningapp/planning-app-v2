import { connectToDatabase } from "../../../lib/mongodb"
import { generateCapacity } from "../../../lib/capacityCalculations"
import { ObjectId } from "mongodb"

// HELPER //

const normalizeWeekCode = (value) => {
  if (!value || typeof value !== "string") {
    return value
  }

  const match = value.match(/^(\d{4})w0*(\d{1,2})$/i)

  if (!match) {
    return value
  }

  return `${match[1]}w${Number(match[2])}`
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      message: "Method not Allowed, use GET only",
    })
  }

const {
  id,
  from: requestedFromWeek,
  to: requestedToWeek,
} = req.query

const fromWeek = normalizeWeekCode(
  requestedFromWeek
)

const toWeek = normalizeWeekCode(
  requestedToWeek
)

  if (!id || !ObjectId.isValid(id)) {
    return res.status(400).json({
      message: "Invalid Capacity Plan ID",
    })
  }

  try {
    const { db } = await connectToDatabase()

    const capPlan = await db
      .collection("capPlans")
      .findOne({
        _id: new ObjectId(id),
      })

    if (!capPlan) {
      return res.status(404).json({
        message: "Capacity Plan not Found!",
      })
    }

    const allWeeks = await db
      .collection("weeks")
      .find({})
      .sort({ firstDate: 1 })
      .toArray()

    if (!allWeeks.length) {
      return res.status(404).json({
        message: "No weeks were found",
      })
    }

    const fromIndex = fromWeek
      ? allWeeks.findIndex(
          (week) =>
            normalizeWeekCode(week.code) === fromWeek
        )
      : 0

    const toIndex = toWeek
      ? allWeeks.findIndex(
          (week) =>
            normalizeWeekCode(week.code) === toWeek
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
          "The from-week must be before or equal to the to-week",
      })
    }

    /*
     * Keep all weeks through the requested end week.
     * Earlier weeks may be required for carry-forward logic.
     */
    const calculationWeeks = allWeeks.slice(
      0,
      toIndex + 1
    )

    const calculationWeekCodes = new Set(
      calculationWeeks.map((week) => week.code)
    )

    const allEntries = await db
      .collection("capEntries")
      .find({
        capPlan: id,
      })
      .toArray()

    /*
     * Exclude entries after the requested end week.
     * Support both string and object-shaped entry.week values.
     */
    const entries = allEntries.filter((entry) => {
      const entryWeekCode =
        typeof entry.week === "string"
          ? entry.week
          : entry.week?.code

      return calculationWeekCodes.has(
        entryWeekCode
      )
    })

    const generatedCapacity = generateCapacity(
      capPlan,
      entries,
      calculationWeeks
    )

    /*
     * Filter the generated output by week code.
     * Do not use array indexes because generateCapacity may
     * begin at the Capacity Plan's first week rather than at
     * the first week in the global weeks collection.
     */
    const requestedWeekCodes = new Set(
      allWeeks
        .slice(fromIndex, toIndex + 1)
        .map((week) => week.code)
    )

    const capacity = generatedCapacity.filter(
      (weekly) => {
        const generatedWeekCode =
          typeof weekly.week === "string"
            ? weekly.week
            : weekly.week?.code

        return requestedWeekCodes.has(
          generatedWeekCode
        )
      }
    )

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    return res.status(200).json({
      message: "Capacity Generated",
      capacity,
      range: {
        from: allWeeks[fromIndex]?.code || null,
        to: allWeeks[toIndex]?.code || null,
      },
      diagnostics: {
        endpointVersion:
          "week-code-filter-v2",
        calculationWeekCount:
          calculationWeeks.length,
        generatedWeekCount:
          generatedCapacity.length,
        returnedWeekCount:
          capacity.length,
      },
    })
  } catch (error) {
    console.error(
      "Capacity generation failed:",
      error
    )

    return res.status(500).json({
      message: "Something went wrong",
      error:
        error instanceof Error
          ? error.message
          : String(error),
    })
  }
}