import { createHash } from "crypto"

const COLLECTION_NAME =
  "login_rate_limits"

export const MAX_LOGIN_FAILURES = 3

export const LOGIN_LIMIT_WINDOW_SECONDS =
  900

const LOGIN_LIMIT_WINDOW_MS =
  LOGIN_LIMIT_WINDOW_SECONDS * 1000

let indexPromise = null

const ensureRateLimitIndex = async (
  db
) => {
  if (!indexPromise) {
    indexPromise = db
      .collection(COLLECTION_NAME)
      .createIndex(
        {
          expiresAt: 1,
        },
        {
          expireAfterSeconds: 0,
          name: "login_rate_limits_ttl",
        }
      )
      .catch((error) => {
        indexPromise = null
        throw error
      })
  }

  await indexPromise
}

const getHeaderValue = (value) => {
  if (Array.isArray(value)) {
    return value[0] || ""
  }

  return typeof value === "string"
    ? value
    : ""
}

const getClientIp = (req) => {
  const vercelForwardedFor =
    getHeaderValue(
      req.headers[
        "x-vercel-forwarded-for"
      ]
    )

  const forwardedFor =
    vercelForwardedFor ||
    getHeaderValue(
      req.headers["x-forwarded-for"]
    )

  if (forwardedFor) {
    return (
      forwardedFor
        .split(",")[0]
        .trim() || "unknown"
    )
  }

  const realIp = getHeaderValue(
    req.headers["x-real-ip"]
  ).trim()

  if (realIp) {
    return realIp
  }

  return (
    req.socket?.remoteAddress ||
    "unknown"
  )
}

export const createLoginRateLimitKey = (
  username,
  req
) => {
  const normalizedUsername =
    typeof username === "string"
      ? username.trim().toLowerCase()
      : ""

  const clientIp = getClientIp(req)

  /*
   * Store a hash rather than the raw
   * username and source IP.
   */
  return createHash("sha256")
    .update(
      `${normalizedUsername}\n${clientIp}`
    )
    .digest("hex")
}

export const getLoginRateLimitStatus =
  async (db, key) => {
    await ensureRateLimitIndex(db)

    const record = await db
      .collection(COLLECTION_NAME)
      .findOne(
        {
          _id: key,
        },
        {
          projection: {
            failures: 1,
            expiresAt: 1,
          },
        }
      )

    if (!record) {
      return {
        blocked: false,
        retryAfterSeconds: 0,
      }
    }

    const expiration =
      record.expiresAt instanceof Date
        ? record.expiresAt.getTime()
        : Date.parse(record.expiresAt)

    if (
      !Number.isFinite(expiration) ||
      expiration <= Date.now()
    ) {
      await db
        .collection(COLLECTION_NAME)
        .deleteOne({
          _id: key,
        })

      return {
        blocked: false,
        retryAfterSeconds: 0,
      }
    }

    const failures = Number(
      record.failures
    )

    if (
      Number.isFinite(failures) &&
      failures >= MAX_LOGIN_FAILURES
    ) {
      return {
        blocked: true,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil(
            (expiration - Date.now()) /
              1000
          )
        ),
      }
    }

    return {
      blocked: false,
      retryAfterSeconds: 0,
    }
  }

export const recordFailedLogin = async (
  db,
  key
) => {
  await ensureRateLimitIndex(db)

  const now = new Date()
  const newExpiration = new Date(
    now.getTime() +
      LOGIN_LIMIT_WINDOW_MS
  )

  /*
   * Increment within an active window.
   * If the previous window expired, begin
   * a new window with one failure.
   */
  const activeWindow = {
    $gt: ["$expiresAt", now],
  }

  await db
    .collection(COLLECTION_NAME)
    .updateOne(
      {
        _id: key,
      },
      [
        {
          $set: {
            failures: {
              $cond: [
                activeWindow,
                {
                  $add: [
                    {
                      $ifNull: [
                        "$failures",
                        0,
                      ],
                    },
                    1,
                  ],
                },
                1,
              ],
            },
            createdAt: {
              $cond: [
                activeWindow,
                {
                  $ifNull: [
                    "$createdAt",
                    now,
                  ],
                },
                now,
              ],
            },
            updatedAt: now,
            expiresAt: {
              $cond: [
                activeWindow,
                "$expiresAt",
                newExpiration,
              ],
            },
          },
        },
      ],
      {
        upsert: true,
      }
    )
}

export const clearFailedLogins = async (
  db,
  key
) => {
  await ensureRateLimitIndex(db)

  await db
    .collection(COLLECTION_NAME)
    .deleteOne({
      _id: key,
    })
}
