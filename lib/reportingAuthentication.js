import { timingSafeEqual } from "crypto"
import {
  ROLES,
  verifyPermissions,
  verifySession,
} from "./verification"

const MINIMUM_API_KEY_LENGTH = 32

const safelyMatchesKey = (
  providedKey,
  configuredKey
) => {
  if (
    typeof providedKey !== "string" ||
    typeof configuredKey !== "string" ||
    configuredKey.length <
      MINIMUM_API_KEY_LENGTH
  ) {
    return false
  }

  const providedBuffer = Buffer.from(
    providedKey,
    "utf8"
  )

  const configuredBuffer = Buffer.from(
    configuredKey,
    "utf8"
  )

  if (
    providedBuffer.length !==
    configuredBuffer.length
  ) {
    return false
  }

  return timingSafeEqual(
    providedBuffer,
    configuredBuffer
  )
}

const verifyReportingApiKey = (
  providedKey
) => {
  if (
    safelyMatchesKey(
      providedKey,
      process.env.POWERBI_SERVICE_API_KEY
    )
  ) {
    return {
      verified: true,
      credentialType: "powerbi-service",
    }
  }

  if (
    safelyMatchesKey(
      providedKey,
      process.env.REPORTING_CLIENT_API_KEY
    )
  ) {
    return {
      verified: true,
      credentialType: "reporting-client",
    }
  }

  return {
    verified: false,
    credentialType: null,
  }
}

export const authorizeReportingRead =
  async (db, req) => {
    const providedApiKey =
      req.headers["x-api-key"]

    const apiKeyVerification =
      verifyReportingApiKey(providedApiKey)

    if (apiKeyVerification.verified) {
      return {
        authorized: true,
        authenticationType:
          apiKeyVerification.credentialType,
        user: null,
      }
    }

    const sessionVerification =
      await verifySession(
        db,
        req.headers.authorization
      )

    if (!sessionVerification.verified) {
      return {
        authorized: false,
        status: 401,
        message:
          "Valid authentication is required.",
      }
    }

    const hasPermission =
      await verifyPermissions(
        ROLES.GUEST,
        sessionVerification.user
      )

    if (!hasPermission) {
      return {
        authorized: false,
        status: 403,
        message:
          "You do not have permission to access this resource.",
      }
    }

    return {
      authorized: true,
      authenticationType: "session",
      user: sessionVerification.user,
    }
  }