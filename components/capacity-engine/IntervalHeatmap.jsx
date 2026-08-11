// ============================================
// INTERVAL HEATMAP
// Individual-channel weekly interval view
//
// Views:
// - Hours: interval hours for selected layer
// - FTE: concurrent interval staffing
// - Occ %: productive-staffing-weighted occupancy
// - Blend: blend hours
//
// Totals:
// - Daily FTE = daily layer hours / maxShiftHours
// - Weekly FTE = engine weekly result where available
// - Weekly fallback = weekly hours / fteHoursWeekly
// ============================================

import { useMemo, useState } from "react";

const COLORS = {
  low: {
    r: 139,
    g: 240,
    b: 187,
  },
  mid: {
    r: 75,
    g: 75,
    b: 249,
  },
  high: {
    r: 255,
    g: 141,
    b: 150,
  },
};

const VIEW_MODES = [
  { key: "hours", label: "Hours" },
  { key: "fte", label: "FTE" },
  { key: "occ", label: "Occ %" },
  { key: "blend", label: "Blend" },
];

const LAYER_MODES = [
  { key: "gross", label: "Gross" },
  { key: "inCenter", label: "InCenter" },
  { key: "productive", label: "Productive" },
];

const ZOOM_LEVELS = [
  { key: 1, label: "1:1" },
  { key: 2, label: "1:2" },
  { key: 4, label: "1:4" },
  { key: 8, label: "1:8" },
];

const WEEKLY_FTE_FIELDS = {
  gross: "grossFTE",
  inCenter: "inCenterFTE",
  productive: "productiveFTE",
};

function toNumber(value, fallback = 0) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function round(value, decimals = 2) {
  const multiplier = 10 ** decimals;

  return (
    Math.round(
      (toNumber(value) + Number.EPSILON) *
        multiplier
    ) / multiplier
  );
}

function getIntervalHours(interval, layer) {
  if (!interval) return 0;

  const standardField =
    interval[`hours_${layer}`];

  if (Number.isFinite(Number(standardField))) {
    return toNumber(standardField);
  }

  // Compatibility with possible alternate
  // field naming.
  const alternateField =
    interval[`${layer}Hours`];

  return toNumber(alternateField);
}

function getIntervalStaffing(interval, layer) {
  if (!interval) return 0;

  return toNumber(interval[layer]);
}

function getOccupancy(interval) {
  return toNumber(interval?.occupancy);
}

function getOccupancyWeight(interval) {
  if (!interval) return 0;

  // Productive staffing is the appropriate
  // weight for interval occupancy.
  const productive =
    toNumber(interval.productive);

  if (productive > 0) {
    return productive;
  }

  const productiveHours =
    getIntervalHours(
      interval,
      "productive"
    );

  return productiveHours > 0
    ? productiveHours
    : 0;
}

function weightedOccupancy(intervals) {
  const validIntervals = (
    intervals || []
  ).filter(
    (interval) =>
      getOccupancy(interval) > 0 &&
      getOccupancyWeight(interval) > 0
  );

  if (validIntervals.length === 0) {
    return 0;
  }

  const weightedTotal =
    validIntervals.reduce(
      (total, interval) =>
        total +
        getOccupancy(interval) *
          getOccupancyWeight(interval),
      0
    );

  const totalWeight =
    validIntervals.reduce(
      (total, interval) =>
        total +
        getOccupancyWeight(interval),
      0
    );

  return totalWeight > 0
    ? weightedTotal / totalWeight
    : 0;
}

function interpolateColor(value, min, max) {
  if (max <= min) {
    return `rgb(${COLORS.low.r},${COLORS.low.g},${COLORS.low.b})`;
  }

  const ratio = Math.max(
    0,
    Math.min(
      1,
      (value - min) / (max - min)
    )
  );

  let r;
  let g;
  let b;

  if (ratio <= 0.5) {
    const position = ratio * 2;

    r = Math.round(
      COLORS.low.r +
        position *
          (COLORS.mid.r - COLORS.low.r)
    );

    g = Math.round(
      COLORS.low.g +
        position *
          (COLORS.mid.g - COLORS.low.g)
    );

    b = Math.round(
      COLORS.low.b +
        position *
          (COLORS.mid.b - COLORS.low.b)
    );
  } else {
    const position =
      (ratio - 0.5) * 2;

    r = Math.round(
      COLORS.mid.r +
        position *
          (COLORS.high.r - COLORS.mid.r)
    );

    g = Math.round(
      COLORS.mid.g +
        position *
          (COLORS.high.g - COLORS.mid.g)
    );

    b = Math.round(
      COLORS.mid.b +
        position *
          (COLORS.high.b - COLORS.mid.b)
    );
  }

  return `rgb(${r},${g},${b})`;
}

function getTextColor(backgroundColor) {
  const match = backgroundColor.match(
    /rgb\((\d+),\s*(\d+),\s*(\d+)\)/
  );

  if (!match) {
    return "#09092d";
  }

  const red = Number(match[1]);
  const green = Number(match[2]);
  const blue = Number(match[3]);

  const luminance =
    (0.299 * red +
      0.587 * green +
      0.114 * blue) /
    255;

  return luminance > 0.55
    ? "#09092d"
    : "#ffffff";
}

function addMinutes(time, minutes) {
  if (
    !time ||
    !time.includes(":")
  ) {
    return time;
  }

  const [hours, minuteValue] =
    time.split(":").map(Number);

  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minuteValue)
  ) {
    return time;
  }

  const totalMinutes =
    hours * 60 +
    minuteValue +
    minutes;

  const normalized =
    ((totalMinutes % 1440) + 1440) %
    1440;

  const nextHours = Math.floor(
    normalized / 60
  );

  const nextMinutes =
    normalized % 60;

  return `${String(nextHours).padStart(
    2,
    "0"
  )}:${String(nextMinutes).padStart(
    2,
    "0"
  )}`;
}

function formatTimeGroup(
  group,
  intervalMinutes
) {
  if (!group || group.length === 0) {
    return "";
  }

  if (group.length === 1) {
    return group[0];
  }

  const start = group[0];

  const end = addMinutes(
    group[group.length - 1],
    intervalMinutes
  );

  return `${start}–${end}`;
}

function formatValue(value, viewMode) {
  const safeValue = toNumber(value);

  if (safeValue <= 0) {
    return "—";
  }

  if (viewMode === "occ") {
    return `${safeValue.toFixed(1)}%`;
  }

  if (safeValue < 10) {
    return safeValue.toFixed(2);
  }

  if (safeValue < 100) {
    return safeValue.toFixed(1);
  }

  return Math.round(
    safeValue
  ).toLocaleString();
}

function getUnitLabel(viewMode, layer) {
  if (viewMode === "occ") {
    return "occupancy";
  }

  if (viewMode === "blend") {
    return "blend hours";
  }

  if (viewMode === "hours") {
    return `${layer} hours`;
  }

  return `${layer} concurrent staffing`;
}

export default function IntervalHeatmap({
  channelName,
  dailyResults,
  intervalMinutes = 30,
  maxShiftHours = 8,
  fteHoursWeekly = 40,
  weeklyFTE = null,
}) {
  const [viewMode, setViewMode] =
    useState("fte");

  const [layer, setLayer] =
    useState("gross");

  const [zoom, setZoom] =
    useState(1);

  const safeIntervalMinutes =
    toNumber(intervalMinutes, 30) > 0
      ? toNumber(intervalMinutes, 30)
      : 30;

  const safeMaxShiftHours =
    toNumber(maxShiftHours, 8) > 0
      ? toNumber(maxShiftHours, 8)
      : 8;

  const safeWeeklyHours =
    toNumber(fteHoursWeekly, 40) > 0
      ? toNumber(fteHoursWeekly, 40)
      : 40;

  const heatmapData = useMemo(() => {
    if (
      !Array.isArray(dailyResults) ||
      dailyResults.length === 0
    ) {
      return {
        timeGroups: [],
        grid: {},
        dayTotals: {},
        weekTotal: 0,
        weeklySource: null,
        valueRange: {
          min: 0,
          max: 1,
        },
      };
    }

    // ----------------------------------------
    // Build a common set of interval times
    // ----------------------------------------

    const allTimes = new Set();

    dailyResults.forEach((day) => {
      (day.intervals || []).forEach(
        (interval) => {
          if (interval?.time) {
            allTimes.add(interval.time);
          }
        }
      );
    });

    const sortedTimes = [
      ...allTimes,
    ].sort();

    const timeGroups = [];

    for (
      let index = 0;
      index < sortedTimes.length;
      index += zoom
    ) {
      timeGroups.push(
        sortedTimes.slice(
          index,
          index + zoom
        )
      );
    }

    const grid = {};
    const dayTotals = {};
    const allPositiveValues = [];

    // ----------------------------------------
    // Build channel grid
    // ----------------------------------------

    dailyResults.forEach((day) => {
      const dateKey = day.date;

      grid[dateKey] = [];

      timeGroups.forEach((timeGroup) => {
        const intervals = (
          day.intervals || []
        ).filter((interval) =>
          timeGroup.includes(interval.time)
        );

        let value = 0;

        if (viewMode === "hours") {
          value = intervals.reduce(
            (total, interval) =>
              total +
              getIntervalHours(
                interval,
                layer
              ),
            0
          );
        }

        if (viewMode === "fte") {
          const staffingValues =
            intervals
              .map((interval) =>
                getIntervalStaffing(
                  interval,
                  layer
                )
              )
              .filter(
                (staffing) =>
                  Number.isFinite(staffing)
              );

          value =
            staffingValues.length > 0
              ? staffingValues.reduce(
                  (total, staffing) =>
                    total + staffing,
                  0
                ) /
                staffingValues.length
              : 0;
        }

        if (viewMode === "occ") {
          value =
            weightedOccupancy(
              intervals
            );
        }

        if (viewMode === "blend") {
          value = intervals.reduce(
            (total, interval) =>
              total +
              toNumber(
                interval.blendHours
              ),
            0
          );
        }

        const roundedValue =
          round(value, 2);

        grid[dateKey].push({
          value: roundedValue,
          intervals,
        });

        if (roundedValue > 0) {
          allPositiveValues.push(
            roundedValue
          );
        }
      });

      // --------------------------------------
      // Daily totals use original intervals,
      // not zoomed grid values.
      // --------------------------------------

      const dayIntervals =
        day.intervals || [];

      if (viewMode === "hours") {
        dayTotals[dateKey] =
          dayIntervals.reduce(
            (total, interval) =>
              total +
              getIntervalHours(
                interval,
                layer
              ),
            0
          );
      }

      if (viewMode === "fte") {
        const dailyLayerHours =
          dayIntervals.reduce(
            (total, interval) =>
              total +
              getIntervalHours(
                interval,
                layer
              ),
            0
          );

        dayTotals[dateKey] =
          dailyLayerHours /
          safeMaxShiftHours;
      }

      if (viewMode === "occ") {
        dayTotals[dateKey] =
          weightedOccupancy(
            dayIntervals
          );
      }

      if (viewMode === "blend") {
        dayTotals[dateKey] =
          dayIntervals.reduce(
            (total, interval) =>
              total +
              toNumber(
                interval.blendHours
              ),
            0
          );
      }

      dayTotals[dateKey] = round(
        dayTotals[dateKey],
        2
      );
    });
// ----------------------------------------
// Weekly total
// ----------------------------------------

    const allIntervals =
      dailyResults.flatMap(
        (day) => day.intervals || []
      );

    let weekTotal = 0;
    let weeklySource = null;

    if (viewMode === "hours") {
      weekTotal =
        allIntervals.reduce(
          (total, interval) =>
            total +
            getIntervalHours(
              interval,
              layer
            ),
          0
        );

      weeklySource =
        "interval hours";
    }

    if (viewMode === "fte") {
      const weeklyField =
        WEEKLY_FTE_FIELDS[layer];

      const engineWeeklyFTE =
        weeklyFTE &&
        Number.isFinite(
          Number(
            weeklyFTE[weeklyField]
          )
        )
          ? Number(
              weeklyFTE[weeklyField]
            )
          : null;

      if (engineWeeklyFTE !== null) {
        weekTotal =
          engineWeeklyFTE;

        weeklySource =
          "engine weekly FTE";
      } else {
        const weeklyLayerHours =
          allIntervals.reduce(
            (total, interval) =>
              total +
              getIntervalHours(
                interval,
                layer
              ),
            0
          );

        weekTotal =
          weeklyLayerHours /
          safeWeeklyHours;

        weeklySource =
          "weekly hours fallback";
      }
    }

    if (viewMode === "occ") {
      weekTotal =
        weightedOccupancy(
          allIntervals
        );

      weeklySource =
        "productive-weighted";
    }

    if (viewMode === "blend") {
      weekTotal =
        allIntervals.reduce(
          (total, interval) =>
            total +
            toNumber(
              interval.blendHours
            ),
          0
        );

      weeklySource =
        "interval blend hours";
    }

    return {
      timeGroups,
      grid,
      dayTotals,
      weekTotal: round(
        weekTotal,
        2
      ),
      weeklySource,
      valueRange: {
        min:
          allPositiveValues.length > 0
            ? Math.min(
                ...allPositiveValues
              )
            : 0,

        max:
          allPositiveValues.length > 0
            ? Math.max(
                ...allPositiveValues
              )
            : 1,
      },
    };
  }, [
    dailyResults,
    viewMode,
    layer,
    zoom,
    safeMaxShiftHours,
    safeWeeklyHours,
    weeklyFTE,
  ]);

  if (
    !Array.isArray(dailyResults) ||
    dailyResults.length === 0
  ) {
    return (
      <div className="notification is-light is-size-7">
        No calculation results to display.
      </div>
    );
  }

  const cellHeight =
    zoom === 1
      ? "2rem"
      : zoom === 2
      ? "2.5rem"
      : "3rem";

  const fontSize =
    zoom <= 2
      ? "0.6rem"
      : "0.7rem";

  const totalLabel =
    viewMode === "fte"
      ? "Daily FTE"
      : viewMode === "occ"
      ? "Weighted Occ."
      : "Day Total";

  return (
    <div className="box">
      {/* Header and controls */}
      <div
        className="is-flex is-align-items-center is-justify-content-space-between mb-3"
        style={{
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4 className="title is-6 mb-1">
            {channelName || "Heatmap"}
          </h4>

          {viewMode === "fte" && (
            <p className="is-size-7 has-text-grey mb-0">
              Daily FTE uses{" "}
              <strong>
                {safeMaxShiftHours}
              </strong>{" "}
              shift hours. Weekly FTE uses{" "}
              <strong>
                {safeWeeklyHours}
              </strong>{" "}
              hours.
            </p>
          )}
        </div>

        <div
          className="is-flex"
          style={{
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {/* View mode */}
          <div className="buttons has-addons are-small mb-0">
            {VIEW_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                className={`button is-small ${
                  viewMode === mode.key
                    ? "is-info"
                    : ""
                }`}
                onClick={() =>
                  setViewMode(mode.key)
                }
              >
                {mode.label}
              </button>
            ))}
          </div>

          {/* Layer */}
          {(viewMode === "hours" ||
            viewMode === "fte") && (
            <div className="buttons has-addons are-small mb-0">
              {LAYER_MODES.map(
                (layerOption) => (
                  <button
                    key={
                      layerOption.key
                    }
                    type="button"
                    className={`button is-small ${
                      layer ===
                      layerOption.key
                        ? "is-primary"
                        : ""
                    }`}
                    onClick={() =>
                      setLayer(
                        layerOption.key
                      )
                    }
                  >
                    {layerOption.label}
                  </button>
                )
              )}
            </div>
          )}

          {/* Zoom */}
          <div className="buttons has-addons are-small mb-0">
            {ZOOM_LEVELS.map(
              (zoomOption) => (
                <button
                  key={zoomOption.key}
                  type="button"
                  className={`button is-small ${
                    zoom ===
                    zoomOption.key
                      ? "is-dark"
                      : ""
                  }`}
                  onClick={() =>
                    setZoom(
                      zoomOption.key
                    )
                  }
                >
                  {zoomOption.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Heatmap */}
      <div
        className="table-container"
        style={{
          overflowX: "auto",
          overflow: "visible",
        }}
      >
        <table
          className="table is-bordered is-narrow"
          style={{
            fontSize,
            borderCollapse: "collapse",
          }}
        >
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  top: 0,
                  left: 0,
                  background: "#ffffff",
                  zIndex: 4,
                  minWidth: "90px",
                }}
              >
                Time
              </th>

              {dailyResults.map((day) => (
                <th
                  key={day.date}
                  className="has-text-centered"
                  style={{
                    position: "sticky",
                    top: 0,
                    background: "#ffffff",
                    zIndex: 3,
                    minWidth: "65px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.65rem",
                    }}
                  >
                    {day.dayName}
                  </div>

                  <div
                    style={{
                      fontSize: "0.55rem",
                      color: "#777",
                    }}
                  >
                    {day.date?.slice(5)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {heatmapData.timeGroups.map(
              (timeGroup, rowIndex) => {
                const timeLabel =
                  formatTimeGroup(
                    timeGroup,
                    safeIntervalMinutes
                  );

                return (
                  <tr
                    key={`${timeLabel}-${rowIndex}`}
                  >
                    <td
                      style={{
                        position: "sticky",
                        left: 0,
                        background:
                          "#ffffff",
                        zIndex: 2,
                        fontWeight: 600,
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {timeLabel}
                    </td>

                    {dailyResults.map(
                      (day) => {
                        const cell =
                          heatmapData.grid[
                            day.date
                          ]?.[rowIndex];

                        const value =
                          toNumber(
                            cell?.value
                          );

                        const background =
                          value > 0
                            ? interpolateColor(
                                value,
                                heatmapData
                                  .valueRange
                                  .min,
                                heatmapData
                                  .valueRange
                                  .max
                              )
                            : "#f9f9f9";

                        const color =
                          value > 0
                            ? getTextColor(
                                background
                              )
                            : "#b5b5b5";

                        const tooltip = [
                          `${day.dayName} ${day.date}`,
                          `Time: ${timeLabel}`,
                          `${getUnitLabel(
                            viewMode,
                            layer
                          )}: ${
                            viewMode ===
                            "occ"
                              ? `${value.toFixed(
                                  2
                                )}%`
                              : value.toFixed(
                                  2
                                )
                          }`,
                          `Intervals: ${
                            cell?.intervals
                              ?.length || 0
                          }`,
                        ].join("\n");

                        return (
                          <td
                            key={
                              day.date
                            }
                            className="has-text-centered"
                            style={{
                              background,
                              color,
                              height:
                                cellHeight,
                              padding:
                                "2px 4px",
                              fontWeight: 600,
                              cursor:
                                "default",
                            }}
                            title={tooltip}
                          >
                            {formatValue(
                              value,
                              viewMode
                            )}
                          </td>
                        );
                      }
                    )}
                  </tr>
                );
              }
            )}
          </tbody>

          <tfoot>
            <tr
              style={{
                fontWeight: 700,
                background: "#f3f3f7",
              }}
            >
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: "#f3f3f7",
                  zIndex: 2,
                  whiteSpace: "nowrap",
                }}
              >
                {totalLabel}
              </td>

              {dailyResults.map((day) => (
                <td
                  key={day.date}
                  className="has-text-centered"
                  title={
                    viewMode === "fte"
                      ? `Daily ${layer} hours divided by ${safeMaxShiftHours} shift hours`
                      : viewMode === "occ"
                      ? "Productive-staffing-weighted daily occupancy"
                      : undefined
                  }
                >
                  {formatValue(
                    heatmapData.dayTotals[day.date],
                    viewMode
                  )}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div
        className="is-flex is-justify-content-flex-end mt-2"
      >
        <div
          className="notification is-light py-2 px-3 mb-0 is-size-7"
        >
          <strong>
            {viewMode === "fte"
              ? "Weekly FTE"
              : viewMode === "occ"
              ? "Weekly weighted occupancy"
              : viewMode === "hours"
              ? "Weekly hours"
              : "Weekly blend hours"}
            :
          </strong>{" "}
          {formatValue(
            heatmapData.weekTotal,
            viewMode
          )}
        </div>
      </div>

      {/* Legend */}
      <div
        className="is-flex is-align-items-center mt-2"
        style={{
          gap: "0.5rem",
          flexWrap: "wrap",
        }}
      >
        <span className="is-size-7 has-text-grey">
          Low
        </span>

        <div
          style={{
            width: "120px",
            height: "10px",
            borderRadius: "5px",
            background: `linear-gradient(
              to right,
              rgb(${COLORS.low.r},${COLORS.low.g},${COLORS.low.b}),
              rgb(${COLORS.mid.r},${COLORS.mid.g},${COLORS.mid.b}),
              rgb(${COLORS.high.r},${COLORS.high.g},${COLORS.high.b})
            )`,
          }}
        />

        <span className="is-size-7 has-text-grey">
          High
        </span>

        <span className="is-size-7 has-text-grey ml-3">
          Viewing:{" "}
          <strong>
            {
              VIEW_MODES.find(
                (mode) =>
                  mode.key ===
                  viewMode
              )?.label
            }
          </strong>

          {(viewMode === "hours" ||
            viewMode === "fte") && (
            <>
              {" "}
              | Layer:{" "}
              <strong>
                {
                  LAYER_MODES.find(
                    (layerOption) =>
                      layerOption.key ===
                      layer
                  )?.label
                }
              </strong>
            </>
          )}

          {zoom > 1 && (
            <>
              {" "}
              | Zoom:{" "}
              <strong>
                {zoom}:1
              </strong>
            </>
          )}

          {heatmapData.weeklySource && (
            <>
              {" "}
              | Weekly source:{" "}
              <strong>
                {
                  heatmapData.weeklySource
                }
              </strong>
            </>
          )}
        </span>
      </div>
    </div>
  );
}