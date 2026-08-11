import {
  connectToDatabase,
} from "../../../../lib/mongodb";

import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../../lib/verification";

export default async function handler(
  req,
  res
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);

    return res.status(405).json({
      message:
        "Method not allowed. Use POST only.",
    });
  }

  const { db } =
    await connectToDatabase();

  const authorization =
    req.headers.authorization;

  const verification =
    await verifySession(
      db,
      authorization
    );

  if (!verification.verified) {
    return res
      .status(401)
      .json(verification);
  }

  const permitted =
    await verifyPermissions(
      ROLES.GUEST,
      null,
      db,
      authorization
    );

  if (!permitted) {
    return res.status(403).json({
      message:
        "Permission is required to view capacity entries.",
    });
  }

  const { keys } = req.body || {};

  if (
    !Array.isArray(keys) ||
    keys.length === 0
  ) {
    return res.status(400).json({
      message:
        "At least one capacity-plan and week key is required.",
    });
  }

  const validKeys = keys.filter(
    ({ capPlan, week } = {}) =>
      typeof capPlan === "string" &&
      capPlan.trim() &&
      typeof week === "string" &&
      week.trim()
  );

  if (
    validKeys.length !== keys.length
  ) {
    return res.status(400).json({
      message:
        "Every key must contain a valid capPlan and week.",
    });
  }

  const orCondition =
    validKeys.map(
      ({ capPlan, week }) => ({
        capPlan: capPlan.trim(),
        week: week.trim(),
      })
    );

  const entries =
    await db
      .collection("capEntries")
      .find({
        $or: orCondition,
      })
      .toArray();

  return res.status(200).json(
    entries
  );
}