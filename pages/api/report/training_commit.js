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
      .collection("capEntries")
      .aggregate([
        {
          $match: {
            trCommit: {
              $exists: true,
              $ne: null,
            },
          },
        },
        {
          $addFields: {
            capPlanId: {
              $convert: {
                input: "$capPlan",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
          },
        },
        {
          $lookup: {
            from: "weeks",
            localField: "week",
            foreignField: "code",
            as: "weeks",
          },
        },
        {
          $lookup: {
            from: "capPlans",
            localField: "capPlanId",
            foreignField: "_id",
            as: "capPlans",
          },
        },
        {
          $addFields: {
            weekDoc: {
              $arrayElemAt: ["$weeks", 0],
            },
            capPlanDoc: {
              $arrayElemAt: ["$capPlans", 0],
            },
          },
        },
        {
          $addFields: {
            lobObjId: {
              $convert: {
                input: "$capPlanDoc.lob",
                to: "objectId",
                onError: null,
                onNull: null,
              },
            },
            languageObjId: {
              $convert: {
                input: "$capPlanDoc.language",
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
            as: "lobs",
          },
        },
        {
          $lookup: {
            from: "languages",
            localField: "languageObjId",
            foreignField: "_id",
            as: "langs",
          },
        },
        {
          $addFields: {
            lobDoc: {
              $arrayElemAt: ["$lobs", 0],
            },
            langDoc: {
              $arrayElemAt: ["$langs", 0],
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
            Lob_Name: "$lobDoc.name",
            CapPlan_Name: "$capPlanDoc.name",
            Language: "$langDoc.set",
            Start_Date: {
              $cond: {
                if: {
                  $ne: ["$weekDoc.firstDate", null],
                },
                then: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$weekDoc.firstDate",
                  },
                },
                else: null,
              },
            },
            trCommit: 1,
          },
        },
        {
          $sort: {
            Start_Date: 1,
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
      message: "Training commitment report retrieved.",
      data: output,
    })
  } catch (error) {
    console.error(
      "Training commitment report retrieval failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to retrieve the training commitment report.",
      data: null,
    })
  }
}
