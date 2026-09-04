import { ObjectId } from "mongodb"
import { generateCapacity } from "../../../lib/capacityCalculations"
import { connectToDatabase } from "../../../lib/mongodb"
import { authorizeReportingRead } from "../../../lib/reportingAuthentication"
import { toCanonicalCapacity } from "../../../lib/capacity/canonicalCapacityModel"

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

    /*
     * This read-only route supports either:
     * - an authorized Planning App employee session; or
     * - an approved reporting API key.
     */
    const authorization =
      await authorizeReportingRead(db, req)

    if (!authorization.authorized) {
      return res
        .status(authorization.status)
        .json({
          message: authorization.message,
        })
    }

    const {
      id,
      from: requestedFromWeek,
      to: requestedToWeek,
    } = req.query

    if (
      typeof id !== "string" ||
      !ObjectId.isValid(id)
    ) {
      return res.status(400).json({
        message: "Invalid Capacity Plan ID.",
      })
    }

    if (
      requestedFromWeek !== undefined &&
      typeof requestedFromWeek !== "string"
    ) {
      return res.status(400).json({
        message:
          "The from-week parameter is invalid.",
      })
    }

    if (
      requestedToWeek !== undefined &&
      typeof requestedToWeek !== "string"
    ) {
      return res.status(400).json({
        message:
          "The to-week parameter is invalid.",
      })
    }

    const fromWeek = normalizeWeekCode(
      requestedFromWeek || null
    )

    const toWeek = normalizeWeekCode(
      requestedToWeek || null
    )

    const capPlan = await db
      .collection("capPlans")
      .findOne({
        _id: new ObjectId(id),
      })

    if (!capPlan) {
      return res.status(404).json({
        message: "Capacity Plan not found.",
      })
    }

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
     * Earlier weeks are retained because they may
     * be needed by carry-forward calculations.
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

    const allEntries = await db
      .collection("capEntries")
      .find({
        capPlan: id,
      })
      .toArray()

    const entries = allEntries.filter((entry) => {
      const entryWeekCode =
        typeof entry.week === "string"
          ? entry.week
          : entry.week?.code

      return calculationWeekCodes.has(
        normalizeWeekCode(entryWeekCode)
      )
    })

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

    const requestedWeekCodes = new Set(
      allWeeks
        .slice(fromIndex, toIndex + 1)
        .map((week) =>
          normalizeWeekCode(week.code)
        )
    )

    const capacity =
      generatedCapacity.filter((weekly) => {
        const generatedWeekCode =
          typeof weekly.week === "string"
            ? weekly.week
            : weekly.week?.code

        return requestedWeekCodes.has(
          normalizeWeekCode(
            generatedWeekCode
          )
        )
      })

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    const range = {
      from:
        allWeeks[fromIndex]?.code || null,
      to:
        allWeeks[toIndex]?.code || null,
    }

    const canonicalContext = {
      capacityPlanId: capPlan._id,
      capacityPlanName: capPlan.name,
    }

    if (req.query.responseModel === "canonical") {
      return res.status(200).json({
        message: "Capacity generated.",
        canonicalCapacity:
          toCanonicalCapacity(
            capacity,
            canonicalContext
          ),
        range,
      })
    }

    const responseBody = {
      message: "Capacity generated.",
      capacity,
      range,
    }

    if (req.query.includeCanonical === "true") {
      responseBody.canonicalCapacity =
        toCanonicalCapacity(
          capacity,
          canonicalContext
        )
    }

    return res.status(200).json(responseBody)
  } catch (error) {
    console.error(
      "Capacity generation failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to generate capacity.",
    })
  }
}