import { compare } from "bcryptjs"
import { randomBytes } from "crypto"
import { connectToDatabase } from "../../../lib/mongodb"
import {
  clearFailedLogins,
  createLoginRateLimitKey,
  getLoginRateLimitStatus,
  recordFailedLogin,
} from "../../../lib/loginRateLimit"

const SESSION_DURATION_MS =
  12 * 60 * 60 * 1000

const MAX_USERNAME_LENGTH = 254
const MAX_PASSWORD_LENGTH = 1024

/*
 * Used when the supplied username does not exist.
 * Running bcrypt in both cases reduces observable
 * timing differences between unknown users and
 * incorrect passwords.
 */
const DUMMY_PASSWORD_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"

const comparePassword = (
  password,
  passwordHash
) =>
  new Promise((resolve, reject) => {
    compare(
      password,
      passwordHash,
      (error, matches) => {
        if (error) {
          reject(error)
          return
        }

        resolve(matches)
      }
    )
  })

const sendInvalidCredentials = (res) =>
  res.status(401).json({
    message: "Credentials incorrect!",
    logged: false,
    user: null,
  })

const sendRateLimited = (
  res,
  retryAfterSeconds
) => {
  res.setHeader(
    "Retry-After",
    String(retryAfterSeconds)
  )

  return res.status(429).json({
    message:
      "Too many login attempts. Please try again later.",
    logged: false,
    user: null,
  })
}

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
      user: null,
    })
  }

  const body =
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body)
      ? req.body
      : {}

  const username =
    typeof body.username === "string"
      ? body.username.trim()
      : ""

  const password =
    typeof body.password === "string"
      ? body.password
      : ""

  if (
    !username ||
    !password ||
    username.length >
      MAX_USERNAME_LENGTH ||
    password.length >
      MAX_PASSWORD_LENGTH
  ) {
    return sendInvalidCredentials(res)
  }

  try {
    const { db } =
      await connectToDatabase()

    const rateLimitKey =
      createLoginRateLimitKey(
        username,
        req
      )

    const rateLimitStatus =
      await getLoginRateLimitStatus(
        db,
        rateLimitKey
      )

    if (rateLimitStatus.blocked) {
      return sendRateLimited(
        res,
        rateLimitStatus.retryAfterSeconds
      )
    }

    const user = await db
      .collection("verification")
      .findOne({ username })

    const passwordHash =
      user &&
      typeof user.password === "string" &&
      user.password
        ? user.password
        : DUMMY_PASSWORD_HASH

    const credentialsMatch =
      await comparePassword(
        password,
        passwordHash
      )

    if (!user || !credentialsMatch) {
      await recordFailedLogin(
        db,
        rateLimitKey
      )

      return sendInvalidCredentials(res)
    }

    /*
     * Generate a new cryptographically secure
     * token after every successful login.
     */
    const timestamp = Date.now()

    const session = {
      token: randomBytes(32).toString(
        "hex"
      ),
      expires:
        timestamp +
        SESSION_DURATION_MS,
    }

    const updateResult = await db
      .collection("verification")
      .updateOne(
        {
          _id: user._id,
        },
        {
          $set: {
            session,
          },
        }
      )

    if (updateResult.matchedCount !== 1) {
      throw new Error(
        "The login session could not be saved."
      )
    }

    await clearFailedLogins(
      db,
      rateLimitKey
    )

    return res.status(200).json({
      message: "Login successful!",
      logged: true,
      user: {
        username: user.username,
        permission: user.permission,
        session,
      },
    })
  } catch (error) {
    console.error(
      "Login processing failed:",
      error
    )

    return res.status(500).json({
      message:
        "Login is temporarily unavailable.",
      logged: false,
      user: null,
    })
  }
}
