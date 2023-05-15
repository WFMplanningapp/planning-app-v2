import { connectToDatabase } from "../../../lib/mongodb"
import { hashSync } from "bcrypt"
import { verifySession } from "../../../lib/verification"

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  const { client, db } = await connectToDatabase()

  let { username, password, permission } = body

  if (method === "PUT") {
    let verification = await verifySession(db, headers.authorization)

    //USER EXISTS

    if (verification.verified && verification.permission === 1) {
      

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
        } else if (!password && username && permission) {
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
        res.status(301).json({
          message: "Missing or invalid fields!",
        })
      }
    } //NOT VERIFIED
    else {
      res.status(305).json({
        message: "Unauthorized!",
      })
    }
    //BAD REQUEST
  } else {
    res.status(405).json({ message: "Method not Allowed, use PUT only" })
  }
}
