import { connectToDatabase } from "../../../lib/mongodb"
import { hashSync } from "bcryptjs"
import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../lib/verification"

const VALID_PERMISSIONS = new Set([1, 2, 3, 4])

export default async function handler(req, res) {
  const { method, headers } = req

  if (!["GET", "PUT", "DELETE"].includes(method)) {
    res.setHeader("Allow", ["GET", "PUT", "DELETE"])

    return res.status(405).json({
      message:
        "Method not allowed. Use GET, PUT, or DELETE.",
    })
  }

  try {
    const { db } = await connectToDatabase()

    const verification = await verifySession(
      db,
      headers.authorization
    )

    if (!verification.verified) {
      return res.status(401).json({
        message: "A valid session is required.",
      })
    }

    const hasPermission = await verifyPermissions(
      ROLES.SU,
      verification.user
    )

    if (!hasPermission) {
      return res.status(403).json({
        message:
          "Super User permission is required.",
      })
    }

    if (method === "GET") {
      const users = await db
        .collection("verification")
        .find(
          {},
          {
            projection: {
              _id: 0,
              username: 1,
              name: 1,
              country: 1,
              permission: 1,
              "session.expires": 1,
            },
          }
        )
        .sort({ username: 1 })
        .toArray()

      return res.status(200).json({
        message: "Users retrieved.",
        data: users,
      })
    }

    const body =
      req.body &&
      typeof req.body === "object"
        ? req.body
        : {}

    let {
      username,
      password,
      permission,
      name,
      country,
      remove,
    } = body

    username =
      typeof username === "string"
        ? username.trim()
        : ""

    name =
      typeof name === "string"
        ? name.trim()
        : ""

    country =
      typeof country === "string"
        ? country.trim()
        : ""

    password =
      typeof password === "string"
        ? password
        : ""

    const numericPermission = Number(permission)

    if (method === "PUT") {
      if (
        !username ||
        !VALID_PERMISSIONS.has(numericPermission)
      ) {
        return res.status(422).json({
          message: "Missing or invalid fields.",
        })
      }

      if (password && password.length < 8) {
        return res.status(422).json({
          message:
            "Password must be at least 8 characters.",
        })
      }

      if (password) {
        const hashedPassword = hashSync(
          password,
          10
        )

        await db
          .collection("verification")
          .updateOne(
            { username },
            {
              $set: {
                username,
                password: hashedPassword,
                permission: numericPermission,
                name,
                country,
                session: {
                  token: null,
                  expires: 0,
                },
              },
            },
            { upsert: true }
          )

        return res.status(200).json({
          message: "User saved.",
        })
      }

      const existingUser = await db
        .collection("verification")
        .findOne(
          { username },
          { projection: { _id: 1 } }
        )

      if (!existingUser) {
        return res.status(422).json({
          message:
            "A password is required when creating a user.",
        })
      }

      await db
        .collection("verification")
        .updateOne(
          { username },
          {
            $set: {
              permission: numericPermission,
              name,
              country,
            },
          }
        )

      return res.status(200).json({
        message: "User updated.",
      })
    }

    if (
      method === "DELETE" &&
      username &&
      remove === true
    ) {
      const deletion = await db
        .collection("verification")
        .deleteOne({ username })

      if (deletion.deletedCount === 0) {
        return res.status(404).json({
          message: "User was not found.",
        })
      }

      return res.status(200).json({
        message: "User deleted.",
      })
    }

    return res.status(422).json({
      message: "Missing or invalid fields.",
    })
  } catch (error) {
    console.error(
      "User administration request failed:",
      error
    )

    return res.status(500).json({
      message:
        "Unable to complete the user administration request.",
    })
  }
}
