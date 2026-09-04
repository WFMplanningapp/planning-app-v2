import Head from "next/head";
import { useState } from "react";
import { FaLock } from "react-icons/fa";

import StructureDropdown from "../components/selection/StructureDropdown";
import WeekDropdown from "../components/selection/WeekDropdown";
import { useAuth } from "../contexts/authContext";
import useData from "../hooks/useData";
import useForm from "../hooks/useForm";
import useWeeks from "../hooks/useWeeks";

const selectionFields = [
  {
    name: "project",
    default: null,
    required: true,
    type: "object",
    level: 1,
  },
  {
    name: "lob",
    default: null,
    required: true,
    type: "object",
    level: 2,
  },
  {
    name: "fromWeek",
    default: null,
    required: true,
    type: "object",
    level: 1,
  },
  {
    name: "toWeek",
    default: null,
    required: true,
    type: "object",
    level: 1,
  },
];

const formatNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(numericValue);
};

const formatLabel = (value) => {
  if (!value) {
    return "Not available";
  }

  return String(value)
    .replaceAll("-", " ")
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
};

const CanonicalCapacityPrototype = () => {
  const [rows, setRows] = useState([]);
  const [generated, setGenerated] =
    useState(false);
  const [loading, setLoading] =
    useState(false);
  const [requestError, setRequestError] =
    useState(null);

  const auth = useAuth();

  const data = useData([
    "projects",
    "lobs",
    "capPlans",
    "weeks",
  ]);

  const sortedWeeks = Array.isArray(
    data.weeks
  )
    ? [...data.weeks].sort((a, b) => {
        if (a.firstDate > b.firstDate) {
          return 1;
        }

        if (a.firstDate < b.firstDate) {
          return -1;
        }

        return 0;
      })
    : undefined;

  const weeks = useWeeks(sortedWeeks);

  const selection = useForm({
    fields: selectionFields,
  });

  const resetOutput = () => {
    setRows([]);
    setGenerated(false);
    setRequestError(null);
  };

  const handleGenerate = async () => {
    const selectedProject =
      selection.get("project");
    const selectedLob = selection.get("lob");
    const fromWeek =
      selection.get("fromWeek");
    const toWeek = selection.get("toWeek");

    if (
      !selectedProject ||
      !selectedLob ||
      !fromWeek?.code ||
      !toWeek?.code
    ) {
      setRequestError(
        "Select a project, LOB, and valid week range."
      );
      return;
    }

    const authorization =
      auth.authorization();

    if (!authorization) {
      setRequestError(
        "Authentication is required to load capacity data."
      );
      return;
    }

    const availableLobs = Array.isArray(
      data.lobs
    )
      ? data.lobs
      : [];

    const availablePlans = Array.isArray(
      data.capPlans
    )
      ? data.capPlans
      : [];

    let selectedLobs = [];

    if (selectedLob._id) {
      selectedLobs = availableLobs.filter(
        (lob) => lob._id === selectedLob._id
      );
    } else {
      selectedLobs = availableLobs.filter(
        (lob) =>
          lob.project === selectedProject._id
      );
    }

    const selectedLobIds = new Set(
      selectedLobs.map((lob) => lob._id)
    );

    const capacityPlans =
      availablePlans.filter((capacityPlan) =>
        selectedLobIds.has(capacityPlan.lob)
      );

    if (capacityPlans.length === 0) {
      setRows([]);
      setGenerated(true);
      setRequestError(
        "No capacity plans were found for the selected scope."
      );
      return;
    }

    const parameters = new URLSearchParams({
      from: fromWeek.code,
      to: toWeek.code,
      selected: capacityPlans
        .map((capacityPlan) => capacityPlan._id)
        .join(","),
      responseModel: "canonical",
    });

    try {
      setLoading(true);
      setGenerated(false);
      setRequestError(null);
      setRows([]);

      const response = await fetch(
        `/api/capacity/multiple?${parameters.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: authorization,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "Unable to generate canonical capacity data."
        );
      }

      const canonicalRows = Array.isArray(
        result.canonicalCapacity
      )
        ? result.canonicalCapacity
        : [];

      setRows(canonicalRows);
      setGenerated(true);
    } catch (error) {
      console.error(
        "Canonical capacity request failed:",
        error
      );

      setRows([]);
      setGenerated(false);
      setRequestError(
        error.message ||
          "Unable to generate canonical capacity data."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>
          Planning App | Canonical Capacity Prototype
        </title>
      </Head>

      <main className="column has-text-left">
        <header className="mb-5 has-text-left">
          <p className="is-size-7 has-text-weight-semibold has-text-info mb-2">
            CANONICAL CAPACITY MODEL V2
          </p>

          <h1 className="title is-4 mb-3 has-text-left">
            Canonical Capacity Prototype
          </h1>

          <p className="subtitle is-6 has-text-left">
            Controlled validation page using only
            canonical capacity properties. Existing
            reports and legacy API responses remain
            unchanged.
          </p>
        </header>

        {!auth.allowedManager ? (
          <section
            className="message is-danger is-size-5 px-5 py-5"
            aria-label="Unauthorized access"
          >
            <span aria-hidden="true">
              <FaLock />
            </span>{" "}
            UNAUTHORIZED ACCESS
          </section>
        ) : (
          <>
            <section
              className="box has-text-left"
              aria-labelledby="prototype-selection-title"
            >
              <h2
                id="prototype-selection-title"
                className="title is-5 has-text-left"
              >
                Select capacity scope
              </h2>

              {data.error && (
                <div
                  className="notification is-danger is-light has-text-left"
                  role="alert"
                >
                  {data.error}
                </div>
              )}

              <div className="columns">
                <div className="column field">
                  <label className="label">
                    Project and LOB
                  </label>

                  <StructureDropdown
                    structureName="project"
                    selection={selection}
                    data={data.projects}
                    disabled={false}
                    reset={[
                      "country",
                      "lob",
                      "capPlan",
                    ]}
                    callback={(form) => {
                      form.resetAll();
                      resetOutput();
                    }}
                  />

                  <StructureDropdown
                    structureName="lob"
                    selection={selection}
                    reset={["capPlan"]}
                    data={
                      selection.get("project") &&
                      Array.isArray(data.lobs)
                        ? [
                            {
                              name: "SELECT ALL",
                            },
                            ...data.lobs.filter(
                              (lob) =>
                                lob.project ===
                                selection.get(
                                  "project"
                                )._id
                            ),
                          ]
                        : undefined
                    }
                    callback={resetOutput}
                    disabled={
                      !selection.get("project")
                    }
                  />
                </div>

                <div className="column field">
                  <label className="label">
                    Week range
                  </label>

                  <WeekDropdown
                    fieldName="fromWeek"
                    label="From-Week"
                    form={selection}
                    weekRange={
                      weeks &&
                      weeks.getWeekRange(
                        "2021w1",
                        null
                      )
                    }
                    disabled={
                      !selection.get("lob")
                    }
                    callback={(form, selected) => {
                      if (
                        form.get("toWeek") &&
                        selected.firstDate >
                          form.get("toWeek")
                            .firstDate
                      ) {
                        form.setMany({
                          ...form.getForm(),
                          fromWeek: selected,
                          toWeek: selected,
                        });
                      }

                      resetOutput();
                    }}
                  />

                  <WeekDropdown
                    fieldName="toWeek"
                    label="To-Week"
                    form={selection}
                    weekRange={
                      weeks &&
                      weeks.getWeekRange(
                        "2021w1",
                        null
                      )
                    }
                    disabled={
                      !selection.get("lob")
                    }
                    callback={(form, selected) => {
                      if (
                        form.get("fromWeek") &&
                        selected.firstDate <
                          form.get("fromWeek")
                            .firstDate
                      ) {
                        form.setMany({
                          ...form.getForm(),
                          fromWeek: selected,
                          toWeek: selected,
                        });
                      }

                      resetOutput();
                    }}
                  />
                </div>
              </div>

              <div className="field mt-4">
                <button
                  type="button"
                  className={`button is-primary is-small is-rounded ${
                    loading ? "is-loading" : ""
                  }`}
                  onClick={handleGenerate}
                  disabled={
                    loading ||
                    !selection.checkRequired()
                  }
                >
                  Generate canonical view
                </button>
              </div>

              <p className="help has-text-left">
                This prototype explicitly requests{" "}
                <code>
                  responseModel=canonical
                </code>
                . It does not request or process the
                legacy multiple array.
              </p>
            </section>

            {requestError && (
              <div
                className="notification is-danger is-light has-text-left"
                role="alert"
              >
                {requestError}
              </div>
            )}

            {loading && (
              <div
                className="notification is-info is-light has-text-left"
                role="status"
                aria-live="polite"
              >
                Loading canonical capacity data…
              </div>
            )}

            {generated &&
              !loading &&
              rows.length === 0 && (
                <div
                  className="notification is-warning is-light has-text-left"
                  role="status"
                >
                  No canonical capacity rows were
                  returned for the selected scope.
                </div>
              )}

            {generated && rows.length > 0 && (
              <section
                className="box mt-5 has-text-left"
                aria-labelledby="canonical-results-title"
              >
                <div className="mb-4 has-text-left">
                  <h2
                    id="canonical-results-title"
                    className="title is-5 mb-2 has-text-left"
                  >
                    Canonical capacity results
                  </h2>

                  <p className="has-text-left">
                    {rows.length} canonical weekly{" "}
                    {rows.length === 1
                      ? "record"
                      : "records"}{" "}
                    returned.
                  </p>
                </div>

                <div className="table-container">
                  <table className="table is-fullwidth is-striped is-hoverable">
                    <caption className="is-sr-only">
                      Canonical capacity results by
                      capacity plan and week
                    </caption>

                    <thead>
                      <tr>
                        <th scope="col">
                          Capacity plan
                        </th>
                        <th scope="col">Week</th>
                        <th scope="col">Period</th>
                        <th scope="col">
                          Availability source
                        </th>
                        <th scope="col">
                          Productive availability
                        </th>
                        <th scope="col">
                          Productive requirement
                        </th>
                        <th scope="col">
                          Productive gap
                        </th>
                        <th scope="col">
                          Requirement source
                        </th>
                        <th scope="col">
                          Data status
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row, index) => {
                        const planId =
                          row.identity
                            ?.capacityPlanId ||
                          "unknown-plan";

                        const weekCode =
                          row.period?.code ||
                          `row-${index}`;

                        return (
                          <tr
                            key={`${planId}-${weekCode}-${index}`}
                          >
                            <td>
                              {row.identity
                                ?.capacityPlanName ||
                                "Unnamed plan"}
                            </td>

                            <td>
                              {row.period?.code ||
                                "—"}
                            </td>

                            <td>
                              {formatLabel(
                                row.period?.type
                              )}
                            </td>

                            <td>
                              {formatLabel(
                                row.period
                                  ?.availabilitySource
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                row.availability
                                  ?.productive
                                  ?.value
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                row.requirements
                                  ?.productive
                                  ?.value
                              )}
                            </td>

                            <td>
                              {formatNumber(
                                row.gaps
                                  ?.productive
                              )}
                            </td>

                            <td>
                              {formatLabel(
                                row.requirements
                                  ?.productive
                                  ?.source
                              )}
                            </td>

                            <td>
                              {row.dataQuality
                                ?.isComplete
                                ? "Complete"
                                : "Review required"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
};

export default CanonicalCapacityPrototype;