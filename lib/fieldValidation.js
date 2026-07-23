// lib/fieldValidation.js

const FIELD_RULES = {
  // Headcount
  attrition:      { type: "number", allowNegative: false },
  fcAttrition:    { type: "number", allowNegative: false, min: 0, max: 100 },
  moveIN:         { type: "number", allowNegative: false },
  moveOUT:        { type: "number", allowNegative: false },
  loaIN:          { type: "number", allowNegative: false },
  loaOUT:         { type: "number", allowNegative: false },
  rwsIN:          { type: "number", allowNegative: false },
  rwsOUT:         { type: "number", allowNegative: false },
  rampDown:       { type: "number", allowNegative: false },
  overtimeFTE:    { type: "number", allowNegative: false },

  // Training
  trCommit:       { type: "number", allowNegative: false },
  trGap:          { type: "number", allowNegative: true },
  trAttrition:    { type: "number", allowNegative: false },
  ocpAttrition:   { type: "number", allowNegative: false },
  trWeeks:        { type: "number", allowNegative: false },
  ocpWeeks:       { type: "number", allowNegative: false },
  ocpProductivityPercent: { type: "number", allowNegative: false, min: 0, max: 100 },

  // Targets
  grossRequirement:      { type: "number", allowNegative: false },
  inCenterRequirement:   { type: "number", allowNegative: false },
  productiveRequirement: { type: "number", allowNegative: false },
  budget:                { type: "number", allowNegative: false },

  // Actuals
  actVac:    { type: "number", allowNegative: false, min: 0, max: 100 },
  actAbs:    { type: "number", allowNegative: false, min: 0, max: 100 },
  actAux:    { type: "number", allowNegative: false, min: 0, max: 100 },

  // Planned
  plannedVac:  { type: "number", allowNegative: false, min: 0, max: 100 },
  plannedAbs:  { type: "number", allowNegative: false, min: 0, max: 100 },
  plannedAux:  { type: "number", allowNegative: false, min: 0, max: 100 },

  // Comment
  Comment: { type: "disabled" },
};

// Fields that should not be validated (identifiers/metadata)
const SKIP_FIELDS = [
  'capPlan', 'lob', 'project', 'week', '_id',
  'lastUpdated', 'updatedBy', 'updateType',
  'totalHC', 'totalFTE',
];

/**
 * Validates a single field value.
 * Returns { valid: boolean, error: string|null }
 */
function validateFieldValue(field, rawValue) {
  const rules = FIELD_RULES[field];

  // No rules defined — accept (could be a new/custom field)
  if (!rules) {
    return { valid: true, error: null };
  }

  if (rules.type === "disabled") {
    return { valid: false, error: "This field is disabled" };
  }

  // Allow empty
  if (rawValue === "" || rawValue === undefined || rawValue === null) {
    return { valid: true, error: null };
  }

  // Allow "delete" keyword
  if (rawValue === "delete") {
    return { valid: true, error: null };
  }

  const str = String(rawValue).trim();

  // Allow typing just "-" for negative-allowed fields (frontend partial input)
  if (rules.allowNegative && str === "-") {
    return { valid: true, error: null };
  }

  // Regex: optional negative, digits with optional decimal
  const negPrefix = rules.allowNegative ? "-?" : "";
  const pattern = new RegExp(`^${negPrefix}(\\d+\\.?\\d*|\\.\\d+)$`);

  if (!pattern.test(str)) {
    if (rules.allowNegative) {
      return { valid: false, error: "Only numbers allowed (negatives OK)" };
    }
    return { valid: false, error: "Only positive numbers allowed" };
  }

  const num = parseFloat(str);
  if (!isNaN(num)) {
    if (!rules.allowNegative && num < 0) {
      return { valid: false, error: "Only positive numbers allowed" };
    }
    if (rules.min !== undefined && rules.min !== null && num < rules.min) {
      return { valid: false, error: `Minimum value is ${rules.min}` };
    }
    if (rules.max !== undefined && rules.max !== null && num > rules.max) {
      return { valid: false, error: `Maximum value is ${rules.max}` };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validates an entire payload object.
 * Returns { valid: boolean, errors: [{ field, value, error }] }
 */
function validatePayload(payload) {
  const errors = [];

  Object.keys(payload).forEach((field) => {
    if (SKIP_FIELDS.includes(field)) return;

    const value = payload[field];
    if (value === "" || value === undefined || value === null) return;

    const { valid, error } = validateFieldValue(field, String(value).trim());
    if (!valid) {
      errors.push({ field, value, error });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validates an array of payloads (for bulk upload).
 * Returns { valid: boolean, invalidRows: [{ rowIndex, errors }], errorCount: number }
 */
function validateBulkPayloads(payloads) {
  const invalidRows = [];

  payloads.forEach((payload, index) => {
    const { valid, errors } = validatePayload(payload);
    if (!valid) {
      invalidRows.push({ rowIndex: index + 1, errors });
    }
  });

  return {
    valid: invalidRows.length === 0,
    invalidRows,
    errorCount: invalidRows.reduce((sum, row) => sum + row.errors.length, 0),
  };
}

module.exports = {
  FIELD_RULES,
  SKIP_FIELDS,
  validateFieldValue,
  validatePayload,
  validateBulkPayloads,
};