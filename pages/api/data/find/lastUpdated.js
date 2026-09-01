import { ObjectId } from "mongodb"
import { connectToDatabase } from "../../../../lib/mongodb"
import {
  ROLES,
  verifyPermissions,
  verifySession,
} from "../../../../lib/verification"

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

    const capPlan = req.query.capPlan

    if (
      typeof capPlan !== "string" ||
      !ObjectId.isValid(capPlan)
    ) {
      return res.status(400).json({
        message:
          "A valid Capacity Plan ID is required.",
        data: null,
      })
    }

    const lastUpdatedEntry = await db
      .collection("capEntries")
      .findOne(
        {
          capPlan,
          lastUpdated: {
            $exists: true,
            $ne: null,
          },
        },
        {
          projection: {
            _id: 0,
            lastUpdated: 1,
            updatedBy: 1,
            updateType: 1,
          },
          sort: {
            lastUpdated: -1,
          },
        }
      )

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    return res.status(200).json({
      message:
        "Last update information retrieved.",
      data: lastUpdatedEntry || null,
    })
  } catch (error) {
    console.error(
      "Last-update retrieval failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to retrieve last-update information.",
      data: null,
    })
  }
}
