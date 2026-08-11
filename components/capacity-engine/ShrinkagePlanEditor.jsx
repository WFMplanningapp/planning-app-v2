// ============================================
// SHRINKAGE PLAN EDITOR
// Schema v3 — Scalable daily grid
//
// Dates are rows.
// Configured shrinkage items are columns.
// Categories are managed by administrators.
// ============================================

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaChevronDown,
  FaChevronRight,
  FaCopy,
  FaCog,
  FaInfoCircle,
  FaSave,
  FaSync,
  FaTimes,
} from "react-icons/fa";

import {
  useAuth,
} from "../../contexts/authContext";

import ShrinkageItemConfigModal from "./ShrinkageItemConfigModal";

// ============================================
// GENERAL HELPERS
// ============================================

const round2 = (value) =>
  Math.round(
    (Number(value) +
      Number.EPSILON) *
      100
  ) / 100;

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeWeekCode = (
  value
) => {
  const text =
    normalizeText(value);

  const match = text.match(
    /^(\d{4})[wW](\d{1,2})$/
  );

  if (!match) {
    return text;
  }

  return `${match[1]}w${String(
    Number(match[2])
  ).padStart(2, "0")}`;
};

const toISODate = (value) => {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(
      value
    )
  ) {
    return value.slice(0, 10);
  }

  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date
    .toISOString()
    .slice(0, 10);
};

const addDaysUTC = (
  dateString,
  numberOfDays
) => {
  if (!dateString) {
    return null;
  }

  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  date.setUTCDate(
    date.getUTCDate() +
      numberOfDays
  );

  return date
    .toISOString()
    .slice(0, 10);
};

const getWeekDates = (
  weekDoc
) => {
  const firstDate =
    toISODate(
      weekDoc?.firstDate
    );

  if (!firstDate) {
    return [];
  }

  return Array.from(
    {
      length: 7,
    },
    (_, index) =>
      addDaysUTC(
        firstDate,
        index
      )
  );
};

const formatDate = (dateString) => {
  if (!dateString) {
    return "";
  }

  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }
  );
};

const formatDay = (
  dateString
) => {
  if (!dateString) {
    return "";
  }

  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: "short",
      timeZone: "UTC",
    }
  );
};

const formatWeekRange = (
  week
) => {
  if (
    !week?.dates?.length
  ) {
    return "";
  }

  return `${formatDate(
    week.dates[0]
  )} – ${formatDate(
    week.dates[
      week.dates.length - 1
    ]
  )}`;
};

const normalizePercentage = (
  value
) => {
  if (
    value === "" ||
    value === null ||
    value === undefined
  ) {
    return 0;
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(
      numericValue
    )
  ) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numericValue
    )
  );
};

const getApiErrorMessage = (
  responseData,
  fallback
) => {
  const validationErrors =
    responseData?.validation
      ?.errors;

  if (
    Array.isArray(
      validationErrors
    ) &&
    validationErrors.length > 0
  ) {
    return validationErrors
      .slice(0, 5)
      .map(
        (error) =>
          error.message ||
          String(error)
      )
      .join(" | ");
  }

  return (
    responseData?.message ||
    fallback
  );
};

// ============================================
// SUMMARY CALCULATION
// ============================================

const calculateDateSummary = (
  date,
  items,
  values
) => {
  let internal = 0;
  let external = 0;

  items.forEach((item) => {
    const numericValue = Number(
      values?.[item.id]?.[
        date
      ] ?? 0
    );

    const value =
      Number.isFinite(
        numericValue
      )
        ? numericValue
        : 0;

    if (
      item.layer ===
      "internal"
    ) {
      internal += value;
    } else if (
      item.layer ===
      "external"
    ) {
      external += value;
    }
  });

  const combined =
    (
      1 -
      (1 - internal / 100) *
        (1 - external / 100)
    ) * 100;

  return {
    internal:
      round2(internal),

    external:
      round2(external),

    combined:
      round2(combined),
  };
};

// ============================================
// COMPONENT
// ============================================

export default function ShrinkagePlanEditor({
  capPlanId,
  weekDocs,
}) {
  const auth = useAuth();

  // ==========================================
  // STATE
  // ==========================================

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    items,
    setItems,
  ] = useState([]);

  const [
    values,
    setValues,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    savingConfiguration,
    setSavingConfiguration,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState(null);

  const [
    configOpen,
    setConfigOpen,
  ] = useState(false);

  const [
    configurationPersisted,
    setConfigurationPersisted,
  ] = useState(false);

  const [
    migrationRequired,
    setMigrationRequired,
  ] = useState(false);

  const [
    layerFilter,
    setLayerFilter,
  ] = useState("all");

  const [
    collapsedWeeks,
    setCollapsedWeeks,
  ] = useState(
    new Set()
  );

  // ==========================================
  // WEEK STRUCTURE
  // ==========================================

  const weeks = useMemo(
    () =>
      (weekDocs || [])
        .map((weekDoc) => ({
          code:
            normalizeWeekCode(
              weekDoc?.code
            ),

          dates:
            getWeekDates(
              weekDoc
            ),

          source: weekDoc,
        }))
        .filter(
          (week) =>
            week.code &&
            week.dates.length ===
              7
        ),
    [weekDocs]
  );

  const weekCodes =
    useMemo(
      () =>
        weeks.map(
          (week) =>
            week.code
        ),
      [weeks]
    );

  const allDates =
    useMemo(
      () =>
        [
          ...new Set(
            weeks.flatMap(
              (week) =>
                week.dates
            )
          ),
        ].sort(),
      [weeks]
    );

  const weekDependency =
    weekCodes.join(",");

  // ==========================================
  // DISPLAYED ITEMS
  // ==========================================

  const visibleItems =
    useMemo(
      () =>
        layerFilter === "all"
          ? items
          : items.filter(
              (item) =>
                item.layer ===
                layerFilter
            ),
      [items, layerFilter]
    );

  const internalItemCount =
    items.filter(
      (item) =>
        item.layer ===
        "internal"
    ).length;

  const externalItemCount =
    items.filter(
      (item) =>
        item.layer ===
        "external"
    ).length;

  // ==========================================
  // INITIALIZE VALUE STRUCTURE
  // ==========================================

  const initializeValues = (
    sourceItems,
    sourceValues = {}
  ) => {
    const initialized = {};

    sourceItems.forEach(
      (item) => {
        initialized[item.id] = {};

        allDates.forEach(
          (date) => {
            initialized[item.id][
              date
            ] =
              normalizePercentage(
                sourceValues?.[
                  item.id
                ]?.[date] ?? 0
              );
          }
        );
      }
    );

    return initialized;
  };

  // ==========================================
  // LOAD CONFIGURATION AND VALUES
  // ==========================================

  const loadEditor = async () => {
    if (
      !capPlanId ||
      weekCodes.length === 0
    ) {
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const authorization =
        auth.authorization();

      const [
        configurationResponse,
        plansResponse,
      ] = await Promise.all([
        fetch(
          `/api/capacity-engine/shrinkage-config?capPlan=${encodeURIComponent(
            capPlanId
          )}`,
          {
            headers: {
              Authorization:
                authorization,
            },
          }
        ),

        fetch(
          `/api/capacity-engine/shrinkage?capPlan=${encodeURIComponent(
            capPlanId
          )}`,
          {
            headers: {
              Authorization:
                authorization,
            },
          }
        ),
      ]);

      const configurationData =
        await configurationResponse.json();

      const plansData =
        await plansResponse.json();

      if (
        !configurationResponse.ok
      ) {
        throw new Error(
          getApiErrorMessage(
            configurationData,
            "Shrinkage configuration could not be loaded."
          )
        );
      }

      if (!plansResponse.ok) {
        throw new Error(
          getApiErrorMessage(
            plansData,
            "Shrinkage values could not be loaded."
          )
        );
      }

      const loadedCategories =
        Array.isArray(
          configurationData
            .categories
        )
          ? configurationData
              .categories
          : [];

      const loadedConfiguration =
        configurationData.data ||
        {};

      const loadedItems =
        Array.isArray(
          loadedConfiguration
            .enrichedItems
        )
          ? loadedConfiguration
              .enrichedItems
          : [];

      const relevantPlans =
        (
          Array.isArray(
            plansData.data
          )
            ? plansData.data
            : []
        ).filter((plan) =>
          weekCodes.includes(
            normalizeWeekCode(
              plan?.week
            )
          )
        );

      const loadedValues = {};

      loadedItems.forEach(
        (item) => {
          loadedValues[
            item.id
          ] = {};
        }
      );

      relevantPlans.forEach(
        (plan) => {
          Object.entries(
            plan?.data || {}
          ).forEach(
            ([
              itemId,
              dateValues,
            ]) => {
              if (
                !loadedValues[
                  itemId
                ]
              ) {
                return;
              }

              Object.entries(
                dateValues || {}
              ).forEach(
                ([
                  date,
                  rawValue,
                ]) => {
                  const isoDate =
                    toISODate(date);

                  if (
                    !isoDate ||
                    !allDates.includes(
                      isoDate
                    )
                  ) {
                    return;
                  }

                  loadedValues[
                    itemId
                  ][isoDate] =
                    normalizePercentage(
                      rawValue
                    );
                }
              );
            }
          );
        }
      );

      const nextValues =
        initializeValues(
          loadedItems,
          loadedValues
        );

      const legacyPlansExist =
        relevantPlans.some(
          (plan) =>
            Number(
              plan?.schemaVersion
            ) !== 3
        );

      const requiresMigration =
        loadedConfiguration
          .migrationRequired ===
          true ||
        legacyPlansExist;

      setCategories(
        loadedCategories
      );

      setItems(
        loadedItems
      );

      setValues(
        nextValues
      );

      setConfigurationPersisted(
        loadedConfiguration
          .source ===
          "schema-v3"
      );

      setMigrationRequired(
        requiresMigration
      );

      setCollapsedWeeks(
        new Set()
      );

      if (
        loadedItems.length === 0
      ) {
        setMessage({
          type: "warning",
          text:
            "No shrinkage items are configured for this capacity plan. Open Configure Shrinkage to create the item setup.",
        });
      }
    } catch (error) {
      console.error(
        "Failed to load shrinkage editor:",
        error
      );

      setMessage({
        type: "danger",

        text:
          error.message ||
          "The shrinkage editor could not be loaded.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (
      capPlanId &&
      weekCodes.length > 0
    ) {
      loadEditor();
    }

    // The editor reloads when the selected
    // capacity plan or week range changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    capPlanId,
    weekDependency,
  ]);

  // ==========================================
  // CONFIGURATION SAVE
  // ==========================================

  const saveConfiguration =
    async (newItems) => {
      setSavingConfiguration(
        true
      );

      try {
        const response =
          await fetch(
            `/api/capacity-engine/shrinkage-config?capPlan=${encodeURIComponent(
              capPlanId
            )}`,
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  auth.authorization(),
              },

              body: JSON.stringify({
                payload: {
                  items: newItems,
                },
              }),
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(
              responseData,
              "The shrinkage configuration could not be saved."
            )
          );
        }

        const savedItems =
          Array.isArray(
            responseData?.data
              ?.enrichedItems
          )
            ? responseData.data
                .enrichedItems
            : [];

        setCategories(
          Array.isArray(
            responseData.categories
          )
            ? responseData.categories
            : categories
        );

        setItems(savedItems);

        setValues(
          (currentValues) =>
            initializeValues(
              savedItems,
              currentValues
            )
        );

        setConfigurationPersisted(
          true
        );

        setConfigOpen(false);

        setMessage({
          type: "success",
          text:
            "Shrinkage item configuration saved. Save all weeks to apply the daily values using schema v3.",
        });
      } catch (error) {
        console.error(
          "Failed to save shrinkage configuration:",
          error
        );

        throw error;
      } finally {
        setSavingConfiguration(
          false
        );
      }
    };

  // ==========================================
  // VALUE MANAGEMENT
  // ==========================================

  const updateValue = (
    itemId,
    date,
    rawValue
  ) => {
    const value =
      normalizePercentage(
        rawValue
      );

    setValues(
      (current) => ({
        ...current,

        [itemId]: {
          ...(
            current[itemId] ||
            {}
          ),

          [date]: value,
        },
      })
    );
  };

  const setItemDates = (
    itemId,
    dates,
    value
  ) => {
    const normalizedValue =
      normalizePercentage(value);

    setValues(
      (current) => {
        const nextItemValues = {
          ...(
            current[itemId] ||
            {}
          ),
        };

        dates.forEach(
          (date) => {
            nextItemValues[
              date
            ] =
              normalizedValue;
          }
        );

        return {
          ...current,

          [itemId]:
            nextItemValues,
        };
      }
    );
  };

  // ==========================================
  // FILL ITEM ACROSS FULL RANGE
  // ==========================================

  const fillItemRange = (
    item
  ) => {
    const firstValue =
      allDates
        .map(
          (date) =>
            values?.[item.id]?.[
              date
            ]
        )
        .find(
          (value) =>
            Number(value) > 0
        ) ?? 0;

    const rawValue =
      window.prompt(
        `Set "${item.name}" for all ${allDates.length} visible dates:`,
        String(firstValue)
      );

    if (
      rawValue === null
    ) {
      return;
    }

    const numericValue =
      Number(rawValue);

    if (
      !Number.isFinite(
        numericValue
      ) ||
      numericValue < 0 ||
      numericValue > 100
    ) {
      setMessage({
        type: "danger",
        text:
          "Enter a numeric percentage between 0 and 100.",
      });

      return;
    }

    setItemDates(
      item.id,
      allDates,
      numericValue
    );

    setMessage({
      type: "info",
      text: `"${item.name}" was set to ${numericValue}% for all visible dates.`,
    });
  };

  const [
  showInternalTooltip,
  setShowInternalTooltip,
] = useState(false);

  // ==========================================
  // FILL ONE ITEM ACROSS ONE WEEK
  // ==========================================

  const fillWeekItem = (
    week
  ) => {
    if (items.length === 0) {
      return;
    }

    const itemList =
      items
        .map(
          (item, index) =>
            `${index + 1}. ${item.name}`
        )
        .join("\n");

    const selection =
      window.prompt(
        `Select the item to fill for ${week.code} by entering its number:\n\n${itemList}`,
        "1"
      );

    if (
      selection === null
    ) {
      return;
    }

    const itemIndex =
      Number(selection) - 1;

    const item =
      items[itemIndex];

    if (!item) {
      setMessage({
        type: "danger",
        text:
          "The selected item number is not valid.",
      });

      return;
    }

    const existingValue =
      week.dates
        .map(
          (date) =>
            values?.[item.id]?.[
              date
            ]
        )
        .find(
          (value) =>
            Number(value) > 0
        ) ?? 0;

    const rawValue =
      window.prompt(
        `Set "${item.name}" for all dates in ${week.code}:`,
        String(existingValue)
      );

    if (
      rawValue === null
    ) {
      return;
    }

    const numericValue =
      Number(rawValue);

    if (
      !Number.isFinite(
        numericValue
      ) ||
      numericValue < 0 ||
      numericValue > 100
    ) {
      setMessage({
        type: "danger",
        text:
          "Enter a numeric percentage between 0 and 100.",
      });

      return;
    }

    setItemDates(
      item.id,
      week.dates,
      numericValue
    );

    setMessage({
      type: "info",
      text: `"${item.name}" was set to ${numericValue}% for ${week.code}.`,
    });
  };

  // ==========================================
  // CLEAR WEEK
  // ==========================================

  const clearWeek = (
    week
  ) => {
    const confirmed =
      window.confirm(
        `Set every shrinkage item to 0% for all dates in ${week.code}?`
      );

    if (!confirmed) {
      return;
    }

    setValues(
      (current) => {
        const updated = {
          ...current,
        };

        items.forEach(
          (item) => {
            const itemValues = {
              ...(
                current[
                  item.id
                ] || {}
              ),
            };

            week.dates.forEach(
              (date) => {
                itemValues[
                  date
                ] = 0;
              }
            );

            updated[item.id] =
              itemValues;
          }
        );

        return updated;
      }
    );

    setMessage({
      type: "info",
      text: `${week.code} was cleared.`,
    });
  };

  // ==========================================
  // COPY WEEK
  // ==========================================

  const copyWeek = (
    sourceWeek
  ) => {
    const targetWeeks =
      weeks.filter(
        (week) =>
          week.code !==
          sourceWeek.code
      );

    if (
      targetWeeks.length === 0
    ) {
      setMessage({
        type: "warning",
        text:
          "No other target weeks are available.",
      });

      return;
    }

    const targetInput =
      window.prompt(
        `Enter the target week code:\n\n${targetWeeks
          .map(
            (week) =>
              week.code
          )
          .join(", ")}`
      );

    if (!targetInput) {
      return;
    }

    const targetCode =
      normalizeWeekCode(
        targetInput
      );

    const targetWeek =
      targetWeeks.find(
        (week) =>
          week.code ===
          targetCode
      );

    if (!targetWeek) {
      setMessage({
        type: "danger",
        text: `Target week "${targetInput}" is not available.`,
      });

      return;
    }

    const confirmed =
      window.confirm(
        `Replace all shrinkage values in ${targetWeek.code} with values from ${sourceWeek.code}?`
      );

    if (!confirmed) {
      return;
    }

    setValues(
      (current) => {
        const updated = {
          ...current,
        };

        items.forEach(
          (item) => {
            const itemValues = {
              ...(
                current[
                  item.id
                ] || {}
              ),
            };

            sourceWeek.dates.forEach(
              (
                sourceDate,
                dayIndex
              ) => {
                const targetDate =
                  targetWeek.dates[
                    dayIndex
                  ];

                itemValues[
                  targetDate
                ] = Number(
                  current?.[
                    item.id
                  ]?.[
                    sourceDate
                  ] ?? 0
                );
              }
            );

            updated[item.id] =
              itemValues;
          }
        );

        return updated;
      }
    );

    setMessage({
      type: "info",
      text: `${sourceWeek.code} was copied to ${targetWeek.code}.`,
    });
  };

  // ==========================================
  // COLLAPSE WEEK
  // ==========================================

  const toggleWeek = (
    weekCode
  ) => {
    setCollapsedWeeks(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(weekCode)
        ) {
          next.delete(
            weekCode
          );
        } else {
          next.add(
            weekCode
          );
        }

        return next;
      }
    );
  };

  const collapseAll = () => {
    setCollapsedWeeks(
      new Set(weekCodes)
    );
  };

  const expandAll = () => {
    setCollapsedWeeks(
      new Set()
    );
  };

  // ==========================================
  // VALIDATION
  // ==========================================

  const validateBeforeSave =
    () => {
      const errors = [];

      if (
        !configurationPersisted
      ) {
        errors.push(
          "Apply the shrinkage item configuration before saving daily values."
        );
      }

      if (
        items.length === 0
      ) {
        errors.push(
          "At least one shrinkage item is required."
        );
      }

      allDates.forEach(
        (date) => {
          items.forEach(
            (item) => {
              const value =
                Number(
                  values?.[
                    item.id
                  ]?.[
                    date
                  ] ?? 0
                );

              if (
                !Number.isFinite(
                  value
                ) ||
                value < 0 ||
                value > 100
              ) {
                errors.push(
                  `${item.name} on ${date} must be between 0 and 100.`
                );
              }
            }
          );

          const summary =
            calculateDateSummary(
              date,
              items,
              values
            );

          if (
            summary.internal >=
            100
          ) {
            errors.push(
              `Internal shrinkage on ${date} must be below 100%.`
            );
          }

          if (
            summary.external >=
            100
          ) {
            errors.push(
              `External shrinkage on ${date} must be below 100%.`
            );
          }

          if (
            summary.combined >=
            100
          ) {
            errors.push(
              `Combined shrinkage on ${date} must be below 100%.`
            );
          }
        }
      );

      return errors;
    };

  // ==========================================
  // BUILD WEEK PAYLOAD
  // ==========================================

  const buildWeekPayload = (
    week
  ) => {
    const weekData = {};

    items.forEach(
      (item) => {
        weekData[item.id] = {};

        week.dates.forEach(
          (date) => {
            weekData[item.id][
              date
            ] = round2(
              Number(
                values?.[
                  item.id
                ]?.[
                  date
                ] ?? 0
              )
            );
          }
        );
      }
    );

    return {
      schemaVersion: 3,
      week: week.code,
      dates: week.dates,
      data: weekData,
    };
  };

  // ==========================================
  // SAVE ALL WEEKS
  // ==========================================

  const saveAll = async () => {
    const validationErrors =
      validateBeforeSave();

    if (
      validationErrors.length >
      0
    ) {
      setMessage({
        type: "danger",
        text:
          validationErrors
            .slice(0, 5)
            .join(" | "),
      });

      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const responses =
        await Promise.all(
          weeks.map(
            async (week) => {
              const response =
                await fetch(
                  `/api/capacity-engine/shrinkage?capPlan=${encodeURIComponent(
                    capPlanId
                  )}`,
                  {
                    method: "POST",

                    headers: {
                      "Content-Type":
                        "application/json",

                      Authorization:
                        auth.authorization(),
                    },

                    body:
                      JSON.stringify({
                        payload:
                          buildWeekPayload(
                            week
                          ),
                      }),
                  }
                );

              const responseData =
                await response.json();

              if (
                !response.ok
              ) {
                throw new Error(
                  getApiErrorMessage(
                    responseData,
                    `Could not save ${week.code}.`
                  )
                );
              }

              return responseData;
            }
          )
        );

      setMigrationRequired(
        false
      );

      setMessage({
        type: "success",
        text: `Saved ${responses.length} shrinkage week(s) using schema v3.`,
      });
    } catch (error) {
      console.error(
        "Failed to save shrinkage plans:",
        error
      );

      setMessage({
        type: "danger",

        text:
          error.message ||
          "The shrinkage plans could not be saved.",
      });
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // EARLY RETURNS
  // ==========================================

  if (!capPlanId) {
    return null;
  }

  if (
    !weekDocs ||
    weekDocs.length === 0
  ) {
    return (
      <div className="notification is-warning is-light is-size-7">
        Select a week range to
        configure shrinkage.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="has-text-centered py-5">
        <button
          type="button"
          className="button is-loading is-white"
        >
          Loading
        </button>

        <p className="is-size-7 has-text-grey mt-2">
          Loading shrinkage
          configuration and daily
          values...
        </p>
      </div>
    );
  }

  // ==========================================
  // GRID DIMENSIONS
  // ==========================================

  const totalColumns =
    3 +
    visibleItems.length +
    3;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div>
      {/* ================================== */}
      {/* CONFIGURATION MODAL */}
      {/* ================================== */}

      <ShrinkageItemConfigModal
        open={configOpen}
        items={items}
        categories={categories}
        saving={
          savingConfiguration
        }
        onClose={() =>
          setConfigOpen(false)
        }
        onSave={
          saveConfiguration
        }
      />

      {/* ================================== */}
      {/* HEADER */}
      {/* ================================== */}

      <div className="box mb-4">
        <div
          className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap"
          style={{
            gap: "0.75rem",
          }}
        >
          <div>
            <h3 className="title is-5 mb-1">
              Shrinkage Plan
            </h3>

            <p className="is-size-7 has-text-grey">
              Enter daily shrinkage for{" "}
              {allDates.length} date
              {allDates.length === 1
                ? ""
                : "s"}{" "}
              across {weeks.length} week
              {weeks.length === 1
                ? ""
                : "s"}.
            </p>
          </div>

          <div className="buttons are-small mb-0">
            <button
              type="button"
              className="button is-light is-rounded"
              onClick={loadEditor}
              disabled={
                loading ||
                saving ||
                savingConfiguration
              }
            >
              <span className="icon is-small">
                <FaSync />
              </span>

              <span>Refresh</span>
            </button>

            <button
              type="button"
              className="button is-info is-light is-rounded"
              onClick={() =>
                setConfigOpen(true)
              }
              disabled={
                saving ||
                savingConfiguration
              }
            >
              <span className="icon is-small">
                <FaCog />
              </span>

              <span>
                Configure Shrinkage
              </span>
            </button>

            <button
              type="button"
              className="button is-success is-rounded"
              onClick={saveAll}
              disabled={
                saving ||
                savingConfiguration ||
                items.length === 0
              }
            >
              <span className="icon is-small">
                <FaSave />
              </span>

              <span>
                {saving
                  ? "Saving..."
                  : "Save All Weeks"}
              </span>
            </button>
          </div>
        </div>

        {message && (
          <div
            className={`notification is-${message.type} is-light is-size-7 py-2 mt-3 mb-0`}
          >
            {message.text}
          </div>
        )}

        {migrationRequired && (
          <div className="notification is-info is-light is-size-7 py-2 mt-3 mb-0">
            This capacity plan contains
            legacy shrinkage data.
            Apply the item
            configuration, review the
            values, and save all weeks
            to complete the migration.
          </div>
        )}
      </div>

      {/* ================================== */}
      {/* NO ITEMS */}
      {/* ================================== */}

      {items.length === 0 ? (
        <div className="box has-text-centered py-6">
          <FaCog
            className="has-text-grey mb-3"
            size={28}
          />

          <h4 className="title is-6 mb-2">
            No shrinkage items
            configured
          </h4>

          <p className="is-size-7 has-text-grey mb-4">
            Create the capacity
            plan’s shrinkage items and
            map them to approved
            categories before entering
            daily values.
          </p>

          <button
            type="button"
            className="button is-small is-info is-rounded"
            onClick={() =>
              setConfigOpen(true)
            }
          >
            <span className="icon is-small">
              <FaCog />
            </span>

            <span>
              Configure Shrinkage
            </span>
          </button>
        </div>
      ) : (
        <>
          {/* ============================== */}
          {/* GRID CONTROLS */}
          {/* ============================== */}

          <div
            className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap mb-3"
            style={{
              gap: "0.75rem",
            }}
          >
            <div className="buttons has-addons are-small mb-0">
              {[
                {
                  key: "all",
                  label: `All (${items.length})`,
                },
                {
                  key: "internal",
                  label: `Internal (${internalItemCount})`,
                },
                {
                  key: "external",
                  label: `External (${externalItemCount})`,
                },
              ].map(
                (filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    className={`button ${
                      layerFilter ===
                      filter.key
                        ? "is-info"
                        : ""
                    }`}
                    onClick={() =>
                      setLayerFilter(
                        filter.key
                      )
                    }
                  >
                    {filter.label}
                  </button>
                )
              )}
            </div>

            <div
              className="is-flex is-align-items-center"
              style={{
                gap: "0.75rem",
                flexWrap: "wrap",
              }}
            >
              <div className="internal-tooltip">
  <span
    className="internal-tooltip-trigger"
    tabIndex={0}
    onMouseEnter={() =>
      setShowInternalTooltip(true)
    }
    onMouseLeave={() =>
      setShowInternalTooltip(false)
    }
    onFocus={() =>
      setShowInternalTooltip(true)
    }
    onBlur={() =>
      setShowInternalTooltip(false)
    }
    aria-describedby="internal-shrinkage-tooltip"
  >
    <span className="has-text-info has-text-weight-semibold">
      Internal Shrinkage
    </span>

    <span className="icon is-small has-text-info">
      <FaInfoCircle />
    </span>
  </span>

  {showInternalTooltip && (
    <div
      id="internal-shrinkage-tooltip"
      className="internal-tooltip-content"
      role="tooltip"
    >
      <strong>
        Internal shrinkage precedence
      </strong>

      <ul>
        <li>
          A complete interval shrinkage pattern overrides the daily internal
          rate.
        </li>

        <li>
          Without an interval override, the daily internal shrinkage rate
          applies uniformly to each open interval.
        </li>

        <li>
          Daily values remain available for reporting.
        </li>

        <li>
          External shrinkage remains a flat daily rate.
        </li>
      </ul>
    </div>
  )}
</div>

              <div className="buttons are-small mb-0">
                <button
                  type="button"
                  className="button is-light"
                  onClick={expandAll}
                >
                  Expand all
                </button>

                <button
                  type="button"
                  className="button is-light"
                  onClick={collapseAll}
                >
                  Collapse all
                </button>
              </div>
            </div>
          </div>

          {/* ============================== */}
          {/* DAILY GRID */}
          {/* ============================== */}

          <div
            className="shrinkage-grid-container"
          >
            <table className="table is-narrow is-bordered is-striped is-fullwidth is-size-7 shrinkage-grid">
              <thead>
                <tr>
                  <th className="sticky-header sticky-week-column">
                    Week
                  </th>

                  <th className="sticky-header sticky-date-column">
                    Date
                  </th>

                  <th className="sticky-header sticky-day-column">
                    Day
                  </th>

                  {visibleItems.map(
                    (item) => (
                      <th
                        key={
                          item.id
                        }
                        className="sticky-header has-text-centered item-column"
                      >
                        <div
                          className="item-heading"
                          title={`${item.name} · ${
                            item.categoryName ||
                            item.categoryCode
                          } · ${item.layer} · ${item.state} · ${
                            item.compensation
                          } · ${
                            item.billing ===
                            "billable"
                              ? "billable"
                              : item.billing ===
                                  "non-billable"
                                ? "non-billable"
                                : "billing not classified"
                          }`}
                        >
                          <strong className="item-name">
                            {item.name}
                          </strong>

                          <button
                            type="button"
                            className="button is-small is-white fill-range-button"
                            onClick={() =>
                              fillItemRange(item)
                            }
                            title={`Fill ${item.name} across all visible dates`}
                          >
                            Fill
                          </button>
                        </div>

                        <div className="item-metadata">
                          <span
                            className={`layer-dot ${
                              item.layer === "internal"
                                ? "is-internal"
                                : "is-external"
                            }`}
                          />

                          <span className="category-name">
                            {item.categoryName ||
                              item.categoryCode}
                          </span>
                        </div>
                      </th>
                    )
                  )}

                  <th className="sticky-header summary-column has-text-centered">
                    Internal
                  </th>

                  <th className="sticky-header summary-column has-text-centered">
                    External
                  </th>

                  <th className="sticky-header summary-column has-text-centered">
                    Combined
                  </th>
                </tr>
              </thead>

              <tbody>
                {weeks.map(
                  (week) => {
                    const isCollapsed =
                      collapsedWeeks.has(
                        week.code
                      );

                    return [
                      <tr
                        key={`${week.code}-heading`}
                        className="week-heading-row"
                      >
                        <td
                          colSpan={
                            totalColumns
                          }
                        >
                          <div
                            className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap"
                            style={{
                              gap: "0.5rem",
                            }}
                          >
                            <button
                              type="button"
                              className="button is-small is-white week-toggle"
                              onClick={() =>
                                toggleWeek(
                                  week.code
                                )
                              }
                            >
                              <span className="icon is-small">
                                {isCollapsed ? (
                                  <FaChevronRight />
                                ) : (
                                  <FaChevronDown />
                                )}
                              </span>

                              <span>
                                <strong>
                                  {week.code}
                                </strong>

                                <span className="has-text-grey ml-2">
                                  {formatWeekRange(
                                    week
                                  )}
                                </span>
                              </span>
                            </button>

                            <div className="buttons are-small mb-0">
                              <button
                                type="button"
                                className="button is-info is-light"
                                onClick={() =>
                                  fillWeekItem(
                                    week
                                  )
                                }
                              >
                                Fill Item
                              </button>

                              <button
                                type="button"
                                className="button is-light"
                                onClick={() =>
                                  copyWeek(
                                    week
                                  )
                                }
                              >
                                <span className="icon is-small">
                                  <FaCopy />
                                </span>

                                <span>
                                  Copy Week
                                </span>
                              </button>

                              <button
                                type="button"
                                className="button is-light"
                                onClick={() =>
                                  clearWeek(
                                    week
                                  )
                                }
                              >
                                <span className="icon is-small">
                                  <FaTimes />
                                </span>

                                <span>
                                  Clear Week
                                </span>
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>,

                      ...(
                        isCollapsed
                          ? []
                          : week.dates.map(
                              (
                                date,
                                dateIndex
                              ) => {
                                const summary =
                                  calculateDateSummary(
                                    date,
                                    items,
                                    values
                                  );

                                return (
                                  <tr
                                    key={`${week.code}-${date}`}
                                  >
                                    <td className="sticky-week-column week-cell">
                                      {dateIndex ===
                                      0
                                        ? week.code
                                        : ""}
                                    </td>

                                    <td
  className="sticky-date-column date-cell"
  title={date}
>
  <strong>
    {formatDate(date)}
  </strong>
</td>

                                    <td className="sticky-day-column day-cell">
                                      {formatDay(
                                        date
                                      )}
                                    </td>

                                    {visibleItems.map(
                                      (
                                        item
                                      ) => (
                                        <td
                                          key={`${item.id}-${date}`}
                                          className="has-text-centered value-cell"
                                        >
                                          <div className="percentage-input">
                                            <input
                                              className="input is-small has-text-centered"
                                              type="number"
                                              min="0"
                                              max="100"
                                              step="0.1"
                                              value={
                                                values?.[
                                                  item
                                                    .id
                                                ]?.[
                                                  date
                                                ] ??
                                                0
                                              }
                                              onChange={(
                                                event
                                              ) =>
                                                updateValue(
                                                  item.id,
                                                  date,
                                                  event
                                                    .target
                                                    .value
                                                )
                                              }
                                            />

                                            <span>
                                              %
                                            </span>
                                          </div>
                                        </td>
                                      )
                                    )}

                                    <td className="has-text-centered summary-cell internal-summary">
                                      {summary.internal.toFixed(
                                        1
                                      )}
                                      %
                                    </td>

                                    <td className="has-text-centered summary-cell external-summary">
                                      {summary.external.toFixed(
                                        1
                                      )}
                                      %
                                    </td>

                                    <td className="has-text-centered summary-cell combined-summary">
                                      {summary.combined.toFixed(
                                        1
                                      )}
                                      %
                                    </td>
                                  </tr>
                                );
                              }
                            )
                      ),
                    ];
                  }
                )}
              </tbody>
            </table>
          </div>

          <p className="is-size-7 has-text-grey mt-2">
            The summary columns use
            all configured items, even
            when the grid is filtered
            to show only one shrinkage
            layer.
          </p>
        </>
      )}

      {/* ================================== */}
      {/* COMPONENT STYLES */}
      {/* ================================== */}

      <style jsx>{`
        .shrinkage-grid-container {
          max-height: 70vh;
          overflow: auto;
          border: 1px solid #dbdbdb;
          border-radius: 6px;
          background: #ffffff;
        }

        .shrinkage-grid {
          margin-bottom: 0;
          min-width: max-content;
        }

        .shrinkage-grid th,
        .shrinkage-grid td {
          padding: 0.28rem 0.35rem;
  vertical-align: middle;
        }
  .date-cell,
.day-cell,
.week-cell {
  font-size: 0.65rem;
}

        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #f3f3f7 !important;
        }

        .sticky-week-column {
  position: sticky;
  left: 0;
  z-index: 12;
  width: 76px;
  min-width: 76px;
  max-width: 76px;
  background: #ffffff;
  white-space: nowrap;
}

.sticky-date-column {
  position: sticky;
  left: 76px;
  z-index: 12;
  width: 68px;
  min-width: 68px;
  max-width: 68px;
  background: #ffffff;
  white-space: nowrap;
}

.sticky-day-column {
  position: sticky;
  left: 144px;
  z-index: 12;
  width: 42px;
  min-width: 42px;
  max-width: 42px;
  background: #ffffff;
  border-right: 2px solid #4b4bf9 !important;
  white-space: nowrap;
}

        th.sticky-week-column,
        th.sticky-date-column,
        th.sticky-day-column {
          z-index: 30;
          background: #f3f3f7 !important;
        }

        .item-column {
  width: 112px;
  min-width: 112px;
  max-width: 112px;
  padding: 0.3rem !important;
}

.summary-column {
  width: 72px;
  min-width: 72px;
  max-width: 72px;
  padding: 0.3rem !important;
}

        .item-heading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  min-width: 0;
}

.item-name {
  display: block;
  max-width: 72px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.67rem;
}

.fill-range-button {
  height: 18px;
  min-height: 18px;
  padding: 0 0.25rem;
  font-size: 0.55rem;
  color: #4b4bf9;
}

.item-metadata {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  margin-top: 0.15rem;
  min-width: 0;
}

.category-name {
  display: block;
  max-width: 84px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #7a7a7a;
  font-size: 0.56rem;
}

.layer-dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  min-width: 6px;
  border-radius: 50%;
}

.layer-dot.is-internal {
  background: #4b4bf9;
}

.layer-dot.is-external {
  background: #ff8d96;
}

        .value-cell {
          padding: 0.25rem !important;
        }

        .percentage-input {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.2rem;
        }

        .percentage-input input {
  width: 54px;
  height: 25px;
  padding: 0.1rem 0.2rem;
  font-size: 0.68rem;
}

        .percentage-input span {
          color: #7a7a7a;
          font-size: 0.65rem;
        }

        .week-heading-row td {
          background: #f3f3f7 !important;
          border-top: 2px solid #4b4bf9;
          padding: 0.45rem 0.6rem;
        }

        .week-toggle {
          height: auto;
          padding: 0.2rem;
          background: transparent;
        }

        .week-cell {
          color: #4b4bf9;
          font-weight: 600;
        }

        .date-cell {
          white-space: nowrap;
        }

        .day-cell {
          font-weight: 600;
          color: #7a7a7a;
        }

        .summary-cell {
          font-weight: 700;
          white-space: nowrap;
        }

        .internal-summary {
          color: #3273dc;
          background: #f5f9ff;
        }

        .external-summary {
          color: #f14668;
          background: #fff6f8;
        }

        .combined-summary {
          color: #ffffff;
          background: #363636;
        }

        .internal-tooltip {
  position: relative;
  display: inline-block;
}

.internal-tooltip-trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.3rem 0.4rem;
  cursor: help;
  white-space: nowrap;
  outline: none;
}

.internal-tooltip-trigger:focus {
  border-radius: 4px;
  box-shadow: 0 0 0 2px
    rgba(75, 75, 249, 0.25);
}

.internal-tooltip-content {
  position: absolute;
  z-index: 1000;
  right: 0;
  top: calc(100% + 6px);
  width: 360px;
  max-width: calc(100vw - 2rem);
  padding: 0.75rem 0.9rem;
  border-radius: 6px;
  background: #09092d;
  color: #ffffff;
  box-shadow: 0 8px 24px
    rgba(9, 9, 45, 0.25);
  font-size: 0.7rem;
  line-height: 1.45;
  pointer-events: none;
}

.internal-tooltip-content ul {
  margin-top: 0.35rem;
  padding-left: 1rem;
  list-style: disc;
}


        @media screen and (max-width: 768px) {
          .shrinkage-grid-container {
            max-height: 65vh;
          }

          .internal-tooltip-content {
            right: auto;
            left: 0;
            width: 310px;
          }
        }
      `}</style>
    </div>
  );
}