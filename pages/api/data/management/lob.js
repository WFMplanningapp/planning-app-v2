import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"
import { connectToDatabase } from "../../../../lib/mongodb"
import { ObjectId } from "mongodb"

/**
METHODS: POST(Add), PUT(Edit) DELETE(Remove)
PARAMS: id
BODY: payload
HEADER: authorization base 64 encoded
*/

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  //console.log(query, method, body, headers)

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  let target = query.id
  let payload = body.payload

  switch (method) {
    case "POST":

      if (verification.verified && verifyPermissions(ROLES.MANAGER,null,db,headers.authorization)) {

        let insert =
          payload && payload.name && payload.project
            ? await db.collection("lobs").insertOne({
                ...payload,
                createdAt: new Date(),
                createdBy: verification.user.username,
              })
            : { message: "Nothing to Insert" }
       // console.log("INSERT", insert)
        res
          .status(200)
          .json({ message: "Insert Completed!", verification, insert })
      } else res.status(401).json(verification)
      break
    case "PUT":

      if (verification.verified && verifyPermissions(ROLES.MANAGER,null,db,headers.authorization) && target) {

        let update =
          payload && payload.name && target
            ? await db
                .collection("lobs")
                .updateOne({ _id: ObjectId(target) }, { $set: {...payload, lastUpdated: new Date, updatedBy: verification.user.username} })
            : { message: "Nothing to Update" }

        res
          .status(200)
          .json({ message: "Update Completed!", verification, update })
      } else res.status(401).json(verification)
      break
    case "DELETE":

      if (verification.verified && verifyPermissions(ROLES.ADMIN,null,db,headers.authorization)) {

        let remove = target
          ? await db.collection("lobs").deleteOne({ _id: ObjectId(target) })
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
