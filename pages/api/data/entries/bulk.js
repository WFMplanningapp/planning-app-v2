import { connectToDatabase } from "../../../../lib/mongodb"
import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  let payloads = body.payloads

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  if (method === "POST") {

    if (verification.verified && verifyPermissions(ROLES.MANAGER,null,db,headers.authorization)) {
      if (
        payloads &&
        Array.isArray(payloads) &&
        payloads[0] &&
        payloads[0].capPlan &&
        payloads[0].week
      ) {
        let response = await db.collection("capEntries").bulkWrite(
          payloads.map((payload) => {
            //console.log("PAYLOAD:", payload)
            return {
              updateOne: {
                filter: {
                  capPlan: payload.capPlan,
                  week: payload.week,
                },
                update: {
                  $set: {
                    ...payload,
                    lastUpdated: new Date(),
                    updatedBy: verification.user.username,
                    updateType: "bulk",
                  },
                },
                upsert: true,
              },
            }
          })
        )
        res.status(200).json({
          message: `Updated Entries in Database!`,
          inserted: payloads.length,
          response: response,
        })
      } else {
        res.status(401).json({
          message: `Invalid Payload!`,
          data: null,
        })
      }
    } else {
      res.status(401).json(verification)
    }
  } else {
    //BAD REQUEST
    res.status(405).json({ message: "Method not Allowed, use POST only" })
  }
}
