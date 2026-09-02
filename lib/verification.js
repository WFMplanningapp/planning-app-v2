export const ROLES = {
  ADMIN: [1, 4],
  MANAGER: [1, 2, 4],
  GUEST: [1, 2, 3, 4],
  SU: [4],
};

const decodeAuthorization = (
  authorization
) => {
  if (
    typeof authorization !== "string" ||
    authorization.trim() === ""
  ) {
    return {
      username: null,
      token: null,
      error:
        "Authorization header is missing.",
    };
  }

  try {
    const decoded = Buffer.from(
      authorization.trim(),
      "base64"
    ).toString("utf8");

    const separatorIndex =
      decoded.indexOf(":");

    if (separatorIndex <= 0) {
      return {
        username: null,
        token: null,
        error:
          "Authorization header is invalid.",
      };
    }

    const username = decoded
      .slice(0, separatorIndex)
      .trim();

    const token = decoded
      .slice(separatorIndex + 1)
      .trim();

    if (!username || !token) {
      return {
        username: null,
        token: null,
        error:
          "Authorization credentials are incomplete.",
      };
    }

    return {
      username,
      token,
      error: null,
    };
  } catch (error) {
    return {
      username: null,
      token: null,
      error:
        "Authorization header could not be decoded.",
    };
  }
};

const getExpirationTimestamp = (
  expirationValue
) => {
  if (
    expirationValue === null ||
    expirationValue === undefined ||
    expirationValue === ""
  ) {
    return null;
  }

  if (
    expirationValue instanceof Date
  ) {
    const timestamp =
      expirationValue.getTime();

    return Number.isFinite(timestamp)
      ? timestamp
      : null;
  }

  const numericTimestamp =
    Number(expirationValue);

  if (
    Number.isFinite(numericTimestamp)
  ) {
    return numericTimestamp;
  }

  const parsedDateTimestamp =
    Date.parse(
      String(expirationValue)
    );

  return Number.isFinite(
    parsedDateTimestamp
  )
    ? parsedDateTimestamp
    : null;
};

export const verifyPermissions = async (
  requiredPermissions,
  user = null,
  db = null,
  authorization = null
) => {
  let resolvedUser = user;

  if (
    !resolvedUser ||
    Object.keys(resolvedUser).length === 0
  ) {
    if (!db || !authorization) {
      return false;
    }

    const {
      username,
      error,
    } = decodeAuthorization(
      authorization
    );

    if (error || !username) {
      return false;
    }

    try {
      resolvedUser = await db
        .collection("verification")
        .findOne({ username });
    } catch (error) {
      console.error(
        "Permission verification failed:",
        error
      );

      return false;
    }
  }

  if (
    !resolvedUser ||
    resolvedUser.permission === undefined ||
    resolvedUser.permission === null
  ) {
    return false;
  }

  const allowedPermissions =
    Array.isArray(requiredPermissions)
      ? requiredPermissions.map(Number)
      : [Number(requiredPermissions)];

  const userPermission =
    Number(resolvedUser.permission);

  if (
    !Number.isFinite(userPermission) ||
    allowedPermissions.some(
      (permission) =>
        !Number.isFinite(permission)
    )
  ) {
    return false;
  }

  return allowedPermissions.includes(
    userPermission
  );
};

const sanitizeVerifiedUser = (user) => {
  if (
    !user ||
    typeof user !== "object"
  ) {
    return null;
  }

  const {
    password,
    ...safeUser
  } = user;

  return safeUser;
};

export const verifySession = async (
  db,
  authorization
) => {
  if (
    !db ||
    typeof db.collection !== "function"
  ) {
    return {
      message:
        "Session verification is unavailable.",
      verified: false,
    };
  }

  const {
    username,
    token,
    error,
  } = decodeAuthorization(
    authorization
  );

  if (
    error ||
    !username ||
    !token
  ) {
    return {
      message:
        error ||
        "Authorization credentials are invalid.",
      verified: false,
    };
  }

  let user;

  try {
    user = await db
      .collection("verification")
      .findOne({ username });
  } catch (error) {
    console.error(
      "Session verification failed:",
      error
    );

    return {
      message:
        "Session verification failed.",
      verified: false,
    };
  }

  if (!user || !user.session) {
    return {
      message:
        "No user or session!",
      verified: false,
    };
  }

  if (
    !user.session.token ||
    user.session.token !== token
  ) {
    return {
      message: "Invalid Token!",
      verified: false,
    };
  }

  const expiration =
    getExpirationTimestamp(
      user.session.expires ??
      user.session.expired
    );

  if (
    expiration === null ||
    expiration <= Date.now()
  ) {
    return {
      message: "Session Expired!",
      verified: false,
    };
  }

  const safeUser =
    sanitizeVerifiedUser(user);

  return {
    message: "User Verified!",
    verified: true,
    permission: user.permission,
    user: safeUser,
  };
};
