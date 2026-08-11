// ============================================
// CAPACITY ENGINE — Forecast Data API
// METHODS: GET, POST, DELETE
// Handles bulk forecast upload (CSV parsed client-side)
// ============================================

import { connectToDatabase } from "../../../lib/mongodb";
import { verifySession, verifyPermissions, ROLES } from "../../../lib/verification";

export default async function handler(req, res) {
  const { query, method, body, headers } = req;
  const { db } = await connectToDatabase();
  const verification = headers.authorization
  ? await verifySession(db, headers.authorization)
  : { verified: false };

  const capPlanId = query.capPlan;

  switch (method) {
    // ── GET: Fetch forecasts for a capPlan (optionally filtered by date range) ──
    case "GET": {
      if (!capPlanId) {
        return res.status(400).json({ message: "Missing capPlan parameter" });
      }

      const filter = { capPlan: capPlanId };

      if (query.fromDate) filter.date = { $gte: query.fromDate };
      if (query.toDate) {
        filter.date = filter.date || {};
        filter.date.$lte = query.toDate;
      }
      if (query.channel) {
        filter.channelNorm = query.channel.toLowerCase();
      }

      const forecasts = await db
        .collection("capForecasts")
        .find(filter)
        .sort({ date: 1, channel: 1 })
        .toArray();

      return res.status(200).json({
        message: `Found ${forecasts.length} forecast records`,
        data: forecasts,
      });
    }

    // ── POST: Bulk upsert forecasts ──
    // body.payload = [{ channel, date, volume, week }]
    case "POST": {
      if (!verification.verified || !(await verifyPermissions(ROLES.MANAGER, null, db, headers.authorization))) {
        return res.status(401).json(verification);
      }

      if (!capPlanId || !body.payload || !Array.isArray(body.payload)) {
        return res.status(400).json({ message: "Missing capPlan or payload array" });
      }

      const bulkOps = body.payload.map((item) => ({
        updateOne: {
          filter: {
            capPlan: capPlanId,
            channel: item.channel,
            date: item.date,
          },
          update: {
            $set: {
              capPlan: capPlanId,
              channel: item.channel,
              channelNorm: item.channel.toLowerCase(),
              date: item.date,
              week: item.week || null,
              volume: parseFloat(item.volume) || 0,
              updatedAt: new Date(),
              updatedBy: verification.user.username,
            },
          },
          upsert: true,
        },
      }));

      const result = await db.collection("capForecasts").bulkWrite(bulkOps);

      return res.status(200).json({
        message: `Processed ${bulkOps.length} forecast records`,
        data: {
          upserted: result.upsertedCount,
          modified: result.modifiedCount,
        },
      });
    }

    // ── DELETE: Remove forecasts for a capPlan (optionally filtered) ──
    case "DELETE": {
      if (!verification.verified || !(await verifyPermissions(ROLES.MANAGER, null, db, headers.authorization))) {
        return res.status(401).json(verification);
      }

      if (!capPlanId) {
        return res.status(400).json({ message: "Missing capPlan parameter" });
      }

      const deleteFilter = { capPlan: capPlanId };
      if (query.channel) deleteFilter.channelNorm = query.channel.toLowerCase();
      if (query.fromDate) deleteFilter.date = { $gte: query.fromDate };

      const result = await db.collection("capForecasts").deleteMany(deleteFilter);

      return res.status(200).json({
        message: `Deleted ${result.deletedCount} forecast records`,
        data: result,
      });
    }

    default:
      return res.status(405).json({ message: "Method not allowed. Use GET, POST, or DELETE." });
  }
}