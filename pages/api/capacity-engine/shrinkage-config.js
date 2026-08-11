// ============================================
// CAPACITY ENGINE — SHRINKAGE CONFIGURATION
//
// One item configuration per capacity plan.
//
// GET:
//   Loads the schema-v3 configuration.
//   If none exists, builds a temporary
//   configuration from schema-v2 plans.
//
// POST / PUT:
//   Saves the capacity plan's shrinkage items.
//
// DELETE:
//   Administrator-only configuration removal.
//
// Collection:
//   capShrinkageConfigs
// ============================================

import { ObjectId } from "mongodb";

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

const CONFIG_COLLECTION =
  "capShrinkageConfigs";

const PLAN_COLLECTION =
  "capShrinkagePlans";

const CATEGORY_COLLECTION =
  "capShrinkageCategories";

const VALID_STATES = new Set([
  "productive",
  "non-productive",
]);

const VALID_COMPENSATION = new Set([
  "paid",
  "unpaid",
]);

const VALID_BILLING = new Set([
  "billable",
  "non-billable",
]);

// ============================================
// GENERAL HELPERS
// ============================================

const normalizeText = (value) =>
  String(value ?? "").trim();

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

const getItemState = (item) =>
  normalizeText(
    item?.state
  ).toLowerCase() === "productive"
    ? "productive"
    : "non-productive";

const getItemCompensation = (item) =>
  normalizeText(
    item?.compensation ||
      item?.comp
  ).toLowerCase() === "unpaid"
    ? "unpaid"
    : "paid";

const getItemLayer = (item) =>
  normalizeText(
    item?.layer ||
      item?.type
  ).toLowerCase() === "external"
    ? "external"
    : "internal";

function ensureUniqueId(
  requestedId,
  usedIds,
  fallbackPrefix = "item"
) {
  const base =
    normalizeCode(requestedId) ||
    `${fallbackPrefix}-${usedIds.size + 1}`;

  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(candidate);

  return candidate;
}

// ============================================
// CAPACITY PLAN FILTER
// Supports ObjectId and string identifiers.
// ============================================

function buildCapPlanFilter(
  capPlanId
) {
  if (ObjectId.isValid(capPlanId)) {
    return {
      $or: [
        {
          _id: new ObjectId(
            capPlanId
          ),
        },
        {
          _id: capPlanId,
        },
      ],
    };
  }

  return {
    _id: capPlanId,
  };
}

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

async function hasManagerPermission(
  db,
  authorization
) {
  return verifyPermissions(
    ROLES.MANAGER,
    null,
    db,
    authorization
  );
}

async function hasAdminPermission(
  db,
  authorization
) {
  return verifyPermissions(
    ROLES.ADMIN,
    null,
    db,
    authorization
  );
}

// ============================================
// INDEX INITIALIZATION
// ============================================

async function ensureIndexes(db) {
  const collection =
    db.collection(
      CONFIG_COLLECTION
    );

  await collection.createIndex(
    {
      capPlan: 1,
    },
    {
      unique: true,
      name:
        "unique_shrinkage_config_capplan",
    }
  );

  await collection.createIndex(
    {
      updatedAt: -1,
    },
    {
      name:
        "shrinkage_config_updated",
    }
  );
}

// ============================================
// CATEGORY LOOKUP
// ============================================

async function loadCategoryCatalog(
  db
) {
  return db
    .collection(
      CATEGORY_COLLECTION
    )
    .find({})
    .sort({
      layer: 1,
      sortOrder: 1,
      name: 1,
    })
    .toArray();
}

function buildCategoryMaps(
  categories
) {
  const byCode = new Map();
  const byNameAndLayer =
    new Map();

  categories.forEach(
    (category) => {
      const code =
        normalizeCode(
          category.code
        );

      const layer =
        normalizeText(
          category.layer
        ).toLowerCase();

      const name =
        normalizeText(
          category.name
        );

      if (!code) {
        return;
      }

      byCode.set(
        code,
        category
      );

      if (name && layer) {
        byNameAndLayer.set(
          `${layer}|${name.toLowerCase()}`,
          category
        );
      }
    }
  );

  return {
    byCode,
    byNameAndLayer,
  };
}

// ============================================
// FORMAT CATEGORY
// ============================================

function formatCategory(category) {
  if (!category) {
    return null;
  }

  return {
    code: category.code,
    name: category.name,
    layer: category.layer,

    active:
      category.active !== false,

    isDefault:
      category.isDefault === true,

    sortOrder:
      Number(
        category.sortOrder
      ) || 0,
  };
}

// ============================================
// ENRICH CONFIGURATION ITEMS
// Adds category name and derived layer.
// ============================================

function enrichItems(
  items,
  categoryByCode
) {
  return (items || []).map(
    (item) => {
      const category =
        categoryByCode.get(
          normalizeCode(
            item.categoryCode
          )
        );

      return {
        id: item.id,
        name: item.name,

        categoryCode:
          item.categoryCode,

        categoryName:
          category?.name ||
          item.categoryName ||
          "",

        layer:
          category?.layer ||
          item.layer ||
          "",

        categoryActive:
          category
            ? category.active !==
              false
            : false,

        state: item.state,

        compensation:
          item.compensation,
        
        billing:
          item.billing || "",
      
      };
    }
  );
}

// ============================================
// LEGACY SCHEMA-V2 CONVERSION
//
// This does not save anything.
// It prepares a temporary configuration that
// the new editor can later save as schema v3.
// ============================================

function buildLegacyConfiguration({
  capPlanId,
  legacyPlans,
  categories,
}) {
  const {
    byCode,
    byNameAndLayer,
  } = buildCategoryMaps(
    categories
  );

  const items = [];
  const warnings = [];

  const usedIds = new Set();
  const itemKeys = new Set();

  legacyPlans.forEach((plan) => {
    (plan?.items || []).forEach(
      (legacyItem) => {
        const name =
          normalizeText(
            legacyItem?.name
          );

        if (!name) {
          return;
        }

        const layer =
          getItemLayer(
            legacyItem
          );

        const itemKey =
          `${layer}|${name.toLowerCase()}`;

        if (
          itemKeys.has(itemKey)
        ) {
          return;
        }

        itemKeys.add(itemKey);

        const legacyCategoryName =
          normalizeText(
            legacyItem?.category
          );

        const categoryMatch =
          byNameAndLayer.get(
            `${layer}|${legacyCategoryName.toLowerCase()}`
          );

        const itemId =
          ensureUniqueId(
            legacyItem?.id ||
              name,
            usedIds
          );

        if (!categoryMatch) {
          warnings.push({
            code:
              "UNMATCHED_LEGACY_CATEGORY",

            itemId,

            itemName: name,

            category:
              legacyCategoryName,

            layer,

            message: `The legacy category "${legacyCategoryName}" used by "${name}" does not exist in the administrator catalog.`,
          });
        }

        items.push({
          id: itemId,
          name,

          categoryCode:
            categoryMatch?.code ||
            "",

          // Retained temporarily so the
          // editor can explain unmatched
          // legacy categories.
          legacyCategory:
            legacyCategoryName,

          legacyLayer: layer,

          state:
            getItemState(
              legacyItem
            ),

          compensation:
            getItemCompensation(
              legacyItem
            ),

          // Legacy items did not contain client
          // billing classification. The planner
          // must select it before saving.
          billing: "",
        });
      }
    );
  });

  return {
    schemaVersion: 3,
    capPlan: capPlanId,
    items,

    source: "schema-v2-preview",

    migrationRequired:
      legacyPlans.length > 0,

    warnings,

    // This preview is not persisted yet.
    createdAt: null,
    createdBy: null,
    updatedAt: null,
    updatedBy: null,

    enrichedItems:
      enrichItems(
        items,
        byCode
      ),
  };
}

// ============================================
// NORMALIZE SUBMITTED ITEMS
// ============================================

function normalizeSubmittedItems(
  rawItems
) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  return rawItems.map(
    (item, index) => ({
      id:
        normalizeCode(
          item?.id
        ) ||
        `item-${index + 1}`,

      name:
        normalizeText(
          item?.name
        ),

      categoryCode:
        normalizeCode(
          item?.categoryCode
        ),

      state:
        normalizeText(
          item?.state ||
            "non-productive"
        ).toLowerCase(),

      compensation:
        normalizeText(
          item?.compensation ||
            "paid"
        ).toLowerCase(),

      billing:
        normalizeText(
          item?.billing
        ).toLowerCase(),
    })
  );
}

// ============================================
// VALIDATE CONFIGURATION
// ============================================

function validateConfiguration({
  items,
  categoryByCode,
  existingConfig,
}) {
  const errors = [];

  if (!Array.isArray(items)) {
    return [
      {
        code: "INVALID_ITEMS",
        message:
          "Shrinkage items must be an array.",
      },
    ];
  }

  if (items.length === 0) {
    errors.push({
      code: "MISSING_ITEMS",
      message:
        "At least one shrinkage item is required.",
    });
  }

  const itemIds = new Set();
  const itemNames = new Set();

  const existingItemsById =
    new Map(
      (
        existingConfig?.items ||
        []
      ).map((item) => [
        item.id,
        item,
      ])
    );

  items.forEach(
    (item, index) => {
      const position =
        index + 1;

      if (!item.id) {
        errors.push({
          code:
            "MISSING_ITEM_ID",

          message: `Item ${position} requires an ID.`,
        });
      } else if (
        itemIds.has(item.id)
      ) {
        errors.push({
          code:
            "DUPLICATE_ITEM_ID",

          message: `Item ID "${item.id}" is duplicated.`,
        });
      }

      itemIds.add(item.id);

      if (!item.name) {
        errors.push({
          code:
            "MISSING_ITEM_NAME",

          message: `Item ${position} requires a name.`,
        });
      } else {
        const normalizedName =
          item.name.toLowerCase();

        if (
          itemNames.has(
            normalizedName
          )
        ) {
          errors.push({
            code:
              "DUPLICATE_ITEM_NAME",

            message: `Item name "${item.name}" is duplicated.`,
          });
        }

        itemNames.add(
          normalizedName
        );
      }

      if (!item.categoryCode) {
        errors.push({
          code:
            "MISSING_CATEGORY",

          message: `Item "${item.name || position}" requires an approved category.`,
        });
      } else {
        const category =
          categoryByCode.get(
            item.categoryCode
          );

        if (!category) {
          errors.push({
            code:
              "UNKNOWN_CATEGORY",

            message: `Item "${item.name || position}" references unknown category "${item.categoryCode}".`,
          });
        } else if (
          category.active === false
        ) {
          const existingItem =
            existingItemsById.get(
              item.id
            );

          const categoryWasAlreadyUsed =
            existingItem?.categoryCode ===
            item.categoryCode;

          // Existing historical references to
          // inactive categories may remain.
          // An inactive category cannot be newly
          // assigned to another item.
          if (
            !categoryWasAlreadyUsed
          ) {
            errors.push({
              code:
                "INACTIVE_CATEGORY",

              message: `Category "${category.name}" is inactive and cannot be assigned to "${item.name || position}".`,
            });
          }
        }
      }

      if (
        !VALID_STATES.has(
          item.state
        )
      ) {
        errors.push({
          code:
            "INVALID_STATE",

          message: `Item "${item.name || position}" must be productive or non-productive.`,
        });
      }

      if (
        !VALID_COMPENSATION.has(
          item.compensation
        )
      ) {
        errors.push({
          code:
            "INVALID_COMPENSATION",

          message: `Item "${item.name || position}" must be paid or unpaid.`,
        });
      }
      if (
        !VALID_BILLING.has(
          item.billing
        )
      ) {
        errors.push({
          code:
            "INVALID_BILLING",

          message: `Item "${item.name || position}" must be billable or non-billable.`,
        });
      }
    }
  );

  return errors;
}

// ============================================
// FORMAT CONFIGURATION RESPONSE
// ============================================

function formatConfiguration(
  configuration,
  categories,
  extra = {}
) {
  const {
    byCode,
  } = buildCategoryMaps(
    categories
  );

  const items =
    configuration?.items || [];

  const billingMigrationRequired =
  items.some(
    (item) =>
      !VALID_BILLING.has(
        normalizeText(
          item?.billing
        ).toLowerCase()
      )
  );

  return {
    schemaVersion:
      Number(
        configuration?.schemaVersion
      ) || 3,

    capPlan:
      configuration?.capPlan ||
      "",

    items,

    enrichedItems:
      enrichItems(
        items,
        byCode
      ),

    source:
      configuration?.source ||
      "schema-v3",

    migrationRequired:
      configuration
        ?.migrationRequired ===
      true,

    billingMigrationRequired,

    warnings:
      configuration?.warnings ||
      [],

    createdAt:
      configuration?.createdAt ||
      null,

    createdBy:
      configuration?.createdBy ||
      null,

    updatedAt:
      configuration?.updatedAt ||
      null,

    updatedBy:
      configuration?.updatedBy ||
      null,

    ...extra,
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

    const canManage =
      await hasManagerPermission(
        db,
        authorization
      );

    if (!canManage) {
      return res.status(403).json({
        message:
          "Manager permission is required to manage capacity-plan shrinkage configuration.",
      });
    }

    const capPlanId =
      normalizeText(
        query.capPlan ||
          body?.capPlan
      );

    if (!capPlanId) {
      return res.status(400).json({
        message:
          "A capacity-plan identifier is required.",
      });
    }

    await ensureIndexes(db);

    const capPlan =
      await db
        .collection("capPlans")
        .findOne(
          buildCapPlanFilter(
            capPlanId
          )
        );

    if (!capPlan) {
      return res.status(404).json({
        message:
          "Capacity plan not found.",
      });
    }

    const categories =
      await loadCategoryCatalog(
        db
      );

    if (
      categories.length === 0
    ) {
      return res.status(409).json({
        message:
          "No shrinkage categories are configured. Open Management → Shrinkage Categories first.",
      });
    }

    const {
      byCode: categoryByCode,
    } = buildCategoryMaps(
      categories
    );

    const configCollection =
      db.collection(
        CONFIG_COLLECTION
      );

    // ========================================
    // GET — LOAD CONFIGURATION
    // ========================================

    if (method === "GET") {
      const existingConfig =
        await configCollection.findOne({
          capPlan: capPlanId,
        });

      if (existingConfig) {
        return res.status(200).json({
          message:
            "Shrinkage configuration loaded.",

          data:
            formatConfiguration(
              existingConfig,
              categories
            ),

          categories:
            categories
              .filter(
                (category) =>
                  category.active !==
                  false ||
                  existingConfig.items?.some(
                    (item) =>
                      item.categoryCode ===
                      category.code
                  )
              )
              .map(
                formatCategory
              ),
        });
      }

      // No schema-v3 configuration exists.
      // Build a temporary preview from the
      // existing schema-v2 plans.
      const legacyPlans =
        await db
          .collection(
            PLAN_COLLECTION
          )
          .find({
            capPlan: capPlanId,
          })
          .sort({
            week: 1,
          })
          .toArray();

      const legacyConfiguration =
        buildLegacyConfiguration({
          capPlanId,
          legacyPlans,
          categories,
        });

      return res.status(200).json({
        message:
          legacyPlans.length > 0
            ? "Legacy shrinkage items were prepared for schema-v3 migration."
            : "No saved shrinkage configuration was found.",

        data:
          formatConfiguration(
            legacyConfiguration,
            categories
          ),

        categories: categories
          .filter(
            (category) =>
              category.active !==
              false
          )
          .map(
            formatCategory
          ),
      });
    }

    // ========================================
    // POST / PUT — SAVE CONFIGURATION
    // ========================================

    if (
      method === "POST" ||
      method === "PUT"
    ) {
      const payload =
        body?.payload || body;

      const items =
        normalizeSubmittedItems(
          payload?.items
        );

      const existingConfig =
        await configCollection.findOne({
          capPlan: capPlanId,
        });

      const errors =
        validateConfiguration({
          items,
          categoryByCode,
          existingConfig,
        });

      if (errors.length > 0) {
        return res.status(422).json({
          message:
            "Shrinkage configuration validation failed.",

          validation: {
            errors,
          },
        });
      }

      const now = new Date();

      const username =
        getUsername(
          verification
        );

      await configCollection.updateOne(
        {
          capPlan: capPlanId,
        },
        {
          $set: {
            schemaVersion: 3,
            capPlan: capPlanId,
            items,

            updatedAt: now,
            updatedBy: username,
          },

          $setOnInsert: {
            createdAt: now,
            createdBy: username,
          },
        },
        {
          upsert: true,
        }
      );

      const savedConfig =
        await configCollection.findOne({
          capPlan: capPlanId,
        });

      return res.status(200).json({
        message:
          "Shrinkage configuration saved.",

        data:
          formatConfiguration(
            savedConfig,
            categories
          ),

        categories: categories
          .filter(
            (category) =>
              category.active !==
                false ||
              savedConfig.items?.some(
                (item) =>
                  item.categoryCode ===
                  category.code
              )
          )
          .map(
            formatCategory
          ),
      });
    }

    // ========================================
    // DELETE — ADMINISTRATOR ONLY
    // ========================================

    if (method === "DELETE") {
      const isAdministrator =
        await hasAdminPermission(
          db,
          authorization
        );

      if (!isAdministrator) {
        return res.status(403).json({
          message:
            "Administrator permission is required to remove a shrinkage configuration.",
        });
      }

      const result =
        await configCollection.deleteOne({
          capPlan: capPlanId,
        });

      return res.status(200).json({
        message:
          result.deletedCount > 0
            ? "Shrinkage configuration removed."
            : "No shrinkage configuration was found.",

        data: {
          deletedCount:
            result.deletedCount,
        },
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
      "Shrinkage configuration API error:",
      error
    );

    if (error?.code === 11000) {
      return res.status(409).json({
        message:
          "A shrinkage configuration already exists for this capacity plan.",
      });
    }

    return res.status(500).json({
      message:
        "The shrinkage configuration request could not be completed.",
    });
  }
}