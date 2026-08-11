// ============================================
// CAPACITY ENGINE — SHRINKAGE PLAN API
//
// Schema v3:
// - Item configuration comes from
//   capShrinkageConfigs.
// - Category and layer information comes from
//   capShrinkageCategories.
// - The client submits only week, dates,
//   and daily item values.
//
// Schema v2 remains temporarily supported
// until the planner editor is replaced.
//
// METHODS: GET, POST, PUT, DELETE
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
// COLLECTIONS
// ============================================

const PLAN_COLLECTION =
  "capShrinkagePlans";

const CONFIG_COLLECTION =
  "capShrinkageConfigs";

const CATEGORY_COLLECTION =
  "capShrinkageCategories";

// ============================================
// VALID VALUES
// ============================================

const VALID_LAYERS = new Set([
  "internal",
  "external",
]);

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

const SUMMARY_FIELDS = [
  "internal",
  "external",
  "combined",
  "totalNonProductive",
  "totalProductive",
  "totalPaid",
  "totalUnpaid",
  "totalBillable",
  "totalNonBillable",
];

// ============================================
// GENERAL HELPERS
// ============================================

const round2 = (value) =>
  Math.round(
    (Number(value) + Number.EPSILON) *
      100
  ) / 100;

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeCode = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const isISODate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value);

const isValidWeekCode = (value) =>
  typeof value === "string" &&
  /^\d{4}[wW]\d{1,2}$/.test(value);

const normalizeWeekCode = (value) => {
  const text = normalizeText(value);

  if (!isValidWeekCode(text)) {
    return null;
  }

  const [year, week] = text
    .toLowerCase()
    .split("w");

  return `${year}w${String(
    Number(week)
  ).padStart(2, "0")}`;
};

const getUsername = (verification) =>
  verification?.user?.username ||
  verification?.user?.email ||
  verification?.user?.name ||
  "unknown";

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
      message:
        "Authorization is required.",
    };
  }

  return verifySession(
    db,
    authorization
  );
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
// DATE VALIDATION
// ============================================

function validateDateString(value) {
  if (!isISODate(value)) {
    return false;
  }

  const [
    yearText,
    monthText,
    dayText,
  ] = value.split("-");

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeDates(rawDates) {
  if (!Array.isArray(rawDates)) {
    return [];
  }

  return [
    ...new Set(
      rawDates
        .map(normalizeText)
        .filter(Boolean)
    ),
  ].sort();
}

function validateWeekAndDates({
  week,
  dates,
}) {
  const errors = [];

  if (!week) {
    errors.push({
      code: "INVALID_WEEK",
      message:
        "A valid week code is required.",
    });
  }

  if (
    !Array.isArray(dates) ||
    dates.length === 0
  ) {
    errors.push({
      code: "MISSING_DATES",
      message:
        "At least one date is required.",
    });

    return errors;
  }

  if (dates.length !== 7) {
    errors.push({
      code:
        "INVALID_WEEK_DATE_COUNT",
      message:
        "A weekly shrinkage plan must contain exactly seven dates.",
    });
  }

  dates.forEach(
    (date, index) => {
      if (
        !validateDateString(date)
      ) {
        errors.push({
          code: "INVALID_DATE",
          message: `Date at position ${
            index + 1
          } must be a valid YYYY-MM-DD date.`,
        });
      }
    }
  );

  return errors;
}

// ============================================
// SUMMARY CALCULATION
// ============================================

function calculateSummary({
  dates,
  items,
  data,
}) {
  const summary = {};

  dates.forEach((date) => {
    let internal = 0;
    let external = 0;

    let totalNonProductive = 0;
    let totalProductive = 0;

    let totalPaid = 0;
    let totalUnpaid = 0;

    let totalBillable = 0;
    let totalNonBillable = 0;

    items.forEach((item) => {
      const numericValue = Number(
        data?.[item.id]?.[date] ?? 0
      );

      const value =
        Number.isFinite(numericValue)
          ? numericValue
          : 0;

      // Layer classification
      if (
        item.layer === "internal"
      ) {
        internal += value;
      } else if (
        item.layer === "external"
      ) {
        external += value;
      }

      // Productive-state classification
      if (
        item.state === "productive"
      ) {
        totalProductive += value;
      } else if (
        item.state ===
        "non-productive"
      ) {
        totalNonProductive += value;
      }

      // Compensation classification
      if (
        item.compensation ===
        "paid"
      ) {
        totalPaid += value;
      } else if (
        item.compensation ===
        "unpaid"
      ) {
        totalUnpaid += value;
      }

      // Client-billing classification
      //
      // No default is applied here. Schema-v3
      // validation requires a valid billing
      // classification. Legacy schema-v2 items
      // remain unclassified rather than being
      // silently assigned to either group.
      if (
        item.billing ===
        "billable"
      ) {
        totalBillable += value;
      } else if (
        item.billing ===
        "non-billable"
      ) {
        totalNonBillable += value;
      }
    });

    const combined =
      (
        1 -
        (1 - internal / 100) *
          (1 - external / 100)
      ) * 100;

    summary[date] = {
      internal:
        round2(internal),

      external:
        round2(external),

      combined:
        round2(combined),

      totalNonProductive:
        round2(
          totalNonProductive
        ),

      totalProductive:
        round2(
          totalProductive
        ),

      totalPaid:
        round2(totalPaid),

      totalUnpaid:
        round2(totalUnpaid),

      totalBillable:
        round2(totalBillable),

      totalNonBillable:
        round2(
          totalNonBillable
        ),
    };
  });

  return summary;
}

function calculateSummaryFlat({
  dates,
  summary,
}) {
  const totals = {};

  SUMMARY_FIELDS.forEach(
    (field) => {
      totals[field] = 0;
    }
  );

  if (
    !Array.isArray(dates) ||
    dates.length === 0
  ) {
    return totals;
  }

  dates.forEach((date) => {
    const daily =
      summary?.[date] || {};

    SUMMARY_FIELDS.forEach(
      (field) => {
        totals[field] +=
          Number(
            daily[field]
          ) || 0;
      }
    );
  });

  SUMMARY_FIELDS.forEach(
    (field) => {
      totals[field] = round2(
        totals[field] /
          dates.length
      );
    }
  );

  return totals;
}

function validateSummary(
  summary,
  {
    requireBillingReconciliation =
      false,
  } = {}
) {
  const errors = [];

  Object.entries(
    summary || {}
  ).forEach(
    ([date, totals]) => {
      if (
        totals.internal >= 100
      ) {
        errors.push({
          code:
            "INTERNAL_TOTAL_OUT_OF_RANGE",

          message: `Internal shrinkage on ${date} must be below 100%.`,
        });
      }

      if (
        totals.external >= 100
      ) {
        errors.push({
          code:
            "EXTERNAL_TOTAL_OUT_OF_RANGE",

          message: `External shrinkage on ${date} must be below 100%.`,
        });
      }

      if (
        totals.combined >= 100
      ) {
        errors.push({
          code:
            "COMBINED_TOTAL_OUT_OF_RANGE",

          message: `Combined shrinkage on ${date} must be below 100%.`,
        });
      }
      const compensationTotal =
        Number(totals.totalPaid || 0) +
        Number(
          totals.totalUnpaid || 0
        );

      const billingTotal =
        Number(
          totals.totalBillable || 0
        ) +
        Number(
          totals.totalNonBillable || 0
        );

      const stateTotal =
        Number(
          totals.totalProductive || 0
        ) +
        Number(
          totals.totalNonProductive || 0
        );

      if (
        Math.abs(
          compensationTotal -
            stateTotal
        ) > 0.02
      ) {
        errors.push({
          code:
            "COMPENSATION_SUMMARY_MISMATCH",

          message: `Paid and unpaid shrinkage classifications do not reconcile with the configured item total on ${date}.`,
        });
      }

      if (
        requireBillingReconciliation &&
        Math.abs(
          billingTotal -
            stateTotal
        ) > 0.02
      ) {
        errors.push({
          code:
            "BILLING_SUMMARY_MISMATCH",

          message: `Billable and non-billable shrinkage classifications do not reconcile with the configured item total on ${date}.`,
        });
      }
    }
  );

  return errors;
}

// ============================================
// SCHEMA-V3 CONFIGURATION
// ============================================

async function loadSchemaV3Items({
  db,
  capPlanId,
}) {
  const configuration =
    await db
      .collection(
        CONFIG_COLLECTION
      )
      .findOne({
        capPlan: capPlanId,
      });

  if (!configuration) {
    return {
      errors: [
        {
          code:
            "MISSING_SHRINKAGE_CONFIG",

          message:
            "Configure the capacity plan's shrinkage items before saving daily values.",
        },
      ],
    };
  }

  if (
    !Array.isArray(
      configuration.items
    ) ||
    configuration.items.length === 0
  ) {
    return {
      errors: [
        {
          code:
            "EMPTY_SHRINKAGE_CONFIG",

          message:
            "The capacity plan does not contain any configured shrinkage items.",
        },
      ],
    };
  }

  const categoryCodes = [
    ...new Set(
      configuration.items
        .map((item) =>
          normalizeCode(
            item.categoryCode
          )
        )
        .filter(Boolean)
    ),
  ];

  const categories =
    await db
      .collection(
        CATEGORY_COLLECTION
      )
      .find({
        code: {
          $in: categoryCodes,
        },
      })
      .toArray();

  const categoriesByCode =
    new Map(
      categories.map(
        (category) => [
          category.code,
          category,
        ]
      )
    );

  const errors = [];

  const items =
    configuration.items.map(
      (item) => {
        const categoryCode =
          normalizeCode(
            item.categoryCode
          );

        const category =
          categoriesByCode.get(
            categoryCode
          );

        if (!category) {
          errors.push({
            code:
              "UNKNOWN_CONFIG_CATEGORY",

            message: `Configured item "${item.name}" references unknown category "${categoryCode}".`,
          });
        }

        const state =
          normalizeText(
            item.state
          ).toLowerCase();

        const compensation =
          normalizeText(
            item.compensation
          ).toLowerCase();

        const billing =
          normalizeText(
            item.billing
          ).toLowerCase();

        if (
          !VALID_STATES.has(state)
        ) {
          errors.push({
            code:
              "INVALID_CONFIG_STATE",

            message: `Configured item "${item.name}" has an invalid productive state.`,
          });
        }

        if (
          !VALID_COMPENSATION.has(
            compensation
          )
        ) {
          errors.push({
            code:
              "INVALID_CONFIG_COMPENSATION",

            message: `Configured item "${item.name}" has an invalid compensation type.`,
          });
        }

        if (
          !VALID_BILLING.has(
            billing
          )
        ) {
          errors.push({
            code:
              "INVALID_CONFIG_BILLING",

            message: `Configured item "${item.name}" must be classified as billable or non-billable before its daily values can be saved.`,
          });
        }

        return {
          id: normalizeCode(
            item.id
          ),

          name:
            normalizeText(
              item.name
            ),

          categoryCode,

          categoryName:
            category?.name || "",

          layer:
            category?.layer || "",

          state,

          compensation,

          billing,
        };
      }
    );

  return {
    configuration,
    categories,
    items,
    errors,
  };
}

// ============================================
// DAILY DATA NORMALIZATION
// ============================================

function normalizeAndValidateData({
  rawData,
  dates,
  items,
}) {
  const errors = [];
  const data = {};

  if (
    !rawData ||
    typeof rawData !== "object" ||
    Array.isArray(rawData)
  ) {
    return {
      data: {},
      errors: [
        {
          code: "INVALID_DATA",
          message:
            "Daily shrinkage data must be an object.",
        },
      ],
    };
  }

  const knownItemIds =
    new Set(
      items.map(
        (item) => item.id
      )
    );

  Object.keys(rawData).forEach(
    (itemId) => {
      if (
        !knownItemIds.has(itemId)
      ) {
        errors.push({
          code:
            "UNKNOWN_ITEM_DATA",

          message: `Daily values reference unknown item ID "${itemId}".`,
        });
      }
    }
  );

  items.forEach((item) => {
    data[item.id] = {};

    dates.forEach((date) => {
      const rawValue =
        rawData?.[item.id]?.[
          date
        ] ?? 0;

      const numericValue =
        Number(rawValue);

      if (
        !Number.isFinite(
          numericValue
        )
      ) {
        errors.push({
          code:
            "NON_NUMERIC_VALUE",

          message: `${item.name} on ${date} must be numeric.`,
        });

        data[item.id][date] = 0;
        return;
      }

      if (
        numericValue < 0 ||
        numericValue > 100
      ) {
        errors.push({
          code:
            "VALUE_OUT_OF_RANGE",

          message: `${item.name} on ${date} must be between 0 and 100.`,
        });
      }

      data[item.id][date] =
        round2(numericValue);
    });
  });

  return {
    data,
    errors,
  };
}

// ============================================
// BUILD SCHEMA-V3 DOCUMENT
// ============================================

async function buildSchemaV3Document({
  db,
  capPlanId,
  payload,
}) {
  const week =
    normalizeWeekCode(
      payload?.week
    );

  const dates =
    normalizeDates(
      payload?.dates
    );

  const errors =
    validateWeekAndDates({
      week,
      dates,
    });

  const configurationResult =
    await loadSchemaV3Items({
      db,
      capPlanId,
    });

  errors.push(
    ...(
      configurationResult
        .errors || []
    )
  );

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  const items =
    configurationResult.items;

  const dataResult =
    normalizeAndValidateData({
      rawData: payload?.data,
      dates,
      items,
    });

  errors.push(
    ...dataResult.errors
  );

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  const summary =
    calculateSummary({
      dates,
      items,
      data: dataResult.data,
    });

  errors.push(
    ...validateSummary(
      summary,
      {
        requireBillingReconciliation:
          true,
      }
    )
  );

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  const summaryFlat =
    calculateSummaryFlat({
      dates,
      summary,
    });

  return {
    errors: [],

    document: {
      schemaVersion: 3,
      week,
      dates,

      data:
        dataResult.data,

      summary,
      summaryFlat,

      configUpdatedAt:
        configurationResult
          .configuration
          ?.updatedAt || null,

      internalCalculationMode:
        "interval-override-otherwise-daily-rate",
    },
  };
}

// ============================================
// SCHEMA-V2 COMPATIBILITY
//
// Temporary support for the current editor.
// This section will be removed after Phase 3.
// ============================================

function normalizeLegacyCategories(
  rawCategories
) {
  if (!Array.isArray(rawCategories)) {
    return [];
  }

  const categories = [];
  const seenIds = new Set();

  rawCategories.forEach(
    (category, index) => {
      const name =
        normalizeText(
          category?.name
        );

      const layer =
        normalizeText(
          category?.layer
        ).toLowerCase();

      if (
        !name ||
        !VALID_LAYERS.has(layer)
      ) {
        return;
      }

      const baseId =
        normalizeCode(
          category?.id ||
            `${layer}-${name}`
        ) ||
        `category-${index + 1}`;

      let id = baseId;
      let suffix = 2;

      while (seenIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      seenIds.add(id);

      categories.push({
        id,
        name,
        layer,

        isDefault:
          category?.isDefault ===
            true ||
          category?.def === true,
      });
    }
  );

  return categories;
}

function normalizeLegacyItems(
  rawItems
) {
  if (!Array.isArray(rawItems)) {
    return [];
  }

  const items = [];
  const seenIds = new Set();

  rawItems.forEach(
    (item, index) => {
      const name =
        normalizeText(
          item?.name
        );

      const layer =
        normalizeText(
          item?.layer ||
            item?.type
        ).toLowerCase();

      const category =
        normalizeText(
          item?.category
        );

      const state =
        normalizeText(
          item?.state ||
            "non-productive"
        ).toLowerCase();

      const compensation =
        normalizeText(
          item?.compensation ||
            item?.comp ||
            "paid"
        ).toLowerCase();

      if (!name) {
        return;
      }

      const baseId =
        normalizeCode(
          item?.id || name
        ) ||
        `item-${index + 1}`;

      let id = baseId;
      let suffix = 2;

      while (seenIds.has(id)) {
        id = `${baseId}-${suffix}`;
        suffix += 1;
      }

      seenIds.add(id);

      items.push({
        id,
        name,
        layer,
        category,
        state,
        compensation,
      });
    }
  );

  return items;
}

function validateLegacyStructure({
  categories,
  items,
}) {
  const errors = [];

  if (items.length === 0) {
    errors.push({
      code: "MISSING_ITEMS",
      message:
        "At least one shrinkage item is required.",
    });
  }

  const itemIds = new Set();
  const itemNames = new Set();

  const categoryKeys =
    new Set(
      categories.map(
        (category) =>
          `${category.layer}|${category.name.toLowerCase()}`
      )
    );

  items.forEach((item) => {
    if (
      itemIds.has(item.id)
    ) {
      errors.push({
        code:
          "DUPLICATE_ITEM_ID",

        message: `Item ID "${item.id}" is duplicated.`,
      });
    }

    itemIds.add(item.id);

    const itemNameKey =
      item.name.toLowerCase();

    if (
      itemNames.has(itemNameKey)
    ) {
      errors.push({
        code:
          "DUPLICATE_ITEM_NAME",

        message: `Item name "${item.name}" is duplicated.`,
      });
    }

    itemNames.add(itemNameKey);

    if (
      !VALID_LAYERS.has(
        item.layer
      )
    ) {
      errors.push({
        code: "INVALID_LAYER",
        message: `Item "${item.name}" must be internal or external.`,
      });
    }

    if (
      !VALID_STATES.has(
        item.state
      )
    ) {
      errors.push({
        code: "INVALID_STATE",
        message: `Item "${item.name}" has an invalid productive state.`,
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

        message: `Item "${item.name}" has an invalid compensation type.`,
      });
    }

    const categoryKey =
      `${item.layer}|${item.category.toLowerCase()}`;

    if (
      !categoryKeys.has(
        categoryKey
      )
    ) {
      errors.push({
        code:
          "UNKNOWN_CATEGORY",

        message: `Category "${item.category}" is not defined for the ${item.layer} layer.`,
      });
    }
  });

  return errors;
}

function buildSchemaV2Document(
  payload
) {
  const week =
    normalizeWeekCode(
      payload?.week
    );

  const dates =
    normalizeDates(
      payload?.dates
    );

  const categories =
    normalizeLegacyCategories(
      payload?.categories
    );

  const items =
    normalizeLegacyItems(
      payload?.items
    );

  const errors = [
    ...validateWeekAndDates({
      week,
      dates,
    }),

    ...validateLegacyStructure({
      categories,
      items,
    }),
  ];

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  const dataResult =
    normalizeAndValidateData({
      rawData: payload?.data,
      dates,
      items,
    });

  errors.push(
    ...dataResult.errors
  );

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  const summary =
    calculateSummary({
      dates,
      items,
      data: dataResult.data,
    });

  errors.push(
    ...validateSummary(summary)
  );

  if (errors.length > 0) {
    return {
      errors,
    };
  }

  return {
    errors: [],

    document: {
      schemaVersion: 2,
      week,
      dates,
      categories,
      items,

      data:
        dataResult.data,

      summary,

      summaryFlat:
        calculateSummaryFlat({
          dates,
          summary,
        }),

      internalCalculationMode:
        "interval-override-otherwise-daily-rate",
    },
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
      return res.status(401).json({
        message:
          verification.message ||
          "A valid session is required.",
      });
    }

    const capPlanId =
      normalizeText(
        query.capPlan
      );

    if (!capPlanId) {
      return res.status(400).json({
        message:
          "Missing capPlan parameter.",
      });
    }

    const collection =
      db.collection(
        PLAN_COLLECTION
      );

    // ========================================
    // GET
    // ========================================

    if (method === "GET") {
      const filter = {
        capPlan: capPlanId,
      };

      if (query.week) {
        const week =
          normalizeWeekCode(
            query.week
          );

        if (!week) {
          return res.status(400).json({
            message:
              "Invalid week parameter.",
          });
        }

        filter.week = week;
      }

      const plans =
        await collection
          .find(filter)
          .sort({
            week: 1,
          })
          .toArray();

      const dateSummary = {};

      plans.forEach((plan) => {
        Object.entries(
          plan.summary || {}
        ).forEach(
          ([date, daily]) => {
            dateSummary[date] =
              daily;
          }
        );

        if (
          plan.week &&
          plan.summaryFlat
        ) {
          dateSummary[
            `week:${plan.week}`
          ] = plan.summaryFlat;
        }
      });

      return res.status(200).json({
        message: `Found ${plans.length} shrinkage plan(s).`,

        data: plans,
        dateSummary,
      });
    }

    // ========================================
    // POST / PUT
    // ========================================

    if (
      method === "POST" ||
      method === "PUT"
    ) {
      const permitted =
        await hasManagerPermission(
          db,
          authorization
        );

      if (!permitted) {
        return res.status(403).json({
          message:
            "Manager permission is required to save shrinkage plans.",
        });
      }

      if (!body?.payload) {
        return res.status(400).json({
          message:
            "A shrinkage payload is required.",
        });
      }

      const requestedVersion =
        Number(
          body.payload
            .schemaVersion
        ) === 3
          ? 3
          : 2;

      const buildResult =
        requestedVersion === 3
          ? await buildSchemaV3Document({
              db,
              capPlanId,
              payload:
                body.payload,
            })
          : buildSchemaV2Document(
              body.payload
            );

      if (
        buildResult.errors.length >
        0
      ) {
        return res.status(422).json({
          message:
            "Shrinkage plan validation failed.",

          schemaVersion:
            requestedVersion,

          validation: {
            errors:
              buildResult.errors,
          },
        });
      }

      const now = new Date();

      const username =
        getUsername(
          verification
        );

      const document =
        buildResult.document;

      const updateDocument = {
        $set: {
          capPlan: capPlanId,
          ...document,

          updatedAt: now,
          updatedBy: username,
        },

        $setOnInsert: {
          createdAt: now,
          createdBy: username,
        },
      };

      if (requestedVersion === 3) {
        updateDocument.$unset = {
          items: "",
          categories: "",
        };
      }

      const result =
        await collection.updateOne(
          {
            capPlan: capPlanId,
            week: document.week,
          },

          updateDocument,

          {
            upsert: true,
          }
        );

      const savedPlan =
        await collection.findOne({
          capPlan: capPlanId,
          week: document.week,
        });

      return res.status(200).json({
        message:
          requestedVersion === 3
            ? "Schema-v3 shrinkage plan saved."
            : "Legacy schema-v2 shrinkage plan saved.",

        data: savedPlan,

        result: {
          matchedCount:
            result.matchedCount,

          modifiedCount:
            result.modifiedCount,

          upsertedId:
            result.upsertedId,
        },
      });
    }

    // ========================================
    // DELETE
    // ========================================

    if (method === "DELETE") {
      const permitted =
        await hasAdminPermission(
          db,
          authorization
        );

      if (!permitted) {
        return res.status(403).json({
          message:
            "Administrator permission is required to delete shrinkage plans.",
        });
      }

      const deleteFilter = {
        capPlan: capPlanId,
      };

      if (query.week) {
        const week =
          normalizeWeekCode(
            query.week
          );

        if (!week) {
          return res.status(400).json({
            message:
              "Invalid week parameter.",
          });
        }

        deleteFilter.week = week;
      }

      const result =
        await collection.deleteMany(
          deleteFilter
        );

      return res.status(200).json({
        message: `Deleted ${result.deletedCount} shrinkage plan(s).`,

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
      "Shrinkage API error:",
      error
    );

    return res.status(500).json({
      message:
        "The shrinkage request could not be completed.",
    });
  }
}