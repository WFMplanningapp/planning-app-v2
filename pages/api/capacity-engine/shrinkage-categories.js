// ============================================
// CAPACITY ENGINE — SHRINKAGE CATEGORIES
//
// Global Super User-managed catalog.
//
// GET:
//   Super User permission.
//   Returns active categories by default.
//   Inactive records may be requested.
//
// POST:
//   Super User permission.
//   Creates a category.
//
// PUT:
//   Super User permission.
//   Updates category metadata.
//
// DELETE:
//   Super User permission.
//   Soft-deactivates a category.
//
// Collection:
//   capShrinkageCategories
// ============================================

import {
  connectToDatabase,
} from "../../../lib/mongodb";

import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../lib/verification";

// ============================================
// CONSTANTS
// ============================================

const COLLECTION =
  "capShrinkageCategories";

const VALID_LAYERS = new Set([
  "internal",
  "external",
]);

const DEFAULT_CATEGORIES = [
  {
    code: "vacation",
    name: "Vacation",
    layer: "external",
    sortOrder: 10,
  },
  {
    code: "absenteeism",
    name: "Absenteeism",
    layer: "external",
    sortOrder: 20,
  },
  {
    code: "breaks",
    name: "Breaks",
    layer: "internal",
    sortOrder: 30,
  },
  {
    code: "training",
    name: "Training",
    layer: "internal",
    sortOrder: 40,
  },
  {
    code: "coaching",
    name: "Coaching",
    layer: "internal",
    sortOrder: 50,
  },
  {
    code: "meeting",
    name: "Meeting",
    layer: "internal",
    sortOrder: 60,
  },
];

// ============================================
// GENERAL HELPERS
// ============================================

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeLayer = (value) =>
  normalizeText(value).toLowerCase();

const normalizeCode = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const getUsername = (verification) =>
  verification?.user?.username ||
  verification?.user?.email ||
  verification?.user?.name ||
  "unknown";

const getBooleanQueryValue = (
  value,
  fallback = false
) => {
  if (value === undefined) {
    return fallback;
  }

  return (
    String(value).toLowerCase() ===
    "true"
  );
};

const getSortOrder = (
  value,
  fallback = 999
) => {
  const numericValue = Number(value);

  if (
    !Number.isFinite(numericValue)
  ) {
    return fallback;
  }

  return Math.round(numericValue);
};

// ============================================
// AUTHORIZATION
// ============================================

async function authenticate(
  db,
  authorization
) {
  if (!authorization) {
    return {
      verified: false,
      status: 401,
      message:
        "Authorization is required.",
    };
  }

  const verification =
    await verifySession(
      db,
      authorization
    );

  if (!verification.verified) {
    return {
      ...verification,
      status: 401,
    };
  }

  return {
    ...verification,
    status: 200,
  };
}

async function hasSuperUserPermission(
  db,
  authorization
) {
  return verifyPermissions(
    ROLES.SU,
    null,
    db,
    authorization
  );
}

// ============================================
// DEFAULT-CATALOG INITIALIZATION
// ============================================

async function ensureDefaultCategories(
  db
) {
  const collection =
    db.collection(COLLECTION);

  // These indexes support stable codes and
  // predictable category ordering.
  await collection.createIndex(
    { code: 1 },
    {
      unique: true,
      name:
        "unique_shrinkage_category_code",
    }
  );

  await collection.createIndex(
    {
      active: 1,
      layer: 1,
      sortOrder: 1,
    },
    {
      name:
        "shrinkage_category_listing",
    }
  );

  const now = new Date();

  const operations =
    DEFAULT_CATEGORIES.map(
      (category) => ({
        updateOne: {
          filter: {
            code: category.code,
          },

          update: {
            $setOnInsert: {
              ...category,
              active: true,
              isDefault: true,

              createdAt: now,
              createdBy: "system",

              updatedAt: now,
              updatedBy: "system",
            },
          },

          upsert: true,
        },
      })
    );

  if (operations.length > 0) {
    await collection.bulkWrite(
      operations,
      {
        ordered: false,
      }
    );
  }
}

// ============================================
// CATEGORY VALIDATION
// ============================================

function validateCategoryInput({
  name,
  layer,
  code,
  requireCode = true,
}) {
  const errors = [];

  if (!name) {
    errors.push({
      code: "MISSING_NAME",
      message:
        "Category name is required.",
    });
  }

  if (
    !layer ||
    !VALID_LAYERS.has(layer)
  ) {
    errors.push({
      code: "INVALID_LAYER",
      message:
        "Category layer must be internal or external.",
    });
  }

  if (requireCode && !code) {
    errors.push({
      code: "MISSING_CODE",
      message:
        "A valid category code is required.",
    });
  }

  if (
    code &&
    !/^[a-z0-9][a-z0-9-_]*$/.test(
      code
    )
  ) {
    errors.push({
      code: "INVALID_CODE",
      message:
        "Category code may contain lowercase letters, numbers, hyphens, and underscores.",
    });
  }

  return errors;
}

// ============================================
// FORMAT RESPONSE DOCUMENT
// ============================================

function formatCategory(category) {
  if (!category) {
    return null;
  }

  return {
    _id:
      category._id?.toString?.() ||
      String(category._id || ""),

    code: category.code,
    name: category.name,
    layer: category.layer,

    active:
      category.active !== false,

    isDefault:
      category.isDefault === true,

    sortOrder:
      Number(category.sortOrder) ||
      0,

    createdAt:
      category.createdAt || null,

    createdBy:
      category.createdBy || null,

    updatedAt:
      category.updatedAt || null,

    updatedBy:
      category.updatedBy || null,
  };
}

// ============================================
// API HANDLER
// ============================================

export default async function handler(
  req,
  res
) {
  const {
    method,
    query = {},
    body = {},
    headers = {},
  } = req;

  try {
    const { db } =
      await connectToDatabase();

    const authorization =
      headers.authorization;

    const verification =
      await authenticate(
        db,
        authorization
      );

    if (!verification.verified) {
      return res
        .status(
          verification.status || 401
        )
        .json({
          message:
            verification.message ||
            "A valid session is required.",
        });
    }

    // Every supported operation in this
    // endpoint requires Super User permission.
    const isSuperUser =
      await hasSuperUserPermission(
        db,
        authorization
      );

    if (!isSuperUser) {
      return res.status(403).json({
        message:
          "Super User permission is required to access shrinkage categories.",
      });
    }

    // Initialization occurs only after the
    // requester has passed the SU check.
    await ensureDefaultCategories(
      db
    );

    const collection =
      db.collection(COLLECTION);

    // ========================================
    // GET — READ CATALOG
    // ========================================

    if (method === "GET") {
      const includeInactive =
        getBooleanQueryValue(
          query.includeInactive,
          false
        );

      const filter = {};

      if (!includeInactive) {
        filter.active = {
          $ne: false,
        };
      }

      if (query.layer) {
        const requestedLayer =
          normalizeLayer(
            query.layer
          );

        if (
          !VALID_LAYERS.has(
            requestedLayer
          )
        ) {
          return res.status(400).json({
            message:
              "The layer parameter must be internal or external.",
          });
        }

        filter.layer =
          requestedLayer;
      }

      const categories =
        await collection
          .find(filter)
          .sort({
            layer: 1,
            sortOrder: 1,
            name: 1,
          })
          .toArray();

      return res.status(200).json({
        message: `Found ${categories.length} shrinkage category record(s).`,

        data: categories.map(
          formatCategory
        ),

        permissions: {
          canManage: true,
        },
      });
    }

    // ========================================
    // POST — CREATE CATEGORY
    // ========================================

    if (method === "POST") {
      const payload =
        body?.payload || body;

      const name = normalizeText(
        payload?.name
      );

      const layer =
        normalizeLayer(
          payload?.layer
        );

      const code =
        normalizeCode(
          payload?.code || name
        );

      const sortOrder =
        getSortOrder(
          payload?.sortOrder
        );

      const errors =
        validateCategoryInput({
          name,
          layer,
          code,
          requireCode: true,
        });

      if (errors.length > 0) {
        return res.status(422).json({
          message:
            "Shrinkage category validation failed.",

          validation: {
            errors,
          },
        });
      }

      const existingByCode =
        await collection.findOne({
          code,
        });

      if (existingByCode) {
        return res.status(409).json({
          message: `The category code "${code}" already exists.`,
        });
      }

      const existingByName =
        await collection.findOne({
          layer,
          name: {
            $regex: `^${name.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}$`,
            $options: "i",
          },
        });

      if (existingByName) {
        return res.status(409).json({
          message: `The category "${name}" already exists in the ${layer} layer.`,
        });
      }

      const now = new Date();

      const username =
        getUsername(
          verification
        );

      const document = {
        code,
        name,
        layer,
        active: true,
        isDefault: false,
        sortOrder,

        createdAt: now,
        createdBy: username,

        updatedAt: now,
        updatedBy: username,
      };

      const result =
        await collection.insertOne(
          document
        );

      const createdCategory =
        await collection.findOne({
          _id: result.insertedId,
        });

      return res.status(201).json({
        message:
          "Shrinkage category created.",

        data: formatCategory(
          createdCategory
        ),
      });
    }

    // ========================================
    // PUT — UPDATE CATEGORY
    // ========================================

    if (method === "PUT") {
      const requestedCode =
        normalizeCode(
          query.code ||
            body?.code ||
            body?.payload?.code
        );

      if (!requestedCode) {
        return res.status(400).json({
          message:
            "A category code is required.",
        });
      }

      const existingCategory =
        await collection.findOne({
          code: requestedCode,
        });

      if (!existingCategory) {
        return res.status(404).json({
          message:
            "Shrinkage category not found.",
        });
      }

      const payload =
        body?.payload || body;

      const name = normalizeText(
        payload?.name ??
          existingCategory.name
      );

      const layer =
        normalizeLayer(
          payload?.layer ??
            existingCategory.layer
        );

      const sortOrder =
        getSortOrder(
          payload?.sortOrder,
          existingCategory.sortOrder
        );

      const active =
        typeof payload?.active ===
        "boolean"
          ? payload.active
          : existingCategory.active !==
            false;

      const errors =
        validateCategoryInput({
          name,
          layer,
          code: requestedCode,
          requireCode: true,
        });

      if (errors.length > 0) {
        return res.status(422).json({
          message:
            "Shrinkage category validation failed.",

          validation: {
            errors,
          },
        });
      }

      const duplicateName =
        await collection.findOne({
          code: {
            $ne: requestedCode,
          },

          layer,

          name: {
            $regex: `^${name.replace(
              /[.*+?^${}()|[\]\\]/g,
              "\\$&"
            )}$`,
            $options: "i",
          },
        });

      if (duplicateName) {
        return res.status(409).json({
          message: `The category "${name}" already exists in the ${layer} layer.`,
        });
      }

      const now = new Date();

      await collection.updateOne(
        {
          code: requestedCode,
        },
        {
          $set: {
            name,
            layer,
            active,
            sortOrder,

            updatedAt: now,

            updatedBy:
              getUsername(
                verification
              ),
          },
        }
      );

      const updatedCategory =
        await collection.findOne({
          code: requestedCode,
        });

      return res.status(200).json({
        message:
          "Shrinkage category updated.",

        data: formatCategory(
          updatedCategory
        ),
      });
    }

    // ========================================
    // DELETE — SOFT DEACTIVATE
    // ========================================

    if (method === "DELETE") {
      const requestedCode =
        normalizeCode(query.code);

      if (!requestedCode) {
        return res.status(400).json({
          message:
            "A category code is required.",
        });
      }

      const existingCategory =
        await collection.findOne({
          code: requestedCode,
        });

      if (!existingCategory) {
        return res.status(404).json({
          message:
            "Shrinkage category not found.",
        });
      }

      if (
        existingCategory.active ===
        false
      ) {
        return res.status(200).json({
          message:
            "Shrinkage category is already inactive.",

          data: formatCategory(
            existingCategory
          ),
        });
      }

      const now = new Date();

      await collection.updateOne(
        {
          code: requestedCode,
        },
        {
          $set: {
            active: false,

            updatedAt: now,

            updatedBy:
              getUsername(
                verification
              ),
          },
        }
      );

      const deactivatedCategory =
        await collection.findOne({
          code: requestedCode,
        });

      return res.status(200).json({
        message:
          "Shrinkage category deactivated. Existing capacity-plan references are preserved.",

        data: formatCategory(
          deactivatedCategory
        ),
      });
    }

    // ========================================
    // UNSUPPORTED METHOD
    // ========================================

    res.setHeader("Allow", [
      "GET",
      "POST",
      "PUT",
      "DELETE",
    ]);

    return res.status(405).json({
      message:
        "Method not allowed. Use GET, POST, PUT, or DELETE.",
    });
  } catch (error) {
    console.error(
      "Shrinkage category API error:",
      error
    );

    // MongoDB duplicate-key errors may occur
    // if two requests create the same code
    // simultaneously.
    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "A shrinkage category with that code already exists.",
      });
    }

    return res.status(500).json({
      message:
        "The shrinkage category request could not be completed.",
    });
  }
}