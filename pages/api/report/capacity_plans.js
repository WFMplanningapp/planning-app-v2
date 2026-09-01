import { connectToDatabase } from "../../../lib/mongodb"
import {
  ROLES,
  verifyPermissions,
  verifySession,
} from "../../../lib/verification"

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"])

    return res.status(405).json({
      message: "Method not allowed. Use GET only.",
      data: null,
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
          "You do not have permission to access this report.",
        data: null,
      })
    }

    const output = await db
      .collection("capPlans")
      .aggregate([
        {
          $addFields: {
            lobObjId: {
              $convert: {
                input: "$lob",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
            languageObjId: {
              $convert: {
                input: "$language",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "lobs",
            localField: "lobObjId",
            foreignField: "_id",
            as: "lobDoc",
          },
        },
        {
          $lookup: {
            from: "languages",
            localField: "languageObjId",
            foreignField: "_id",
            as: "langDoc",
          },
        },
        {
          $addFields: {
            lobDoc: {
              $arrayElemAt: ["$lobDoc", 0],
            },
            langDoc: {
              $arrayElemAt: ["$langDoc", 0],
            },
          },
        },
        {
          $addFields: {
            projectObjId: {
              $convert: {
                input: "$lobDoc.project",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "projects",
            localField: "projectObjId",
            foreignField: "_id",
            as: "projDoc",
          },
        },
        {
          $project: {
            _id: 0,
            Project_Name: {
              $arrayElemAt: ["$projDoc.name", 0],
            },
            Project_BU: {
              $arrayElemAt: ["$projDoc.bUnit", 0],
            },
            Lob_Name: "$lobDoc.name",
            CapPlan_Name: "$name",
            Language: "$langDoc.set",
            Country: "$country",
            Operation_Days: "$operationDays",
            FTEHours_Weekly: "$fteHoursWeekly",
            Pricing_Model: "$pricingModel",
            Active: "$active",
          },
        },
        {
          $sort: {
            Project_Name: 1,
            Lob_Name: 1,
            CapPlan_Name: 1,
          },
        },
      ])
      .toArray()

    res.setHeader(
      "Cache-Control",
      "no-store, max-age=0"
    )

    return res.status(200).json({
      message: "Capacity Plan report retrieved.",
      data: output,
    })
  } catch (error) {
    console.error(
      "Capacity Plan report retrieval failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to retrieve the Capacity Plan report.",
      data: null,
    })
  }
}
