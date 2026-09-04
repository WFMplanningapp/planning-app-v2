export const CAPACITY_SCHEMA_VERSION = 2;

const CAPACITY_LEVELS = [
  "gross",
  "inCenter",
  "productive",
];

const hasOwn = (object, property) =>
  Object.prototype.hasOwnProperty.call(
    object || {},
    property
  );

const toNumberOrNull = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : Number(value);

  return Number.isFinite(numericValue)
    ? numericValue
    : null;
};

const getDateValue = (value) => {
  if (
    value &&
    typeof value === "object" &&
    "$date" in value
  ) {
    return value.$date;
  }

  return value;
};

const toDateStringOrNull = (value) => {
  const dateValue = getDateValue(value);

  if (
    dateValue === null ||
    dateValue === undefined ||
    dateValue === ""
  ) {
    return null;
  }

  const date =
    dateValue instanceof Date
      ? new Date(dateValue.getTime())
      : new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().split("T")[0];
};

const toStringOrNull = (value) => {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text = String(value).trim();

  return text === "" ? null : text;
};

const getWeekCode = (weekly) => {
  if (
    typeof weekly?.week === "string"
  ) {
    return toStringOrNull(weekly.week);
  }

  return toStringOrNull(
    weekly?.week?.code
  );
};

const getPeriodDate = (
  weekly,
  field
) => {
  if (weekly?.week?.[field] !== undefined) {
    return weekly.week[field];
  }

  if (field === "firstDate") {
    return weekly?.firstDate;
  }

  return null;
};

const calculateGap = (
  availability,
  requirement
) => {
  if (
    availability === null ||
    requirement === null
  ) {
    return null;
  }

  return availability - requirement;
};

const getRequirementSource = (
  weekly,
  level
) => {
  const structuredSource =
    weekly?.requirementSources?.[level];

  if (
    structuredSource !== null &&
    structuredSource !== undefined &&
    structuredSource !== ""
  ) {
    return String(structuredSource);
  }

  return toStringOrNull(
    weekly?.reqSource
  );
};

const getValueStatus = ({
  weekly,
  level,
  value,
}) => {
  if (value === null) {
    return "missing";
  }

  if (level === "gross") {
    return "available";
  }

  if (
    weekly?.availabilitySource ===
    "actual"
  ) {
    return weekly?.hasActual
      ? "confirmed"
      : "derived";
  }

  if (
    weekly?.availabilitySource ===
    "planned"
  ) {
    return weekly?.hasPlanned
      ? "confirmed"
      : "derived";
  }

  return "available";
};

const createAvailabilityLevel = ({
  weekly,
  level,
  selectedField,
  plannedField,
  actualField,
}) => {
  const selected = toNumberOrNull(
    weekly?.[selectedField]
  );

  const planned = toNumberOrNull(
    weekly?.[plannedField]
  );

  const actual = actualField
    ? toNumberOrNull(
        weekly?.[actualField]
      )
    : null;

  return {
    value: selected,
    source:
      toStringOrNull(
        weekly?.availabilitySource
      ),
    status: getValueStatus({
      weekly,
      level,
      value: selected,
    }),
    planned,
    actual,
    legacyFields: {
      selected: selectedField,
      planned: plannedField,
      actual: actualField,
    },
  };
};

const createRequirementLevel = ({
  weekly,
  level,
  valueField,
  manualField,
  engineField,
}) => ({
  value: toNumberOrNull(
    weekly?.[valueField]
  ),
  source: getRequirementSource(
    weekly,
    level
  ),
  manual: toNumberOrNull(
    weekly?.[manualField]
  ),
  engine: toNumberOrNull(
    weekly?.[engineField]
  ),
  isOverride:
    weekly?.engineOverride === true,
  legacyFields: {
    value: valueField,
    manual: manualField,
    engine: engineField,
  },
});

const collectMissingFields = (
  canonicalWeek
) => {
  const missing = [];

  if (!canonicalWeek.period.code) {
    missing.push("period.code");
  }

  if (!canonicalWeek.period.startDate) {
    missing.push("period.startDate");
  }

  for (const level of CAPACITY_LEVELS) {
    if (
      canonicalWeek.availability[level]
        .value === null
    ) {
      missing.push(
        `availability.${level}.value`
      );
    }

    if (
      canonicalWeek.requirements[level]
        .value === null
    ) {
      missing.push(
        `requirements.${level}.value`
      );
    }
  }

  return missing;
};

export const toCanonicalCapacityWeek = (
  weekly,
  context = {}
) => {
  const source =
    weekly &&
    typeof weekly === "object"
      ? weekly
      : {};

  const grossAvailability =
    createAvailabilityLevel({
      weekly: source,
      level: "gross",
      selectedField:
        "compositeGrossFTE",
      plannedField: "totalFTE",
      actualField: null,
    });

  const inCenterAvailability =
    createAvailabilityLevel({
      weekly: source,
      level: "inCenter",
      selectedField:
        "compositeInCenterFTE",
      plannedField: "expectedFTE",
      actualField: "actualFTE",
    });

  const productiveAvailability =
    createAvailabilityLevel({
      weekly: source,
      level: "productive",
      selectedField:
        "compositeProductiveFTE",
      plannedField: "PlanProdFTE",
      actualField: "ActProdFTE",
    });

  const grossRequirement =
    createRequirementLevel({
      weekly: source,
      level: "gross",
      valueField: "grossRequirement",
      manualField: "manualGrossReq",
      engineField: "engineGrossReq",
    });

  const inCenterRequirement =
    createRequirementLevel({
      weekly: source,
      level: "inCenter",
      valueField:
        "inCenterRequirement",
      manualField:
        "manualInCenterReq",
      engineField:
        "engineInCenterReq",
    });

  const productiveRequirement =
    createRequirementLevel({
      weekly: source,
      level: "productive",
      valueField:
        "productiveRequirement",
      manualField:
        "manualProductiveReq",
      engineField:
        "engineProductiveReq",
    });

  const canonicalWeek = {
    schemaVersion:
      CAPACITY_SCHEMA_VERSION,

    identity: {
      capacityPlanId:
        toStringOrNull(
          context.capacityPlanId
        ) ||
        toStringOrNull(
          source.capPlanId
        ) ||
        toStringOrNull(
          source.capPlan
        ),
      capacityPlanName:
        toStringOrNull(
          context.capacityPlanName
        ) ||
        toStringOrNull(
          source.capPlanName
        ),
    },

    period: {
      code: getWeekCode(source),
      startDate: toDateStringOrNull(
        getPeriodDate(
          source,
          "firstDate"
        )
      ),
      endDate: toDateStringOrNull(
        getPeriodDate(
          source,
          "lastDate"
        )
      ),
      type:
        toStringOrNull(
          source.periodType
        ) || "unknown",
      availabilitySource:
        toStringOrNull(
          source.availabilitySource
        ),
    },

    staffing: {
      headcount: toNumberOrNull(
        source.totalHC
      ),
      trainees: toNumberOrNull(
        source.trainees
      ),
      nesting: toNumberOrNull(
        source.nesting
      ),
      leaveOfAbsence:
        toNumberOrNull(
          source.inLOA
        ),
    },

    availability: {
      gross: grossAvailability,
      inCenter:
        inCenterAvailability,
      productive:
        productiveAvailability,
    },

    requirements: {
      gross: grossRequirement,
      inCenter:
        inCenterRequirement,
      productive:
        productiveRequirement,
    },

    gaps: {
      gross: calculateGap(
        grossAvailability.value,
        grossRequirement.value
      ),
      inCenter: calculateGap(
        inCenterAvailability.value,
        inCenterRequirement.value
      ),
      productive: calculateGap(
        productiveAvailability.value,
        productiveRequirement.value
      ),
    },

    shrinkage: {
      hasShrinkage:
        source.hasShrinkage === true,
      hasPlanned:
        source.hasPlanned === true,
      hasActual:
        source.hasActual === true,
      planned: {
        absence: toNumberOrNull(
          source.pAbs
        ),
        auxiliary: toNumberOrNull(
          source.pAux
        ),
        timeOff: toNumberOrNull(
          source.pOff
        ),
      },
    },

    forecast: {
      fte: toNumberOrNull(
        source.fcFTE
      ),
      attritionPercent:
        toNumberOrNull(
          source.fcAttrition
        ),
      variance: toNumberOrNull(
        source.fcVar
      ),
    },

    engine: {
      source: toStringOrNull(
        source.engineSource
      ),
      calculatedAt:
        toDateStringOrNull(
          source.engineCalculatedAt
        ),
      requirementVariance:
        toNumberOrNull(
          source.engineReqVar
        ),
      billingVariance:
        toNumberOrNull(
          source.engineBillVar
        ),
      hours: {
        gross: toNumberOrNull(
          source.engineHoursGross
        ),
        inCenter: toNumberOrNull(
          source.engineHoursInCenter
        ),
        productive:
          toNumberOrNull(
            source.engineHoursProductive
          ),
      },
    },

    notes: {
      comment:
        toStringOrNull(
          source.comment
        ),
    },

    dataQuality: {
      missingFields: [],
      hasLegacyWeekObject:
        Boolean(
          source.week &&
            typeof source.week ===
              "object"
        ),
      preservedZeroValues: true,
    },
  };

  canonicalWeek.dataQuality.missingFields =
    collectMissingFields(
      canonicalWeek
    );

  canonicalWeek.dataQuality.isComplete =
    canonicalWeek.dataQuality
      .missingFields.length === 0;

  canonicalWeek.dataQuality.hasSourceData =
    hasOwn(source, "week") ||
    hasOwn(source, "firstDate");

  return canonicalWeek;
};

export const toCanonicalCapacity = (
  weeklyCapacity,
  context = {}
) => {
  if (!Array.isArray(weeklyCapacity)) {
    return [];
  }

  return weeklyCapacity.map((weekly) =>
    toCanonicalCapacityWeek(
      weekly,
      context
    )
  );
};
