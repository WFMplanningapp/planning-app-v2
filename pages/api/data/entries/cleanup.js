import { connectToDatabase } from "../../../../lib/mongodb"
import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"

export default async function handler(req, res) {
  const { query, method, body, headers } = req

 // console.log(headers)

  let capPlan = query.capPlan

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  if (method === "DELETE") {

    if (verification.verified && verifyPermissions(ROLES.ADMIN,null,db,headers.authorization)) {

      if (query.capPlan) {
        let response = await db
          .collection("capEntries")
          .deleteMany({ capPlan: capPlan })
        res.status(200).json({
          message: `Cleaned up Database!`,
          cleaned: capPlan,
          response: response,
        })
      } else {
        res.status(200).json({
          message: `Nothing to Cleanup!`,
          data: null,
        })
      }
    } else {
      res.status(401).json(verification)
    }
  } else {
    //BAD REQUEST
    res.status(405).json({ message: "Method not Allowed, use DELETE only" })
  }
}
