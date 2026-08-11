// ============================================
// CAPACITY PLANNER PAGE
// Wires all engine components into a single workflow
// ============================================

import Head from "next/head";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/authContext";
import useData from "../hooks/useData";
import useForm from "../hooks/useForm";
import useWeeks from "../hooks/useWeeks";
import StructureDropdown from "../components/selection/StructureDropdown";
import WeekDropdown from "../components/selection/WeekDropdown";
import { FaLock, FaPlay, FaCog, FaChevronDown, FaChevronUp } from "react-icons/fa";

// Engine Components — Batch 4 (Config & Input)
//import ChannelConfigurator from "../components/capacity-engine/ChannelConfigurator";
import ForecastUploader from "../components/capacity-engine/ForecastUploader";
import PatternManager from "../components/capacity-engine/PatternManager";
import ShrinkagePlanEditor from "../components/capacity-engine/ShrinkagePlanEditor";

// Engine Components — Batch 5 (Visualization)
import IntervalHeatmap from "../components/capacity-engine/IntervalHeatmap";
import CombinedIntervalHeatmap from "../components/capacity-engine/CombinedIntervalHeatmap";
import KPICards from "../components/capacity-engine/KPICards";
import BlendingPanel from "../components/capacity-engine/BlendingPanel";
import CombinedView from "../components/capacity-engine/CombinedView";
import CalculationExport from "../components/capacity-engine/CalculationExport";

// ── Selection fields ──
const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level: 1 },
  { name: "lob", default: null, required: true, type: "object", level: 2 },
  { name: "country", default: null, required: true, type: "object", level: 3 },
  { name: "capPlan", default: null, required: true, type: "object", level: 4 },
  { name: "fromWeek", default: null, required: true, type: "object", level: 1 },
  { name: "toWeek", default: null, required: true, type: "object", level: 1 },
];

// ── Collapsible Section ──
function Section({ title, icon, defaultOpen, children, badge }) {
  const [open, setOpen] = useState(defaultOpen || false);

  return (
    <div className="mb-4">
      <div
        className="is-flex is-align-items-center is-clickable py-2"
        onClick={() => setOpen(!open)}
        style={{
          cursor: "pointer",
          borderBottom: "1px solid #eee",
          userSelect: "none",
        }}
      >
        <span className="icon is-small mr-2 has-text-info">
          {open ? <FaChevronUp /> : <FaChevronDown />}
        </span>
        {icon && <span className="mr-2">{icon}</span>}
        <strong className="is-size-6">{title}</strong>
        {badge && (
          <span className="tag is-small is-info is-light ml-2">{badge}</span>
        )}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

// ── Helper: Get week dates array ──
function getWeekDates(weekDoc) {
  const dates = [];
  const start = new Date(
    weekDoc.firstDate instanceof Date
      ? weekDoc.firstDate.toISOString()
      : weekDoc.firstDate
  );
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function CapacityPlanner() {
  const auth = useAuth();

  // Data hooks
  const data = useData([
    "countries",
    "projects",
    "lobs",
    "capPlans",
    "languages",
    "weeks",
  ]);

  const weeks = useWeeks(
    data.weeks &&
      data.weeks.sort((a, b) =>
        a.firstDate > b.firstDate ? 1 : a.firstDate < b.firstDate ? -1 : 0
      )
  );

  const selection = useForm({ fields: selectionFields });

  // State
  const [channelsConfig, setChannelsConfig] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [
  blendingApplying,
  setBlendingApplying,
] = useState(false);

const [
  blendingDirty,
  setBlendingDirty,
] = useState(false);
  const [results, setResults] = useState(null);
  const [selectedResultWeek, setSelectedResultWeek] = useState(null);
  const [message, setMessage] = useState(null);
  const [activeTab, setActiveTab] = useState("heatmap");
  const [selectedHeatmapChannel, setSelectedHeatmapChannel] =
  useState("all");

  // Derived
  const capPlan = selection.get("capPlan");
  const capPlanId = capPlan ? capPlan._id : null;
  const fromWeek = selection.get("fromWeek");
  const toWeek = selection.get("toWeek");

  // Load config when capPlan changes — now reads from capPlan document
  useEffect(() => {
  setSelectedHeatmapChannel("all");

  if (!capPlan) {
    setChannelsConfig(null);
    setResults(null);
    return;
  }

  if (
    capPlan.engineEnabled &&
    capPlan.engineChannels
  ) {
    setChannelsConfig(
      capPlan.engineChannels
    );
  } else {
    setChannelsConfig(null);
  }
}, [capPlan]);

  // Build week codes for calculation
  const getWeekCodes = useCallback(() => {
    if (!fromWeek || !toWeek || !weeks) return [];
    const range = weeks.getWeekRange(fromWeek.code, toWeek.code);
    return range ? range.map((w) => w.code) : [];
  }, [fromWeek, toWeek, weeks]);

  // Build week docs for shrinkage editor
  const getSelectedWeekDocs = useCallback(() => {
    if (!fromWeek || !toWeek || !weeks) return [];
    return weeks.getWeekRange(fromWeek.code, toWeek.code) || [];
  }, [fromWeek, toWeek, weeks]);

  const refreshStoredResults = async (
  preferredWeek = null
) => {
  if (!capPlanId) {
    return [];
  }

  const weekCodes =
    getWeekCodes();

  const response = await fetch(
    `/api/capacity-engine/results?capPlan=${capPlanId}`,
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
      responseData.message ||
        "Failed to load calculation results."
    );
  }

  const filteredResults =
    weekCodes.length > 0
      ? (
          responseData.data || []
        ).filter((result) =>
          weekCodes.includes(
            result.week
          )
        )
      : responseData.data || [];

  setResults({
    weeklyResults:
      filteredResults.map(
        (result) => ({
          week: result.week,

          ...result.combinedWeeklyFTE,

          shrinkageSummary:
            result.shrinkageSummary ||
            null,
        })
      ),

    channelBreakdown:
      filteredResults.map(
        (result) => ({
          week: result.week,

          channels:
            result.channelWeeklyFTE,

          combined:
            result.combinedWeeklyFTE,

          shrinkageSummary:
            result.shrinkageSummary ||
            null,

          blendingPlan:
            result.blendingPlan,

          blendingSummary:
            result.blendingSummary,
        })
      ),

    fullResults:
      filteredResults,
  });

  const preferredExists =
    filteredResults.some(
      (result) =>
        result.week ===
        preferredWeek
    );

  if (preferredExists) {
    setSelectedResultWeek(
      preferredWeek
    );
  } else if (
    filteredResults.length > 0
  ) {
    setSelectedResultWeek(
      filteredResults[0].week
    );
  }

  return filteredResults;
};

  // ── Run Calculation ──
  const runCalculation = async () => {
    const weekCodes = getWeekCodes();
    if (!capPlanId || weekCodes.length === 0) {
      setMessage({ type: "warning", text: "Select a cap plan and week range first." });
      return;
    }

    setCalculating(true);
    setMessage(null);
    setResults(null);

    try {
      const response = await fetch("/api/capacity-engine/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: auth.authorization(),
        },
        body: JSON.stringify({
          capPlan: capPlanId,
          weeks: weekCodes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage({ type: "danger", text: data.message || "Calculation failed" });
        setCalculating(false);
        return;
      }

      // Fetch full results with interval data
      const resultsResponse = await fetch(
        `/api/capacity-engine/results?capPlan=${encodeURIComponent(
          capPlanId
        )}`,
        {
          headers: {
            Authorization:
              auth.authorization(),
          },
        }
      );
      const resultsData = 
        await resultsResponse.json();

      if (!resultsResponse.ok) {
        throw new Error(
          resultsData.message ||
            " stored calculation results could not be loaded."
        );
      }

      // Filter to selected week range
      const filteredResults = (resultsData.data || []).filter((r) =>
        weekCodes.includes(r.week)
      );

      setResults({
        weeklyResults: data.weeklyResults,
        channelBreakdown: data.channelBreakdown,
        fullResults: filteredResults,
      });

      // Default to first week for heatmap
      if (filteredResults.length > 0) {
        setSelectedResultWeek(filteredResults[0].week);
      }

      setMessage({
        type: "success",
        text: data.message,
      });
    } catch (err) {
      setMessage({ type: "danger", text: "Calculation failed: " + err.message });
    }
    setCalculating(false);
  };

  // ── Load existing results without recalculating ──
  const loadResults = async () => {
    if (!capPlanId) return;

    try {
      const loadedResults =
        await refreshStoredResults(
          selectedResultWeek
        );

      if (
        loadedResults.length === 0
      ) {
        setMessage({
          type: "warning",
          text:
            "No existing results found for this range.",
        });

        return;
      }

      setMessage({
        type: "info",
        text: `Loaded ${loadedResults.length} existing result(s).`,
      });
    } catch (error) {
      setMessage({
        type: "danger",
        text:
          "Failed to load results: " +
          error.message,
      });
    }
  };

  const handleApplyBlending =
  async ({
    occupancyTarget,
    allocations,
  }) => {
    if (
      !capPlanId ||
      !selectedResultWeek
    ) {
      setMessage({
        type: "warning",
        text:
          "Select a calculated week before applying blending.",
      });

      return;
    }

    setBlendingApplying(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/capacity-engine/calculate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              auth.authorization(),
          },

          body: JSON.stringify({
            capPlan: capPlanId,

            weeks: [
              selectedResultWeek,
            ],

            blendingPlan: {
              week:
                selectedResultWeek,

              occupancyTarget,

              allocations,
            },
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Blending calculation failed."
        );
      }

      await refreshStoredResults(
        selectedResultWeek
      );

      const weekBreakdown =
        (
          responseData.channelBreakdown ||
          []
        ).find(
          (item) =>
            item.week ===
            selectedResultWeek
        );

      const summary =
        weekBreakdown?.blendingSummary;

      setBlendingDirty(false);

      setMessage({
        type: "success",

        text: summary
          ? `Blending applied to ${selectedResultWeek}: ${Number(
              summary.allocatedHours ||
                0
            ).toFixed(
              1
            )} of ${Number(
              summary.requestedHours ||
                0
            ).toFixed(
              1
            )} requested hours allocated.`
          : `Blending applied to ${selectedResultWeek}.`,
      });
    } catch (error) {
      setMessage({
        type: "danger",
        text:
          "Blending failed: " +
          error.message,
      });

      throw error;
    } finally {
      setBlendingApplying(false);
    }
  };

const handleResetBlending =
  async () => {
    if (
      !capPlanId ||
      !selectedResultWeek
    ) {
      return;
    }

    setBlendingApplying(true);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/capacity-engine/calculate",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              auth.authorization(),
          },

          body: JSON.stringify({
            capPlan: capPlanId,

            weeks: [
              selectedResultWeek,
            ],

            clearBlendingWeek:
              selectedResultWeek,
          }),
        }
      );

      const responseData =
        await response.json();

      if (!response.ok) {
        throw new Error(
          responseData.message ||
            "Blending reset failed."
        );
      }

      await refreshStoredResults(
        selectedResultWeek
      );

      setBlendingDirty(false);

      setMessage({
        type: "success",
        text: `Blending was reset for ${selectedResultWeek}. Baseline results were recalculated.`,
      });
    } catch (error) {
      setMessage({
        type: "danger",
        text:
          "Blending reset failed: " +
          error.message,
      });

      throw error;
    } finally {
      setBlendingApplying(false);
    }
  };

  const confirmDiscardBlending =
  () => {
    if (!blendingDirty) {
      return true;
    }

    return window.confirm(
      "You have unapplied blending changes. Discard them?"
    );
  };

const changeResultWeek = (
  nextWeek
) => {
  if (
    nextWeek ===
    selectedResultWeek
  ) {
    return;
  }

  if (
    !confirmDiscardBlending()
  ) {
    return;
  }

  setBlendingDirty(false);
  setSelectedResultWeek(
    nextWeek
  );
};

const changeActiveTab = (
  nextTab
) => {
  if (nextTab === activeTab) {
    return;
  }

  if (
    activeTab === "blending" &&
    !confirmDiscardBlending()
  ) {
    return;
  }

  setBlendingDirty(false);
  setActiveTab(nextTab);
};

  // ── Get current week result for visualization ──
  const currentWeekResult = results?.fullResults?.find(
    (r) => r.week === selectedResultWeek
  );
  // ── Current week blending status ──
const currentBlendingPlan =
  currentWeekResult?.blendingPlan;

const currentBlendingSummary =
  currentWeekResult?.blendingSummary;

const plannedBlendHours =
  Object.values(
    currentBlendingPlan?.allocations || {}
  ).reduce(
    (total, value) =>
      total + (Number(value) || 0),
    0
  );

const requestedBlendHours =
  Number(
    currentBlendingSummary?.requestedHours ??
      plannedBlendHours
  ) || 0;

const allocatedBlendHours =
  Number(
    currentBlendingSummary?.allocatedHours
  ) || 0;

const unallocatedBlendHours =
  Number(
    currentBlendingSummary?.unallocatedHours ??
      Math.max(
        0,
        requestedBlendHours -
          allocatedBlendHours
      )
  ) || 0;

const blendOccupancyTarget =
  Number(
    currentBlendingSummary?.occupancyTarget ??
      currentBlendingPlan?.occupancyTarget
  ) || 90;

const blendingIsConfigured =
  requestedBlendHours > 0;

const blendingIsActive =
  allocatedBlendHours > 0;

const blendingIsPartial =
  blendingIsActive &&
  unallocatedBlendHours > 0;

  // ── Get shrinkage week dates ──
  const shrinkageWeekDoc = getSelectedWeekDocs().find(
    (w) => w.code === (selectedResultWeek || fromWeek?.code)
  );
  const shrinkageWeekDates = shrinkageWeekDoc
    ? getWeekDates(shrinkageWeekDoc)
    : [];

  return (
    <>
      <Head>
        <title>Planning App | Capacity Planner</title>
      </Head>

      <div>
        <h1 className="has-text-centered mb-2 is-size-5">CAPACITY PLANNER</h1>

        <div className="column">
          {!auth.allowedGuest ? (
            <div className="message is-danger is-size-5 px-5 py-5">
              <span>
                <FaLock />
              </span>{" "}
              UNAUTHORIZED ACCESS
            </div>
          ) : (
            <div>
              {/* ============================================ */}
              {/* SELECTION BAR */}
              {/* ============================================ */}
              <div className="box mb-4">
                {/* Row 1: Structure Selection */}
                <div className="columns is-multiline is-vcentered mb-0">
                  <div className="column is-3">
                    <StructureDropdown
                      structureName="project"
                      selection={selection}
                      data={
                        data && data.projects
                          ? [...data.projects].sort((a, b) =>
                              a.name.localeCompare(b.name)
                            )
                          : []
                      }
                      disabled={false}
                      reset={["lob", "country", "capPlan"]}
                      callback={(f) => f.resetAll()}
                    />
                  </div>
                  <div className="column is-3">
                    <StructureDropdown
                      structureName="lob"
                      selection={selection}
                      reset={["capPlan"]}
                      data={
                        data &&
                        selection.get("project") &&
                        data.lobs
                          .filter(
                            (lob) =>
                              lob.project === selection.get("project")._id
                          )
                          .sort((a, b) => a.name.localeCompare(b.name))
                      }
                      disabled={
                        !selection.get("project") ||
                        data.lobs.filter(
                          (lob) =>
                            lob.project === selection.get("project")._id
                        ).length <= 0
                      }
                    />
                  </div>
                  <div className="column is-3">
                    <StructureDropdown
                      structureName="country"
                      selection={selection}
                      data={
                        data &&
                        selection.get("lob") &&
                        data.countries
                          .filter((country) => {
                            const selectedLob = selection.get("lob")._id;
                            const capPlanLobs = data.capPlans.filter(
                              (cp) => cp.lob === selectedLob
                            );
                            return capPlanLobs.find(
                              (cp) => cp.country === country.name
                            );
                          })
                          .sort((a, b) => a.name.localeCompare(b.name))
                      }
                      disabled={!selection.get("lob")}
                      reset={["capPlan"]}
                      callback={(f) => f.resetAll()}
                    />
                  </div>
                  <div className="column is-3">
                    <StructureDropdown
                      structureName="capPlan"
                      selection={selection}
                      data={
                        data &&
                        selection.get("lob") &&
                        selection.get("country") &&
                        data.capPlans
                          .filter(
                            (cp) =>
                              cp.lob === selection.get("lob")._id &&
                              cp.country === selection.get("country").name
                          )
                          .sort((a, b) => a.name.localeCompare(b.name))
                      }
                      disabled={!selection.get("country")}
                    />
                  </div>
                </div>

                {/* Row 2: Weeks + Actions */}
                <div className="columns is-vcentered mb-0">
                  <div className="column is-2">
                    <WeekDropdown
                      fieldName="fromWeek"
                      label="From"
                      form={selection}
                      weekRange={
                        weeks &&
                        weeks.getWeekRange(
                          capPlan ? capPlan.firstWeek : "2021w1",
                          null
                        )
                      }
                      disabled={!capPlan}
                      callback={(f, s) => {
                        if (
                          f.get("toWeek") &&
                          s.firstDate > f.get("toWeek").firstDate
                        ) {
                          f.setMany({
                            ...f.getForm(),
                            toWeek: s,
                            fromWeek: s,
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="column is-2">
                    <WeekDropdown
                      fieldName="toWeek"
                      label="To"
                      form={selection}
                      weekRange={
                        weeks &&
                        weeks.getWeekRange(
                          capPlan ? capPlan.firstWeek : "2021w1",
                          null
                        )
                      }
                      disabled={!capPlan}
                      callback={(f, s) => {
                        if (
                          f.get("fromWeek") &&
                          s.firstDate < f.get("fromWeek").firstDate
                        ) {
                          f.setMany({
                            ...f.getForm(),
                            toWeek: s,
                            fromWeek: s,
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="column">
                    <div className="is-flex is-align-items-center" style={{ gap: "0.5rem", paddingTop: "0.5rem" }}>
                      <button
                        className="button is-small is-rounded is-info"
                        onClick={() => {
                          if (weeks && capPlan) {
                            selection.setMany({
                              ...selection.getForm(),
                              fromWeek: weeks.getWeekRelative("-1"),
                              toWeek: weeks.getWeekRelative("3"),
                            });
                          }
                        }}
                        disabled={!capPlan}
                      >
                        Auto
                      </button>
                      <button
                        className="button is-small is-rounded is-success"
                        onClick={runCalculation}
                        disabled={
                          calculating || !selection.checkRequired() || !channelsConfig
                        }
                      >
                        <span className="icon is-small">
                          <FaPlay />
                        </span>
                        <span>{calculating ? "Calculating..." : "Calculate"}</span>
                      </button>
                      <button
                        className="button is-small is-rounded is-light"
                        onClick={loadResults}
                        disabled={!capPlanId}
                      >
                        Load
                      </button>
                    </div>
                  </div>
                </div>

                {/* Status Messages */}
                {message && (
                  <div
                    className={`notification is-${message.type} is-light is-size-7 mb-0 mt-2 py-2`}
                  >
                    {message.text}
                  </div>
                )}

                {capPlanId && !channelsConfig && (
                  <div className="notification is-warning is-light is-size-7 mb-0 mt-2 py-2">
                    <FaCog className="mr-1" />
                    Capacity engine is not configured for this cap plan. Go to{' '}
                    <strong>Management → Cap Plans → Edit</strong> to enable it and configure channels.
                  </div>
              )}
              </div>

              {/* ============================================ */}
              {/* DATA INPUT — Forecast, Patterns, Shrinkage */}
              {/* ============================================ */}
              {capPlan && channelsConfig && (
                <div className="box mb-4">
                  <Section
                    title="Forecast"
                    icon="📊"
                    badge="Required"
                    defaultOpen={false}
                  >
                    <ForecastUploader
                      capPlanId={capPlanId}
                      channelsConfig={channelsConfig}
                      weekDocs={getSelectedWeekDocs()}
                      auth={auth}
                    />
                  </Section>

                  <Section
                    title="Patterns"
                    icon="📐"
                    badge="Required"
                    defaultOpen={false}
                  >
                    <PatternManager
                      capPlanId={capPlanId}
                      channelsConfig={channelsConfig}
                      intervalMinutes={capPlan.engineInterval || 30}
                      weekDocs={getSelectedWeekDocs()}
                    />
                  </Section>

                  <Section
                    title="Shrinkage Plan"
                    icon="📉"
                    defaultOpen={false}
                  >
                    <ShrinkagePlanEditor
                      capPlanId={capPlanId}
                      weekDocs={getSelectedWeekDocs()}
                    />
                  </Section>
                </div>
              )}

              {/* ============================================ */}
              {/* RESULTS */}
              {/* ============================================ */}
              {results && (
                <>
                  <hr />

                  {/* Week Selector + Export */}
                  <div className="is-flex is-align-items-center is-justify-content-space-between mb-3">
                    <div className="is-flex is-align-items-center" style={{ gap: "0.5rem" }}>
                      <label className="label is-small mb-0">Week:</label>
                      <div className="select is-small">
                        <select
                          value={selectedResultWeek || ""}
                          onChange={(event) =>
                            changeResultWeek(
                              event.target.value
                            )
                          }
                        >
                          {results.fullResults.map((r) => (
                            <option key={r.week} value={r.week}>
                              {r.week}
                            </option>
                          ))}
                        </select>
                      </div>
                      {blendingIsActive ? (
  <span
    className={`tag is-small ${
      blendingIsPartial
        ? "is-warning"
        : "is-success"
    }`}
    title={`Occupancy target: ${blendOccupancyTarget}% · Requested: ${requestedBlendHours.toFixed(
      1
    )} hrs · Allocated: ${allocatedBlendHours.toFixed(
      1
    )} hrs · Unallocated: ${unallocatedBlendHours.toFixed(
      1
    )} hrs`}
  >
    {blendingIsPartial
      ? "Blending partially applied"
      : "Blending active"}
    {" · "}
    {allocatedBlendHours.toFixed(1)} hrs
  </span>
) : blendingIsConfigured ? (
  <span
    className="tag is-small is-warning is-light"
    title={`Occupancy target: ${blendOccupancyTarget}% · Requested: ${requestedBlendHours.toFixed(
      1
    )} hrs · No eligible overlapping intervals were found.`}
  >
    Blending configured · no overlap
  </span>
) : (
  <span
    className="tag is-small is-light"
    title="No blending allocation is applied to this week."
  >
    Blending inactive
  </span>
)}

                      {/* Result Tabs */}
                      <div className="buttons has-addons are-small ml-3 mb-0">
                        {[
                          { key: "heatmap", label: "Heatmap" },
                          { key: "combined", label: "Combined" },
                          { key: "blending", label: "Blending" },
                        ].map((tab) => (
                          <button
                            key={tab.key}
                            className={`button is-small ${
                              activeTab === tab.key ? "is-info" : ""
                            }`}
                            onClick={() =>
                              changeActiveTab(tab.key)
                            }
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <CalculationExport
                      channelsConfig={channelsConfig}
                      channelResults={currentWeekResult?.channelResults}
                      weekCode={selectedResultWeek}
                      capPlanName={capPlan?.name}
                    />
                  </div>

                  {/* KPI Cards */}
                  <KPICards
                    weeklyFTE={
                      currentWeekResult
                        ?.combinedWeeklyFTE
                    }
                    channelResults={
                      currentWeekResult
                        ?.channelResults
                    }
                    channelsConfig={
                      channelsConfig
                    }
                    shrinkageSummary={
                      currentWeekResult
                        ?.shrinkageSummary
                    }
                  />

                  <br />

                  {/* Weekly Summary Table */}
                  {results.weeklyResults && results.weeklyResults.length > 1 && (
                    <div className="box mb-4">
                      <h4 className="title is-6 mb-2">Weekly Summary</h4>
                      <div className="table-container">
                        <table className="table is-narrow is-fullwidth is-striped is-size-7">
                          <thead>
                            <tr>
                              <th>Week</th>
                              <th className="has-text-centered">Productive FTE</th>
                              <th className="has-text-centered">InCenter FTE</th>
                              <th className="has-text-centered">Gross FTE</th>
                              <th className="has-text-centered">Productive Hrs</th>
                              <th className="has-text-centered">Gross Hrs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {results.weeklyResults.map((wr) => (
                              <tr
                                key={wr.week}
                                className={
                                  wr.week === selectedResultWeek
                                    ? "is-selected"
                                    : ""
                                }
                                onClick={() =>
                                  changeResultWeek(wr.week)
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <td>
                                  <strong>{wr.week}</strong>
                                </td>
                                <td className="has-text-centered">
                                  {wr.productiveFTE?.toFixed(2)}
                                </td>
                                <td className="has-text-centered">
                                  {wr.inCenterFTE?.toFixed(2)}
                                </td>
                                <td className="has-text-centered has-text-weight-bold">
                                  {wr.grossFTE?.toFixed(2)}
                                </td>
                                <td className="has-text-centered">
                                  {wr.hours_productive?.toFixed(0)}
                                </td>
                                <td className="has-text-centered">
                                  {wr.hours_gross?.toFixed(0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Active Tab Content */}
                  {activeTab === "heatmap" &&
                    currentWeekResult && (
                      <div>
                        {/* Channel selector */}
<div className="tabs is-toggle is-small mb-3">
  <ul style={{ flexWrap: "wrap" }}>
    <li
      className={
        selectedHeatmapChannel === "all"
          ? "is-active"
          : ""
      }
    >
      <a
        onClick={() =>
          setSelectedHeatmapChannel("all")
        }
        style={
          selectedHeatmapChannel === "all"
            ? {
                backgroundColor: "#4b4bf9",
                borderColor: "#4b4bf9",
                color: "#ffffff",
              }
            : undefined
        }
      >
        <span>📊</span>

        <span
          style={{
            color:
              selectedHeatmapChannel === "all"
                ? "#ffffff"
                : undefined,
          }}
        >
          All Channels
        </span>
      </a>
    </li>

    {Object.entries(
      channelsConfig || {}
    ).map(([key, config]) => {
      const isSelected =
        selectedHeatmapChannel === key;

      return (
        <li
          key={key}
          className={
            isSelected
              ? "is-active"
              : ""
          }
        >
          <a
            onClick={() =>
              setSelectedHeatmapChannel(key)
            }
            style={
              isSelected
                ? {
                    backgroundColor: "#4b4bf9",
                    borderColor: "#4b4bf9",
                    color: "#ffffff",
                  }
                : undefined
            }
          >
            <span
              style={{
                color: isSelected
                  ? "#ffffff"
                  : undefined,
              }}
            >
              {config?.icon || "•"}
            </span>

            <span
              style={{
                color: isSelected
                  ? "#ffffff"
                  : undefined,
              }}
            >
              {config?.name || key}
            </span>
          </a>
        </li>
      );
    })}
  </ul>
</div>

                        {/* Combined heatmap */}
                        {selectedHeatmapChannel ===
                          "all" && (
                          <CombinedIntervalHeatmap
                            channelResults={
                              currentWeekResult
                                .channelResults
                            }
                            channelsConfig={
                              channelsConfig
                            }
                            channelWeeklyFTE={
                              currentWeekResult
                                .channelWeeklyFTE
                            }
                            combinedWeeklyFTE={
                              currentWeekResult
                                .combinedWeeklyFTE
                            }
                            intervalMinutes={
                              currentWeekResult
                                ?.calculationConfig
                                ?.intervalMinutes ||
                              capPlan?.engineInterval ||
                              30
                            }
                            fteHoursWeekly={
                              currentWeekResult
                                ?.calculationConfig
                                ?.fteHoursWeekly ||
                              capPlan?.fteHoursWeekly ||
                              40
                            }
                          />
                        )}

                        {/* Selected individual channel */}
                        {selectedHeatmapChannel !==
                          "all" &&
                          currentWeekResult
                            .channelResults?.[
                            selectedHeatmapChannel
                          ] && (
                            <IntervalHeatmap
                              channelName={
                                channelsConfig?.[
                                  selectedHeatmapChannel
                                ]?.name ||
                                selectedHeatmapChannel
                              }
                              dailyResults={
                                currentWeekResult
                                  .channelResults[
                                  selectedHeatmapChannel
                                ]
                              }
                              intervalMinutes={
                                currentWeekResult
                                  ?.calculationConfig
                                  ?.intervalMinutes ||
                                capPlan?.engineInterval ||
                                30
                              }
                              maxShiftHours={
                                channelsConfig?.[
                                  selectedHeatmapChannel
                                ]?.maxShiftHours ?? 8
                              }
                              fteHoursWeekly={
                                currentWeekResult
                                  ?.calculationConfig
                                  ?.fteHoursWeekly ||
                                capPlan?.fteHoursWeekly ||
                                40
                              }
                              weeklyFTE={
                                currentWeekResult
                                  ?.channelWeeklyFTE?.[
                                  selectedHeatmapChannel
                                ] || null
                              }
                            />
                          )}
                      </div>
                    )}

                  {activeTab === "combined" && currentWeekResult && (
                    <CombinedView
                      channelResults={currentWeekResult.channelResults}
                      channelsConfig={channelsConfig}
                      channelWeeklyFTE={currentWeekResult.channelWeeklyFTE}
                      combinedWeeklyFTE={currentWeekResult.combinedWeeklyFTE}
                    />
                  )}

                  {activeTab === "blending" && currentWeekResult && (
                    <BlendingPanel
                      channelResults={
                        currentWeekResult.channelResults
                      }
                      channelsConfig={
                        channelsConfig
                      }
                      channelWeeklyFTE={
                        currentWeekResult.channelWeeklyFTE
                      }
                      blendingPlan={
                        currentWeekResult.blendingPlan
                      }
                      blendingSummary={
                        currentWeekResult.blendingSummary
                      }
                      isApplying={
                        blendingApplying
                      }
                      onBlendApplied={
                        handleApplyBlending
                      }
                      onBlendReset={
                        handleResetBlending
                      }
                      onDirtyChange={
                        setBlendingDirty
                      }
                    />
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}