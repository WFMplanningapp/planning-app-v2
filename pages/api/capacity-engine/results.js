// ============================================
// CAPACITY ENGINE — Fetch Calculation Results
// METHOD: GET
// Returns stored interval-level results for viewing
// ============================================

import { ObjectId } from "mongodb"
import { connectToDatabase } from "../../../lib/mongodb"
import {
  ROLES,
  verifyPermissions,
  verifySession,
} from "../../../lib/verification"

const WEEK_CODE_PATTERN =
  /^\d{4}w0?\d{1,2}$/i

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
        data: null,
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
        data: null,
      })
    }

    const {
      capPlan: capPlanParameter,
      week: weekParameter,
      channel: channelParameter,
    } = req.query

    if (
      typeof capPlanParameter !== "string" ||
      !ObjectId.isValid(capPlanParameter)
    ) {
      return res.status(400).json({
        message:
          "A valid capPlan parameter is required.",
        data: null,
      })
    }

    if (
      weekParameter !== undefined &&
      (typeof weekParameter !== "string" ||
        !WEEK_CODE_PATTERN.test(
          weekParameter
        ))
    ) {
      return res.status(400).json({
        message:
          "The week parameter is invalid.",
        data: null,
      })
    }

    if (
      channelParameter !== undefined &&
      (typeof channelParameter !== "string" ||
        channelParameter.trim() === "" ||
        channelParameter.length > 100)
    ) {
      return res.status(400).json({
        message:
          "The channel parameter is invalid.",
        data: null,
      })
    }

    const filter = {
      capPlan: capPlanParameter,
    }

    if (weekParameter) {
      filter.week = weekParameter
    }

    const results = await db
      .collection(
        "capCalculationResults"
      )
      .find(filter)
      .sort({ week: 1 })
      .toArray()

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    if (channelParameter) {
      const requestedChannel =
        channelParameter.trim().toLowerCase()

      const filtered = results
        .map((result) => {
          const channelKey = Object.keys(
            result.channelResults || {}
          ).find(
            (key) =>
              key.toLowerCase() ===
              requestedChannel
          )

          if (!channelKey) {
            return null
          }

          const channelWeeklyFTE =
            result.channelWeeklyFTE?.[
              channelKey
            ] ?? null

          return {
            week: result.week,
            weekDates:
              result.weekDates,
            engineVersion:
              result.engineVersion,
            calculationConfig:
              result.calculationConfig,
            channelResults: {
              [channelKey]:
                result.channelResults[
                  channelKey
                ],
            },
            channelWeeklyFTE: {
              [channelKey]:
                channelWeeklyFTE,
            },
            combinedWeeklyFTE:
              channelWeeklyFTE,
            shrinkageSummary:
              result.shrinkageSummary ||
              null,
            blendingPlan:
              result.blendingPlan || null,
            blendingSummary:
              result.blendingSummary ||
              null,
            calculatedAt:
              result.calculatedAt,
            calculatedBy:
              result.calculatedBy,
          }
        })
        .filter(Boolean)

      return res.status(200).json({
        message: `Found ${filtered.length} result(s) for the requested channel.`,
        data: filtered,
      })
    }

    return res.status(200).json({
      message: `Found ${results.length} calculation result(s).`,
      data: results,
    })
  } catch (error) {
    console.error(
      "Calculation-result retrieval failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to retrieve calculation results.",
      data: null,
    })
  }
}