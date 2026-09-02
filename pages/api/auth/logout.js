import { connectToDatabase } from "../../../lib/mongodb"
import { verifySession } from "../../../lib/verification"

export default async function handler(
  req,
  res
) {
  res.setHeader(
    "Cache-Control",
    "no-store, max-age=0"
  )

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"])

    return res.status(405).json({
      message:
        "Method not allowed. Use POST only.",
      logged: false,
    })
  }

  try {
    const { db } =
      await connectToDatabase()

    const verification =
      await verifySession(
        db,
        req.headers.authorization
      )

    if (
      !verification.verified ||
      !verification.user
    ) {
      return res.status(401).json({
        message:
          "A valid session is required.",
        logged: false,
      })
    }

    /*
     * Match both the user and the current token.
     * This prevents an older logout request from
     * removing a newer session created afterward.
     */
    await db
      .collection("verification")
      .updateOne(
        {
          _id: verification.user._id,
          "session.token":
            verification.user.session.token,
        },
        {
          $unset: {
            session: "",
          },
        }
      )

    return res.status(200).json({
      message: "Logout successful.",
      logged: false,
    })
  } catch (error) {
    console.error(
      "Logout processing failed:",
      error
    )

    return res.status(500).json({
      message:
        "Logout is temporarily unavailable.",
      logged: false,
    })
  }
}
