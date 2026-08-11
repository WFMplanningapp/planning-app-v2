// ============================================
// CAPACITY ENGINE — Fetch Calculation Results
// METHOD: GET
// Returns stored interval-level results for viewing
// ============================================

import { connectToDatabase } from "../../../lib/mongodb";

export default async function handler(req, res) {
  const { query, method } = req;

  if (method !== "GET") {
    return res.status(405).json({ message: "Method not allowed. Use GET only." });
  }

  const { db } = await connectToDatabase();

  const capPlanId = query.capPlan;
  const week = query.week;
  const channel = query.channel;

  if (!capPlanId) {
    return res.status(400).json({ message: "Missing capPlan parameter" });
  }

  const filter = { capPlan: capPlanId };
  if (week) filter.week = week;

  const results = await db
    .collection("capCalculationResults")
    .find(filter)
    .sort({ week: 1 })
    .toArray();

  // If specific channel requested, filter channel results
  if (channel && results.length > 0) {
    const channelKey = Object.keys(results[0].channelResults || {}).find(
      (key) =>
        results[0].channelResults[key] &&
        key.toLowerCase() === channel.toLowerCase()
    );

    if (channelKey) {
      const filtered = results.map(
        (result) => ({
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
              result.channelWeeklyFTE[
                channelKey
              ],
          },

          combinedWeeklyFTE:
            result.channelWeeklyFTE[
              channelKey
            ],

          // The summary remains week-level because
          // it represents the complete calculated
          // capacity plan, not only one channel.
          shrinkageSummary:
            result.shrinkageSummary ||
            null,

          blendingPlan:
            result.blendingPlan ||
            null,

          blendingSummary:
            result.blendingSummary ||
            null,

          calculatedAt:
            result.calculatedAt,

          calculatedBy:
            result.calculatedBy,
        })
      );

      return res.status(200).json({
        message: `Found ${filtered.length} result(s) for channel ${channel}`,
        data: filtered,
      });
    }
  }

  return res.status(200).json({
    message: `Found ${results.length} calculation result(s)`,
    data: results,
  });
}