// ============================================
// SHRINKAGE ITEM CONFIGURATION MODAL
//
// Planners can:
// - Create local shrinkage item names
// - Map items to approved categories
// - Define productive state
// - Define compensation type
// - Define client billing classification
//
// Planners cannot:
// - Create categories
// - Delete categories
// - Change category layers
//
// The category determines whether an item is
// internal or external.
// ============================================

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  FaPlus,
  FaSave,
  FaTimes,
  FaTrash,
} from "react-icons/fa";

// ============================================
// CONSTANTS
// ============================================

const VALID_STATES = [
  "non-productive",
  "productive",
];

const VALID_COMPENSATION = [
  "paid",
  "unpaid",
];

const VALID_BILLING = [
  "billable",
  "non-billable",
];

// ============================================
// HELPERS
// ============================================

const clone = (value) =>
  JSON.parse(
    JSON.stringify(value)
  );

const normalizeText = (value) =>
  String(value ?? "").trim();

const normalizeId = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const createTemporaryId = () =>
  `shrinkage-item-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const ensureUniqueId = (
  requestedId,
  items
) => {
  const usedIds = new Set(
    items.map((item) => item.id)
  );

  const base =
    normalizeId(requestedId) ||
    createTemporaryId();

  let candidate = base;
  let suffix = 2;

  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  return candidate;
};

// ============================================
// COMPONENT
// ============================================

export default function ShrinkageItemConfigModal({
  open,
  items,
  categories,
  saving,
  onClose,
  onSave,
}) {
  const [
    draftItems,
    setDraftItems,
  ] = useState([]);

  const [
    message,
    setMessage,
  ] = useState(null);

  // ==========================================
  // CATEGORY LOOKUP
  // ==========================================

  const categoriesByCode = useMemo(
    () =>
      new Map(
        (categories || []).map(
          (category) => [
            category.code,
            category,
          ]
        )
      ),
    [categories]
  );

  const activeCategories =
    useMemo(
      () =>
        (categories || [])
          .filter(
            (category) =>
              category.active !== false
          )
          .sort((a, b) => {
            const layerComparison =
              String(
                a.layer
              ).localeCompare(
                String(b.layer)
              );

            if (
              layerComparison !== 0
            ) {
              return layerComparison;
            }

            const orderComparison =
              Number(
                a.sortOrder || 0
              ) -
              Number(
                b.sortOrder || 0
              );

            if (
              orderComparison !== 0
            ) {
              return orderComparison;
            }

            return String(
              a.name
            ).localeCompare(
              String(b.name)
            );
          }),
      [categories]
    );

  const internalCategories =
    activeCategories.filter(
      (category) =>
        category.layer ===
        "internal"
    );

  const externalCategories =
    activeCategories.filter(
      (category) =>
        category.layer ===
        "external"
    );

  // ==========================================
  // RESET DRAFT WHEN OPENED
  // ==========================================

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextItems =
      clone(items || []);

    setDraftItems(
      nextItems
    );

    const requiresBillingReview =
      nextItems.some(
        (item) =>
          !VALID_BILLING.includes(
            item?.billing
          )
      );

    setMessage(
      requiresBillingReview
        ? {
            type: "warning",
            text:
              "Billing classification is required. Review every item and select whether its hours are billable or non-billable to the client.",
          }
        : null
    );
  }, [open, items]);

  // ==========================================
  // CLOSE WITH ESCAPE
  // ==========================================

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKeyDown = (
      event
    ) => {
      if (
        event.key === "Escape" &&
        !saving
      ) {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [open, saving, onClose]);

  // ==========================================
  // ITEM MANAGEMENT
  // ==========================================

  const addItem = () => {
    const firstCategory =
      activeCategories[0];

    if (!firstCategory) {
      setMessage({
        type: "warning",
        text:
          "No active shrinkage categories are available. An administrator must configure at least one category.",
      });

      return;
    }

    setDraftItems(
      (current) => [
        ...current,
        {
          id: ensureUniqueId(
            "new-shrinkage-item",
            current
          ),

          name: "",

          categoryCode:
            firstCategory.code,

          categoryName:
            firstCategory.name,

          layer:
            firstCategory.layer,

          categoryActive: true,

          state:
            "non-productive",

          compensation: "paid",

          // Require an explicit planner selection.
          billing: "",
        },
      ]
    );

    setMessage(null);
  };

  const updateItem = (
    itemId,
    field,
    value
  ) => {
    setDraftItems(
      (current) =>
        current.map((item) => {
          if (item.id !== itemId) {
            return item;
          }

          if (
            field ===
            "categoryCode"
          ) {
            const category =
              categoriesByCode.get(
                value
              );

            return {
              ...item,

              categoryCode: value,

              categoryName:
                category?.name || "",

              layer:
                category?.layer || "",

              categoryActive:
                category
                  ? category.active !==
                    false
                  : false,
            };
          }

          return {
            ...item,
            [field]: value,
          };
        })
    );

    setMessage(null);
  };

  const removeItem = (
    itemId
  ) => {
    const item =
      draftItems.find(
        (entry) =>
          entry.id === itemId
      );

    const confirmed =
      window.confirm(
        `Remove "${
          item?.name ||
          "this shrinkage item"
        }" from the capacity plan?\n\nIts saved daily values will no longer be used after the configuration is applied.`
      );

    if (!confirmed) {
      return;
    }

    setDraftItems(
      (current) =>
        current.filter(
          (item) =>
            item.id !== itemId
        )
    );
  };

  // ==========================================
  // VALIDATION
  // ==========================================

  const validate = () => {
    const errors = [];

    if (
      draftItems.length === 0
    ) {
      errors.push(
        "At least one shrinkage item is required."
      );
    }

    const itemIds = new Set();
    const itemNames = new Set();

    draftItems.forEach(
      (item, index) => {
        const position =
          index + 1;

        const name =
          normalizeText(
            item.name
          );

        if (!item.id) {
          errors.push(
            `Item ${position} requires an ID.`
          );
        } else if (
          itemIds.has(item.id)
        ) {
          errors.push(
            `Item ID "${item.id}" is duplicated.`
          );
        }

        itemIds.add(item.id);

        if (!name) {
          errors.push(
            `Item ${position} requires a name.`
          );
        } else {
          const nameKey =
            name.toLowerCase();

          if (
            itemNames.has(nameKey)
          ) {
            errors.push(
              `Item name "${name}" is duplicated.`
            );
          }

          itemNames.add(nameKey);
        }

        const category =
          categoriesByCode.get(
            item.categoryCode
          );

        if (!category) {
          errors.push(
            `"${name || `Item ${position}`}" requires an approved category.`
          );
        } else if (
          category.active === false
        ) {
          errors.push(
            `"${name || `Item ${position}`}" uses the inactive category "${category.name}". Select an active category before saving.`
          );
        }

        if (
          !VALID_STATES.includes(
            item.state
          )
        ) {
          errors.push(
            `"${name || `Item ${position}`}" has an invalid productive state.`
          );
        }

        if (
          !VALID_COMPENSATION.includes(
            item.compensation
          )
        ) {
          errors.push(
            `"${name || `Item ${position}`}" has an invalid compensation type.`
          );
        }
        if (
          !VALID_BILLING.includes(
            item.billing
          )
        ) {
          errors.push(
            `"${name || `Item ${position}`}" requires a valid billing classification.`
          );
        }
      }
    );

    return errors;
  };

  // ==========================================
  // SAVE
  // ==========================================

  const handleSave = async () => {
    const validationErrors =
      validate();

    if (
      validationErrors.length > 0
    ) {
      setMessage({
        type: "danger",

        text: validationErrors
          .slice(0, 5)
          .join(" | "),
      });

      return;
    }

    const normalizedItems =
      draftItems.map((item) => ({
        id: item.id,

        name:
          normalizeText(
            item.name
          ),

        categoryCode:
          item.categoryCode,

        state: item.state,

        compensation:
          item.compensation,

        billing:
          item.billing,
      }));

    try {
      await onSave(
        normalizedItems
      );
    } catch (error) {
      setMessage({
        type: "danger",

        text:
          error?.message ||
          "The shrinkage configuration could not be saved.",
      });
    }
  };

  // ==========================================
  // DO NOT RENDER WHEN CLOSED
  // ==========================================

  if (!open) {
    return null;
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div
      className="modal is-active"
      style={{
        zIndex: 1000,
      }}
    >
      <div
        className="modal-background"
        onClick={() => {
          if (!saving) {
            onClose();
          }
        }}
      />

      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shrinkage-config-title"
        style={{
          width:
            "calc(100vw - 2rem)",

          maxWidth: "1400px",

          height:
            "calc(100vh - 2rem)",

          maxHeight:
            "calc(100vh - 2rem)",

          margin: "1rem",
        }}
      >
        {/* ================================= */}
        {/* HEADER */}
        {/* ================================= */}

        <header
          className="modal-card-head"
          style={{
            borderBottom:
              "3px solid #4b4bf9",
          }}
        >
          <div>
            <p
              id="shrinkage-config-title"
              className="modal-card-title"
            >
              Configure Shrinkage Items
            </p>

            <p className="is-size-7 has-text-grey mt-1">
              Create local item names
              and map them to approved
              reporting categories.
            </p>
          </div>

          <button
            type="button"
            className="delete"
            aria-label="Close shrinkage configuration"
            onClick={onClose}
            disabled={saving}
          />
        </header>

        {/* ================================= */}
        {/* BODY */}
        {/* ================================= */}

        <section
          className="modal-card-body"
          style={{
            overflow: "auto",
          }}
        >
          {message && (
            <div
              className={`notification is-${message.type} is-light is-size-7 py-2`}
            >
              {message.text}
            </div>
          )}

          {/* =============================== */}
          {/* EXPLANATION */}
          {/* =============================== */}

          <div className="notification is-info is-light is-size-7">
            <strong>
              How classification works
            </strong>

            <p className="mt-1">
              Use any appropriate local
              name for the shrinkage
              item. The approved
              category standardizes
              reporting and determines
              whether the item is
              internal or external.
              Compensation identifies
              whether the time is paid
              to the employee. Billing
              identifies whether those
              hours can be billed to the
              client.
            </p>

            <p className="mt-1">
              Example:{" "}
              <strong>PTO</strong> →{" "}
              <strong>Vacation</strong>{" "}
              → External → Paid →
              Non-Billable.
            </p>
          </div>

          {/* =============================== */}
          {/* CATEGORY SUMMARY */}
          {/* =============================== */}

          <div className="tags mb-4">
            <span className="tag is-info is-light">
              Internal categories:{" "}
              {
                internalCategories.length
              }
            </span>

            <span className="tag is-danger is-light">
              External categories:{" "}
              {
                externalCategories.length
              }
            </span>

            <span className="tag is-light">
              Configured items:{" "}
              {draftItems.length}
            </span>
          </div>

          {/* =============================== */}
          {/* ITEM TABLE */}
          {/* =============================== */}

          <div
            className="table-container"
            style={{
              overflowX: "auto",
            }}
          >
            <table className="table is-narrow is-bordered is-striped is-fullwidth is-size-7">
              <thead>
                <tr>
                  <th
                    style={{
                      minWidth: "220px",
                    }}
                  >
                    Planner Item Name
                  </th>

                  <th
                    style={{
                      minWidth: "210px",
                    }}
                  >
                    Approved Category
                  </th>

                  <th
                    style={{
                      minWidth: "110px",
                    }}
                  >
                    Layer
                  </th>

                  <th
                    style={{
                      minWidth: "170px",
                    }}
                  >
                    Productive State
                  </th>

                  <th
                    style={{
                      minWidth: "140px",
                    }}
                  >
                    Compensation
                  </th>
                  <th
                    style={{
                      minWidth: "150px",
                    }}
                  >
                    Client Billing
                  </th>

                  <th
                    className="has-text-centered"
                    style={{
                      width: "60px",
                    }}
                  >
                    Remove
                  </th>
                </tr>
              </thead>

              <tbody>
                {draftItems.map(
                  (item) => {
                    const selectedCategory =
                      categoriesByCode.get(
                        item.categoryCode
                      );

                    const selectedCategoryIsInactive =
                      selectedCategory &&
                      selectedCategory.active ===
                        false;

                    return (
                      <tr
                        key={item.id}
                      >
                        <td>
                          <input
                            className="input is-small"
                            type="text"
                            value={
                              item.name ||
                              ""
                            }
                            onChange={(
                              event
                            ) =>
                              updateItem(
                                item.id,
                                "name",
                                event
                                  .target
                                  .value
                              )
                            }
                            placeholder="Example: PTO"
                            disabled={
                              saving
                            }
                          />
                        </td>

                        <td>
                          <div className="select is-small is-fullwidth">
                            <select
                              value={
                                item.categoryCode ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "categoryCode",
                                  event
                                    .target
                                    .value
                                )
                              }
                              disabled={
                                saving
                              }
                            >
                              <option value="">
                                Select category...
                              </option>

                              {selectedCategoryIsInactive && (
                                <option
                                  value={
                                    selectedCategory.code
                                  }
                                  disabled
                                >
                                  {
                                    selectedCategory.name
                                  }{" "}
                                  (Inactive)
                                </option>
                              )}

                              {internalCategories.length >
                                0 && (
                                <optgroup label="Internal">
                                  {internalCategories.map(
                                    (
                                      category
                                    ) => (
                                      <option
                                        key={
                                          category.code
                                        }
                                        value={
                                          category.code
                                        }
                                      >
                                        {
                                          category.name
                                        }
                                      </option>
                                    )
                                  )}
                                </optgroup>
                              )}

                              {externalCategories.length >
                                0 && (
                                <optgroup label="External">
                                  {externalCategories.map(
                                    (
                                      category
                                    ) => (
                                      <option
                                        key={
                                          category.code
                                        }
                                        value={
                                          category.code
                                        }
                                      >
                                        {
                                          category.name
                                        }
                                      </option>
                                    )
                                  )}
                                </optgroup>
                              )}
                            </select>
                          </div>
                        </td>

                        <td>
                          {selectedCategory ? (
                            <span
                              className={`tag is-small ${
                                selectedCategory.layer ===
                                "internal"
                                  ? "is-info is-light"
                                  : "is-danger is-light"
                              }`}
                            >
                              {selectedCategory.layer ===
                              "internal"
                                ? "Internal"
                                : "External"}
                            </span>
                          ) : (
                            <span className="tag is-light">
                              Not selected
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="select is-small is-fullwidth">
                            <select
                              value={
                                item.state
                              }
                              onChange={(
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "state",
                                  event
                                    .target
                                    .value
                                )
                              }
                              disabled={
                                saving
                              }
                            >
                              <option value="non-productive">
                                Non-Productive
                              </option>

                              <option value="productive">
                                Productive
                              </option>
                            </select>
                          </div>
                        </td>

                        <td>
                          <div className="select is-small is-fullwidth">
                            <select
                              value={
                                item.compensation
                              }
                              onChange={(
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "compensation",
                                  event
                                    .target
                                    .value
                                )
                              }
                              disabled={
                                saving
                              }
                            >
                              <option value="paid">
                                Paid
                              </option>

                              <option value="unpaid">
                                Unpaid
                              </option>
                            </select>
                          </div>
                        </td>
                        <td>
                          <div
                            className={`select is-small is-fullwidth ${
                              !VALID_BILLING.includes(
                                item.billing
                              )
                                ? "is-danger"
                                : ""
                            }`}
                          >
                            <select
                              value={
                                item.billing ||
                                ""
                              }
                              onChange={(
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "billing",
                                  event.target.value
                                )
                              }
                              disabled={saving}
                              aria-label={`Client billing classification for ${
                                item.name ||
                                "shrinkage item"
                              }`}
                            >
                              <option value="">
                                Select billing...
                              </option>

                              <option value="billable">
                                Billable
                              </option>

                              <option value="non-billable">
                                Non-Billable
                              </option>
                            </select>
                          </div>
                        </td>

                        <td className="has-text-centered">
                          <button
                            type="button"
                            className="button is-small is-danger is-light"
                            onClick={() =>
                              removeItem(
                                item.id
                              )
                            }
                            disabled={
                              saving
                            }
                            title={`Remove ${
                              item.name ||
                              "item"
                            }`}
                          >
                            <FaTrash />
                          </button>
                        </td>
                      </tr>
                    );
                  }
                )}

                {draftItems.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan="7"
                      className="has-text-centered has-text-grey py-5"
                    >
                      No shrinkage
                      items are
                      configured for
                      this capacity
                      plan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="button is-small is-info is-light is-rounded mt-3"
            onClick={addItem}
            disabled={
              saving ||
              activeCategories.length ===
                0
            }
          >
            <span className="icon is-small">
              <FaPlus />
            </span>

            <span>
              Add Shrinkage Item
            </span>
          </button>
        </section>

        {/* ================================= */}
        {/* FOOTER */}
        {/* ================================= */}

        <footer className="modal-card-foot is-justify-content-flex-end">
          <button
            type="button"
            className="button is-small is-light is-rounded"
            onClick={onClose}
            disabled={saving}
          >
            <span className="icon is-small">
              <FaTimes />
            </span>

            <span>Cancel</span>
          </button>

          <button
            type="button"
            className="button is-small is-success is-rounded"
            onClick={
              handleSave
            }
            disabled={
              saving ||
              draftItems.length ===
                0
            }
          >
            <span className="icon is-small">
              <FaSave />
            </span>

            <span>
              {saving
                ? "Applying..."
                : "Apply Configuration"}
            </span>
          </button>
        </footer>
      </div>
    </div>
  );
}