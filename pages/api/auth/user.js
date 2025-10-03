import { connectToDatabase } from "../../../lib/mongodb"
import { hashSync } from "bcryptjs"
import { verifySession, verifyPermissions, ROLES } from "../../../lib/verification"

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  const { client, db } = await connectToDatabase()

  let { username, password, permission, name, country, remove} = body
  let verification = await verifySession(db, headers.authorization)

  if (method === "PUT") {

    //USER EXISTS
  

    if (verification.verified && verifyPermissions(ROLES.SU,null,db,headers.authorization)) {
      

      if (password && password.length > 7 && username && permission) {
        let hashed = hashSync(body.password, 10)
        const options = {
          upsert: true,
        }

        db.collection("verification").updateOne(
          {
            username: username,
          },
          {
            $set: {
              username: username,
              password: hashed,
              permission: permission,
              name: name,
              country: country,
              session: {
                token: null,
                expires: 0,
              },
            },
          },
          options
        )

        res.status(200).json({
          message: "User Created!",
        })
      } else if (!password && username && permission && !remove) {
        const options = {
          upsert: true,
        }

        db.collection("verification").updateOne(
          {
            username: username,
          },
          {
            $set: {
              username: username,
              permission: permission,
              name: name,
              country: country,
              session: {
                token: null,
                expires: 0,
              },
            },
          },
          options
        )

        res.status(200).json({
          message: "User Updated!",
        })
      } else {
        res.status(422).json({
          message: "Missing or invalid fields!",
        })
      }
    } //NOT VERIFIED
    else {
      res.status(401).json({
        message: "Unauthorized!",
      })
    }
   
  } else if (method === "DELETE") {
    if (verification.verified && verifyPermissions(ROLES.SU,null,db,headers.authorization)) {
      if (username && permission && remove) {
        db.collection("verification").deleteOne({ username: username })
        res.status(200).json({
          message: "User Deleted!",
        })
      } else {
        res.status(422).json({
          message: "Missing or invalid fields!",
        })
      }
    } else { 
      res.status(401).json({
        message: "Unauthorized!",
      })
    }
  } else {
    res.status(405).json({ message: "Method not Allowed, use PUT only" })
  }
}
