// ============================================
// SHRINKAGE CATEGORY MANAGEMENT
//
// Administrator-managed category catalog.
// Categories standardize reporting while
// planners retain their preferred item names.
// ============================================

import {
  useEffect,
  useState,
} from "react";

import {
  FaPlus,
  FaSave,
  FaSync,
  FaBan,
  FaCheck,
  FaTimes,
} from "react-icons/fa";

import {
  useAuth,
} from "../../contexts/authContext";

// ============================================
// CONSTANTS
// ============================================

const EMPTY_FORM = {
  code: "",
  name: "",
  layer: "internal",
  sortOrder: 100,
};

const VALID_LAYERS = [
  "internal",
  "external",
];

// ============================================
// HELPERS
// ============================================

const normalizeText = (value) =>
  String(value ?? "").trim();

const makeCode = (value) =>
  normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const getErrorMessage = (
  responseData,
  fallback
) => {
  const validationErrors =
    responseData?.validation?.errors;

  if (
    Array.isArray(validationErrors) &&
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
// COMPONENT
// ============================================

export default function ShrinkageCategoryManagement() {
  const auth = useAuth();

  // ==========================================
  // STATE
  // ==========================================

  const [
    categories,
    setCategories,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState(null);

  const [
    showInactive,
    setShowInactive,
  ] = useState(true);

  const [
    showCreateForm,
    setShowCreateForm,
  ] = useState(false);

  const [
    createForm,
    setCreateForm,
  ] = useState({
    ...EMPTY_FORM,
  });

  const [
    editingCode,
    setEditingCode,
  ] = useState("");

  const [
    editForm,
    setEditForm,
  ] = useState(null);

  // ==========================================
  // LOAD CATEGORIES
  // ==========================================

  const loadCategories =
    async () => {
      setLoading(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            "/api/capacity-engine/shrinkage-categories?includeInactive=true",
            {
              headers: {
                Authorization:
                  auth.authorization(),
              },
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              responseData,
              "Shrinkage categories could not be loaded."
            )
          );
        }

        setCategories(
          Array.isArray(
            responseData.data
          )
            ? responseData.data
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load shrinkage categories:",
          error
        );

        setMessage({
          type: "danger",
          text:
            error.message ||
            "Shrinkage categories could not be loaded.",
        });
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (auth.allowedAdmin) {
      loadCategories();
    }

    // Run when administrator access becomes
    // available after authentication loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.allowedAdmin]);

  // ==========================================
  // CREATE FORM
  // ==========================================

  const updateCreateForm = (
    field,
    value
  ) => {
    setCreateForm(
      (current) => {
        const updated = {
          ...current,
          [field]: value,
        };

        // Generate the initial code from
        // the name. The administrator may
        // still edit it before creation.
        if (
          field === "name" &&
          (
            !current.code ||
            current.code ===
              makeCode(current.name)
          )
        ) {
          updated.code =
            makeCode(value);
        }

        return updated;
      }
    );
  };

  const resetCreateForm = () => {
    setCreateForm({
      ...EMPTY_FORM,
    });

    setShowCreateForm(false);
  };

  const createCategory =
    async () => {
      const name =
        normalizeText(
          createForm.name
        );

      const code =
        makeCode(
          createForm.code ||
            createForm.name
        );

      const layer =
        normalizeText(
          createForm.layer
        ).toLowerCase();

      const sortOrder =
        Number(
          createForm.sortOrder
        );

      if (!name || !code) {
        setMessage({
          type: "danger",
          text:
            "Category name and code are required.",
        });

        return;
      }

      if (
        !VALID_LAYERS.includes(
          layer
        )
      ) {
        setMessage({
          type: "danger",
          text:
            "Category layer must be internal or external.",
        });

        return;
      }

      if (
        !Number.isFinite(
          sortOrder
        )
      ) {
        setMessage({
          type: "danger",
          text:
            "Display order must be numeric.",
        });

        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            "/api/capacity-engine/shrinkage-categories",
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
                  code,
                  name,
                  layer,
                  sortOrder,
                },
              }),
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              responseData,
              "The category could not be created."
            )
          );
        }

        setMessage({
          type: "success",
          text:
            responseData.message ||
            "Shrinkage category created.",
        });

        resetCreateForm();
        await loadCategories();
      } catch (error) {
        console.error(
          "Failed to create shrinkage category:",
          error
        );

        setMessage({
          type: "danger",
          text:
            error.message ||
            "The category could not be created.",
        });
      } finally {
        setSaving(false);
      }
    };

  // ==========================================
  // EDITING
  // ==========================================

  const beginEditing = (
    category
  ) => {
    setEditingCode(
      category.code
    );

    setEditForm({
      name: category.name,
      layer: category.layer,
      sortOrder:
        category.sortOrder ?? 0,
      active:
        category.active !== false,
    });

    setMessage(null);
  };

  const cancelEditing = () => {
    setEditingCode("");
    setEditForm(null);
  };

  const updateEditForm = (
    field,
    value
  ) => {
    setEditForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  };

  const saveCategory =
    async (categoryCode) => {
      const name =
        normalizeText(
          editForm?.name
        );

      const layer =
        normalizeText(
          editForm?.layer
        ).toLowerCase();

      const sortOrder =
        Number(
          editForm?.sortOrder
        );

      if (!name) {
        setMessage({
          type: "danger",
          text:
            "Category name is required.",
        });

        return;
      }

      if (
        !VALID_LAYERS.includes(
          layer
        )
      ) {
        setMessage({
          type: "danger",
          text:
            "Category layer must be internal or external.",
        });

        return;
      }

      if (
        !Number.isFinite(
          sortOrder
        )
      ) {
        setMessage({
          type: "danger",
          text:
            "Display order must be numeric.",
        });

        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            `/api/capacity-engine/shrinkage-categories?code=${encodeURIComponent(
              categoryCode
            )}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  auth.authorization(),
              },

              body: JSON.stringify({
                payload: {
                  name,
                  layer,
                  sortOrder,
                  active:
                    editForm.active !==
                    false,
                },
              }),
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              responseData,
              "The category could not be updated."
            )
          );
        }

        setMessage({
          type: "success",
          text:
            responseData.message ||
            "Shrinkage category updated.",
        });

        cancelEditing();
        await loadCategories();
      } catch (error) {
        console.error(
          "Failed to update shrinkage category:",
          error
        );

        setMessage({
          type: "danger",
          text:
            error.message ||
            "The category could not be updated.",
        });
      } finally {
        setSaving(false);
      }
    };

  // ==========================================
  // ACTIVATE / DEACTIVATE
  // ==========================================

  const deactivateCategory =
    async (category) => {
      const confirmed =
        window.confirm(
          `Deactivate "${category.name}"?\n\nExisting capacity plans will keep their historical references, but planners will not be able to assign this category to new items.`
        );

      if (!confirmed) {
        return;
      }

      setSaving(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            `/api/capacity-engine/shrinkage-categories?code=${encodeURIComponent(
              category.code
            )}`,
            {
              method: "DELETE",

              headers: {
                Authorization:
                  auth.authorization(),
              },
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              responseData,
              "The category could not be deactivated."
            )
          );
        }

        setMessage({
          type: "success",
          text:
            responseData.message ||
            "Shrinkage category deactivated.",
        });

        await loadCategories();
      } catch (error) {
        console.error(
          "Failed to deactivate shrinkage category:",
          error
        );

        setMessage({
          type: "danger",
          text:
            error.message ||
            "The category could not be deactivated.",
        });
      } finally {
        setSaving(false);
      }
    };

  const reactivateCategory =
    async (category) => {
      setSaving(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            `/api/capacity-engine/shrinkage-categories?code=${encodeURIComponent(
              category.code
            )}`,
            {
              method: "PUT",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  auth.authorization(),
              },

              body: JSON.stringify({
                payload: {
                  name: category.name,
                  layer: category.layer,

                  sortOrder:
                    category.sortOrder ??
                    0,

                  active: true,
                },
              }),
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getErrorMessage(
              responseData,
              "The category could not be reactivated."
            )
          );
        }

        setMessage({
          type: "success",
          text:
            responseData.message ||
            "Shrinkage category reactivated.",
        });

        await loadCategories();
      } catch (error) {
        console.error(
          "Failed to reactivate shrinkage category:",
          error
        );

        setMessage({
          type: "danger",
          text:
            error.message ||
            "The category could not be reactivated.",
        });
      } finally {
        setSaving(false);
      }
    };

  // ==========================================
  // FILTERED DISPLAY
  // ==========================================

  const visibleCategories =
    showInactive
      ? categories
      : categories.filter(
          (category) =>
            category.active !==
            false
        );

  const internalCount =
    categories.filter(
      (category) =>
        category.layer ===
          "internal" &&
        category.active !== false
    ).length;

  const externalCount =
    categories.filter(
      (category) =>
        category.layer ===
          "external" &&
        category.active !== false
    ).length;

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div>
      {/* ================================== */}
      {/* HEADER */}
      {/* ================================== */}

      <div
        className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap mb-4"
        style={{
          gap: "0.75rem",
        }}
      >
        <div>
          <h2 className="title is-5 mb-1">
            Shrinkage Categories
          </h2>

          <p className="is-size-7 has-text-grey">
            Maintain the approved
            categories planners use to
            classify their local
            shrinkage items.
          </p>
        </div>

        <div className="buttons are-small mb-0">
          <button
            type="button"
            className="button is-light is-rounded"
            onClick={loadCategories}
            disabled={
              loading || saving
            }
          >
            <span className="icon is-small">
              <FaSync />
            </span>

            <span>
              {loading
                ? "Loading..."
                : "Refresh"}
            </span>
          </button>

          <button
            type="button"
            className="button is-info is-rounded"
            onClick={() => {
              setShowCreateForm(
                true
              );

              setCreateForm({
                ...EMPTY_FORM,
              });

              cancelEditing();
            }}
            disabled={
              saving ||
              showCreateForm
            }
          >
            <span className="icon is-small">
              <FaPlus />
            </span>

            <span>
              Add Category
            </span>
          </button>
        </div>
      </div>

      {/* ================================== */}
      {/* MESSAGE */}
      {/* ================================== */}

      {message && (
        <div
          className={`notification is-${message.type} is-light is-size-7 py-2`}
        >
          {message.text}
        </div>
      )}

      {/* ================================== */}
      {/* GUIDANCE */}
      {/* ================================== */}

      <div className="notification is-info is-light is-size-7">
        Categories provide a standard
        reporting structure. Planners
        may use their preferred item
        names, such as{" "}
        <strong>PTO</strong>, while
        mapping them to an approved
        category such as{" "}
        <strong>Vacation</strong>.
      </div>

      {/* ================================== */}
      {/* SUMMARY */}
      {/* ================================== */}

      <div className="tags mb-4">
        <span className="tag is-info is-light">
          Internal: {internalCount}
        </span>

        <span className="tag is-danger is-light">
          External: {externalCount}
        </span>

        <span className="tag is-light">
          Total active:{" "}
          {internalCount +
            externalCount}
        </span>
      </div>

      {/* ================================== */}
      {/* CREATE FORM */}
      {/* ================================== */}

      {showCreateForm && (
        <div
          className="box mb-4"
          style={{
            border:
              "1px solid #4b4bf9",
          }}
        >
          <div className="is-flex is-align-items-center is-justify-content-space-between mb-3">
            <strong>
              New Shrinkage Category
            </strong>

            <button
              type="button"
              className="delete"
              onClick={
                resetCreateForm
              }
              disabled={saving}
              aria-label="Close new category form"
            />
          </div>

          <div className="columns is-multiline">
            <div className="column is-4">
              <label className="label is-small">
                Category Name
              </label>

              <input
                className="input is-small"
                type="text"
                value={
                  createForm.name
                }
                onChange={(event) =>
                  updateCreateForm(
                    "name",
                    event.target.value
                  )
                }
                placeholder="Example: System Downtime"
                disabled={saving}
              />
            </div>

            <div className="column is-3">
              <label className="label is-small">
                Stable Code
              </label>

              <input
                className="input is-small"
                type="text"
                value={
                  createForm.code
                }
                onChange={(event) =>
                  updateCreateForm(
                    "code",
                    makeCode(
                      event.target.value
                    )
                  )
                }
                placeholder="system-downtime"
                disabled={saving}
              />

              <p className="help">
                The code cannot be
                changed after creation.
              </p>
            </div>

            <div className="column is-3">
              <label className="label is-small">
                Layer
              </label>

              <div className="select is-small is-fullwidth">
                <select
                  value={
                    createForm.layer
                  }
                  onChange={(event) =>
                    updateCreateForm(
                      "layer",
                      event.target.value
                    )
                  }
                  disabled={saving}
                >
                  <option value="internal">
                    Internal
                  </option>

                  <option value="external">
                    External
                  </option>
                </select>
              </div>
            </div>

            <div className="column is-2">
              <label className="label is-small">
                Display Order
              </label>

              <input
                className="input is-small"
                type="number"
                step="1"
                value={
                  createForm.sortOrder
                }
                onChange={(event) =>
                  updateCreateForm(
                    "sortOrder",
                    event.target.value
                  )
                }
                disabled={saving}
              />
            </div>
          </div>

          <div className="buttons are-small mb-0">
            <button
              type="button"
              className="button is-success is-rounded"
              onClick={
                createCategory
              }
              disabled={
                saving ||
                !createForm.name ||
                !createForm.code
              }
            >
              <span className="icon is-small">
                <FaSave />
              </span>

              <span>
                {saving
                  ? "Saving..."
                  : "Create Category"}
              </span>
            </button>

            <button
              type="button"
              className="button is-light is-rounded"
              onClick={
                resetCreateForm
              }
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ================================== */}
      {/* TABLE CONTROLS */}
      {/* ================================== */}

      <div className="is-flex is-align-items-center is-justify-content-space-between mb-2">
        <strong className="is-size-6">
          Category Catalog
        </strong>

        <label className="checkbox is-size-7">
          <input
            type="checkbox"
            className="mr-1"
            checked={showInactive}
            onChange={(event) =>
              setShowInactive(
                event.target.checked
              )
            }
          />

          Show inactive
        </label>
      </div>

      {/* ================================== */}
      {/* CATEGORY TABLE */}
      {/* ================================== */}

      <div className="table-container">
        <table className="table is-narrow is-bordered is-striped is-fullwidth is-size-7">
          <thead>
            <tr>
              <th
                style={{
                  minWidth: "180px",
                }}
              >
                Category
              </th>

              <th
                style={{
                  minWidth: "160px",
                }}
              >
                Stable Code
              </th>

              <th
                style={{
                  minWidth: "120px",
                }}
              >
                Layer
              </th>

              <th
                className="has-text-centered"
                style={{
                  minWidth: "100px",
                }}
              >
                Order
              </th>

              <th
                className="has-text-centered"
                style={{
                  minWidth: "100px",
                }}
              >
                Status
              </th>

              <th
                className="has-text-centered"
                style={{
                  minWidth: "210px",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleCategories.map(
              (category) => {
                const isEditing =
                  editingCode ===
                  category.code;

                return (
                  <tr
                    key={
                      category.code
                    }
                    style={{
                      opacity:
                        category.active ===
                        false
                          ? 0.65
                          : 1,
                    }}
                  >
                    <td>
                      {isEditing ? (
                        <input
                          className="input is-small"
                          type="text"
                          value={
                            editForm?.name ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateEditForm(
                              "name",
                              event
                                .target
                                .value
                            )
                          }
                          disabled={
                            saving
                          }
                        />
                      ) : (
                        <strong>
                          {category.name}
                        </strong>
                      )}
                    </td>

                    <td>
                      <code>
                        {category.code}
                      </code>

                      {category.isDefault && (
                        <span className="tag is-small is-light ml-2">
                          Default
                        </span>
                      )}
                    </td>

                    <td>
                      {isEditing ? (
                        <div className="select is-small is-fullwidth">
                          <select
                            value={
                              editForm?.layer ||
                              "internal"
                            }
                            onChange={(
                              event
                            ) =>
                              updateEditForm(
                                "layer",
                                event
                                  .target
                                  .value
                              )
                            }
                            disabled={
                              saving
                            }
                          >
                            <option value="internal">
                              Internal
                            </option>

                            <option value="external">
                              External
                            </option>
                          </select>
                        </div>
                      ) : (
                        <span
                          className={`tag is-small ${
                            category.layer ===
                            "internal"
                              ? "is-info is-light"
                              : "is-danger is-light"
                          }`}
                        >
                          {category.layer ===
                          "internal"
                            ? "Internal"
                            : "External"}
                        </span>
                      )}
                    </td>

                    <td className="has-text-centered">
                      {isEditing ? (
                        <input
                          className="input is-small has-text-centered"
                          type="number"
                          step="1"
                          value={
                            editForm?.sortOrder ??
                            0
                          }
                          onChange={(
                            event
                          ) =>
                            updateEditForm(
                              "sortOrder",
                              event
                                .target
                                .value
                            )
                          }
                          disabled={
                            saving
                          }
                          style={{
                            width:
                              "80px",
                          }}
                        />
                      ) : (
                        category.sortOrder
                      )}
                    </td>

                    <td className="has-text-centered">
                      {category.active !==
                      false ? (
                        <span className="tag is-success is-light">
                          <span className="icon is-small">
                            <FaCheck />
                          </span>

                          <span>
                            Active
                          </span>
                        </span>
                      ) : (
                        <span className="tag is-light">
                          <span className="icon is-small">
                            <FaBan />
                          </span>

                          <span>
                            Inactive
                          </span>
                        </span>
                      )}
                    </td>

                    <td className="has-text-centered">
                      {isEditing ? (
                        <div className="buttons are-small is-centered mb-0">
                          <button
                            type="button"
                            className="button is-success is-light"
                            onClick={() =>
                              saveCategory(
                                category.code
                              )
                            }
                            disabled={
                              saving
                            }
                          >
                            <span className="icon is-small">
                              <FaSave />
                            </span>

                            <span>
                              Save
                            </span>
                          </button>

                          <button
                            type="button"
                            className="button is-light"
                            onClick={
                              cancelEditing
                            }
                            disabled={
                              saving
                            }
                          >
                            <span className="icon is-small">
                              <FaTimes />
                            </span>

                            <span>
                              Cancel
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div className="buttons are-small is-centered mb-0">
                          <button
                            type="button"
                            className="button is-info is-light"
                            onClick={() =>
                              beginEditing(
                                category
                              )
                            }
                            disabled={
                              saving
                            }
                          >
                            Edit
                          </button>

                          {category.active !==
                          false ? (
                            <button
                              type="button"
                              className="button is-warning is-light"
                              onClick={() =>
                                deactivateCategory(
                                  category
                                )
                              }
                              disabled={
                                saving
                              }
                            >
                              <span className="icon is-small">
                                <FaBan />
                              </span>

                              <span>
                                Deactivate
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="button is-success is-light"
                              onClick={() =>
                                reactivateCategory(
                                  category
                                )
                              }
                              disabled={
                                saving
                              }
                            >
                              <span className="icon is-small">
                                <FaCheck />
                              </span>

                              <span>
                                Reactivate
                              </span>
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }
            )}

            {!loading &&
              visibleCategories.length ===
                0 && (
                <tr>
                  <td
                    colSpan="6"
                    className="has-text-centered has-text-grey py-4"
                  >
                    No shrinkage
                    categories found.
                  </td>
                </tr>
              )}

            {loading && (
              <tr>
                <td
                  colSpan="6"
                  className="has-text-centered py-4"
                >
                  Loading shrinkage
                  categories...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="is-size-7 has-text-grey mt-2">
        Deactivated categories remain
        available to historical capacity
        plans but cannot be assigned to
        new shrinkage items.
      </p>
    </div>
  );
}