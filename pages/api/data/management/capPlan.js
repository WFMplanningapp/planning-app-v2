import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"
import { connectToDatabase } from "../../../../lib/mongodb"
import { ObjectId } from "mongodb"

/**
METHODS: POST(Add), PUT(Edit) DELETE(Remove)
PARAMS: id
BODY: payload, lob
HEADER: authorization base 64 encoded
*/

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  console.log(query, method, body, headers)

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  let target = query.id
  let payload = body.payload
  let lob = body.lob
  let language = body.language

  switch (method) {
    case "POST":
      if (verification.verified && verifyPermissions(ROLES.MANAGER,null,db,headers.authorization)) {
        let insert =
          payload && payload.name && lob && language
            ? await db.collection("capPlans").insertOne({
                ...payload,
                lob: lob._id,
                language: language._id,
                createdAt: new Date(),
                createdBy: verification.user.username,
              })
            : { message: "Nothing to Insert" }
        console.log("Insert:", insert)
        if (insert.acknowledged) {
          const firstEntry = await db.collection("capEntries").insertOne({
            week: payload.firstWeek,
            capPlan: insert.insertedId.toString(),
            ocpWeeks: lob.ocpWeeks || 0,
            trWeeks: lob.trWeeks || 0,
            createdAt: new Date(),
            createdBy: verification.user.username,
          })
          console.log("firstEntry:", firstEntry)
        }
        res
          .status(200)
          .json({ message: "Insert Completed!", verification, insert })
      } else res.status(401).json(verification)
      break
    case "PUT":
      if (verification.verified && verifyPermissions(ROLES.MANAGER,null,db,headers.authorization) && target) {
        console.log("WILL UPDATE", payload, language)
        let update =
          payload && target
            ? await db.collection("capPlans").updateOne(
                { _id: ObjectId(target) },
                {
                  $set: {
                    ...payload,
                    language: language._id,
                    lastUpdated: new Date(),
                    updatedBy: verification.user.username,
                  },
                }
              )
            : { message: "Nothing to Update" }
        res
          .status(200)
          .json({ message: "Update Completed!", verification, update })
      } else res.status(401).json(verification)
      break
    case "DELETE":
      if (verification.verified && verifyPermissions(ROLES.ADMIN,null,db,headers.authorization)) {
        let remove = target
          ? await db.collection("capPlans").deleteOne({ _id: ObjectId(target) })
          : { message: "Nothing to Remove" }
        res
          .status(200)
          .json({ message: "Remove Completed!", verification, remove })
      } else res.status(401).json(verification)
      break

    default:
      res
        .status(405)
        .json({ message: "Method not Allowed, use POST, PUT or DELETE only" })
  }
}
