// ============================================
// COMBINED INTERVAL HEATMAP
// All channels in one weekly interval view
// ============================================

import { useMemo, useState } from "react";

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

// Foundever indigo tonal scale.
// Channels retain stable colors without changing
// according to staffing value.
const CHANNEL_COLORS = [
  "#4b4bf9", // Indigo
  "#8bf0bb", // Mint
  "#ff8d96", // Coral
  "#bfa1ff", // Lavender
  "#f9ef77", // Lemon
  "#09092d", // Midnight
];

const WEEKLY_FTE_FIELDS = {
  productive: "productiveFTE",
  inCenter: "inCenterFTE",
  gross: "grossFTE",
};

function toNumber(value, fallback = 0) {
  const result = Number(value);
  return Number.isFinite(result) ? result : fallback;
}

function round(value, decimals = 2) {
  const factor = 10 ** decimals;
  return (
    Math.round((toNumber(value) + Number.EPSILON) * factor) /
    factor
  );
}

function getHours(interval, layer) {
  if (!interval) return 0;

  const value = interval[`hours_${layer}`];

  if (Number.isFinite(Number(value))) {
    return toNumber(value);
  }

  return toNumber(interval[`${layer}Hours`]);
}

function getStaffing(interval, layer) {
  return toNumber(interval?.[layer]);
}

function getOccupancyWeight(interval) {
  const productive = toNumber(interval?.productive);

  if (productive > 0) return productive;

  return getHours(interval, "productive");
}

function weightedOccupancy(intervals) {
  const valid = (intervals || []).filter(
    (interval) =>
      toNumber(interval?.occupancy) > 0 &&
      getOccupancyWeight(interval) > 0
  );

  const totalWeight = valid.reduce(
    (total, interval) =>
      total + getOccupancyWeight(interval),
    0
  );

  if (totalWeight <= 0) return 0;

  return (
    valid.reduce(
      (total, interval) =>
        total +
        toNumber(interval.occupancy) *
          getOccupancyWeight(interval),
      0
    ) / totalWeight
  );
}

function addMinutes(time, minutes) {
  if (!time?.includes(":")) return time;

  const [hours, minuteValue] = time
    .split(":")
    .map(Number);

  const total =
    hours * 60 + minuteValue + minutes;

  const normalized =
    ((total % 1440) + 1440) % 1440;

  return `${String(
    Math.floor(normalized / 60)
  ).padStart(2, "0")}:${String(
    normalized % 60
  ).padStart(2, "0")}`;
}

function formatTimeGroup(group, intervalMinutes) {
  if (!group?.length) return "";

  if (group.length === 1) {
    return group[0];
  }

  return `${group[0]}–${addMinutes(
    group[group.length - 1],
    intervalMinutes
  )}`;
}

function formatValue(value, viewMode) {
  const safeValue = toNumber(value);

  if (safeValue <= 0) return "—";

  if (viewMode === "occ") {
    return `${safeValue.toFixed(1)}%`;
  }

  if (safeValue < 10) {
    return safeValue.toFixed(2);
  }

  if (safeValue < 100) {
    return safeValue.toFixed(1);
  }

  return Math.round(safeValue).toLocaleString();
}

function getCellMetric(intervals, viewMode, layer) {
  if (viewMode === "hours") {
    return intervals.reduce(
      (total, interval) =>
        total + getHours(interval, layer),
      0
    );
  }

  if (viewMode === "fte") {
    return intervals.reduce(
      (total, interval) =>
        total + getStaffing(interval, layer),
      0
    );
  }

  if (viewMode === "occ") {
    return weightedOccupancy(intervals);
  }

  return intervals.reduce(
    (total, interval) =>
      total + toNumber(interval?.blendHours),
    0
  );
}

export default function CombinedIntervalHeatmap({
  channelResults,
  channelsConfig,
  channelWeeklyFTE,
  combinedWeeklyFTE,
  intervalMinutes = 30,
  fteHoursWeekly = 40,
}) {
  const [viewMode, setViewMode] =
    useState("fte");

  const [layer, setLayer] =
    useState("gross");

  const [zoom, setZoom] =
    useState(1);

  const channelEntries = useMemo(
    () =>
      Object.entries(
        channelsConfig || {}
      ).map(([key, config], index) => ({
        key,
        config,
        color:
          CHANNEL_COLORS[
            index % CHANNEL_COLORS.length
          ],
      })),
    [channelsConfig]
  );

  const heatmapData = useMemo(() => {
    if (
      !channelResults ||
      channelEntries.length === 0
    ) {
      return {
        days: [],
        timeGroups: [],
        grid: {},
        dayTotals: {},
        weekTotal: 0,
        maxIntervalTotal: 1,
      };
    }

    const dayMap = new Map();
    const allTimes = new Set();

    channelEntries.forEach(({ key }) => {
      (channelResults[key] || []).forEach(
        (day) => {
          if (!dayMap.has(day.date)) {
            dayMap.set(day.date, {
              date: day.date,
              dayName: day.dayName,
            });
          }

          (day.intervals || []).forEach(
            (interval) => {
              if (interval?.time) {
                allTimes.add(interval.time);
              }
            }
          );
        }
      );
    });

    const days = [...dayMap.values()].sort(
      (a, b) =>
        String(a.date).localeCompare(
          String(b.date)
        )
    );

    const sortedTimes = [...allTimes].sort();
    const timeGroups = [];

    for (
      let index = 0;
      index < sortedTimes.length;
      index += zoom
    ) {
      timeGroups.push(
        sortedTimes.slice(index, index + zoom)
      );
    }

    const grid = {};
    const dayTotals = {};

    days.forEach((day) => {
      grid[day.date] = [];

      timeGroups.forEach((timeGroup) => {
        const channelBreakdown =
          channelEntries.map(
            ({ key, config, color }) => {
              const channelDay = (
                channelResults[key] || []
              ).find(
                (item) =>
                  item.date === day.date
              );

              const intervals = (
                channelDay?.intervals || []
              ).filter((interval) =>
                timeGroup.includes(interval.time)
              );

              let value = 0;

              if (viewMode === "fte") {
                // Average concurrent staffing
                // across the zoomed time group.
                value =
                  getCellMetric(
                    intervals,
                    viewMode,
                    layer
                  ) /
                  Math.max(
                    1,
                    timeGroup.length
                  );
              } else {
                value = getCellMetric(
                  intervals,
                  viewMode,
                  layer
                );
              }

              return {
                key,
                name: config?.name || key,
                icon: config?.icon || "",
                color,
                value: round(value, 2),
                intervals,
              };
            }
          );

        const allIntervals =
          channelBreakdown.flatMap(
            (channel) => channel.intervals
          );

        let total = 0;

        if (viewMode === "occ") {
          total =
            weightedOccupancy(allIntervals);
        } else {
          total = channelBreakdown.reduce(
            (sum, channel) =>
              sum + channel.value,
            0
          );
        }

        grid[day.date].push({
          total: round(total, 2),
          channelBreakdown,
          allIntervals,
        });
      });

      const channelDayData =
        channelEntries.map(
          ({ key, config }) => {
            const result = (
              channelResults[key] || []
            ).find(
              (item) =>
                item.date === day.date
            );

            return {
              key,
              config,
              intervals:
                result?.intervals || [],
            };
          }
        );

      const allDayIntervals =
        channelDayData.flatMap(
          (channel) => channel.intervals
        );

      if (viewMode === "hours") {
        dayTotals[day.date] =
          allDayIntervals.reduce(
            (total, interval) =>
              total +
              getHours(interval, layer),
            0
          );
      }

      if (viewMode === "fte") {
        // Each channel uses its own maximum
        // daily shift duration.
        dayTotals[day.date] =
          channelDayData.reduce(
            (total, channel) => {
              const hours =
                channel.intervals.reduce(
                  (sum, interval) =>
                    sum +
                    getHours(
                      interval,
                      layer
                    ),
                  0
                );

              const shiftHours =
                toNumber(
                  channel.config
                    ?.maxShiftHours,
                  8
                ) || 8;

              return (
                total +
                hours / shiftHours
              );
            },
            0
          );
      }

      if (viewMode === "occ") {
        dayTotals[day.date] =
          weightedOccupancy(
            allDayIntervals
          );
      }

      if (viewMode === "blend") {
        dayTotals[day.date] =
          allDayIntervals.reduce(
            (total, interval) =>
              total +
              toNumber(
                interval?.blendHours
              ),
            0
          );
      }

      dayTotals[day.date] = round(
        dayTotals[day.date],
        2
      );
    });

    // The full width of every cell represents the
    // largest combined interval value in the week.
    const intervalTotals = days.flatMap(
    (day) =>
        (grid[day.date] || []).map(
        (cell) => toNumber(cell.total)
        )
    );

    const maxIntervalTotal = Math.max(
    ...intervalTotals,
    1
    );

    const allWeekIntervals =
      channelEntries.flatMap(({ key }) =>
        (channelResults[key] || []).flatMap(
          (day) => day.intervals || []
        )
      );

    let weekTotal = 0;

    if (viewMode === "fte") {
      const weeklyField =
        WEEKLY_FTE_FIELDS[layer];

      if (
        Number.isFinite(
          Number(
            combinedWeeklyFTE?.[
              weeklyField
            ]
          )
        )
      ) {
        weekTotal = Number(
          combinedWeeklyFTE[weeklyField]
        );
      } else {
        weekTotal =
          channelEntries.reduce(
            (total, { key }) =>
              total +
              toNumber(
                channelWeeklyFTE?.[key]?.[
                  weeklyField
                ]
              ),
            0
          );
      }
    }

    if (viewMode === "hours") {
      weekTotal =
        allWeekIntervals.reduce(
          (total, interval) =>
            total +
            getHours(interval, layer),
          0
        );
    }

    if (viewMode === "occ") {
      weekTotal =
        weightedOccupancy(
          allWeekIntervals
        );
    }

    if (viewMode === "blend") {
      weekTotal =
        allWeekIntervals.reduce(
          (total, interval) =>
            total +
            toNumber(
              interval?.blendHours
            ),
          0
        );
    }

    return {
      days,
      timeGroups,
      grid,
      dayTotals,
      weekTotal: round(weekTotal, 2),
      maxIntervalTotal,
    };
  }, [
    channelResults,
    channelEntries,
    channelWeeklyFTE,
    combinedWeeklyFTE,
    viewMode,
    layer,
    zoom,
  ]);

  if (
    !channelResults ||
    heatmapData.days.length === 0
  ) {
    return (
      <div className="notification is-light is-size-7">
        No combined interval results to display.
      </div>
    );
  }

  const totalLabel =
    viewMode === "fte"
      ? "Daily FTE"
      : viewMode === "occ"
      ? "Weighted Occ."
      : "Day Total";

  return (
    <div className="box">
      <div
        className="is-flex is-align-items-center is-justify-content-space-between mb-3"
        style={{
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h4 className="title is-6 mb-1">
            All Channels
          </h4>

          <p className="is-size-7 has-text-grey mb-0">
            Combined interval requirement across{" "}
            <strong>
              {channelEntries.length}
            </strong>{" "}
            channels
          </p>
        </div>

        <div
          className="is-flex"
          style={{
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
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

          {(viewMode === "hours" ||
            viewMode === "fte") && (
            <div className="buttons has-addons are-small mb-0">
              {LAYER_MODES.map(
                (option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`button is-small ${
                      layer === option.key
                        ? "is-primary"
                        : ""
                    }`}
                    onClick={() =>
                      setLayer(option.key)
                    }
                  >
                    {option.label}
                  </button>
                )
              )}
            </div>
          )}

          <div className="buttons has-addons are-small mb-0">
            {ZOOM_LEVELS.map(
              (option) => (
                <button
                  key={option.key}
                  type="button"
                  className={`button is-small ${
                    zoom === option.key
                      ? "is-dark"
                      : ""
                  }`}
                  onClick={() =>
                    setZoom(option.key)
                  }
                >
                  {option.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div
        className="table-container"
        style={{
          overflowX: "auto",
          overflowY: "visible",
        }}
      >
        <table className="table is-bordered is-narrow is-fullwidth is-size-7">
          <thead>
            <tr>
              <th
                style={{
                  position: "sticky",
                  left: 0,
                  background: "#ffffff",
                  zIndex: 2,
                  minWidth: "90px",
                }}
              >
                Time
              </th>

              {heatmapData.days.map(
                (day) => (
                  <th
                    key={day.date}
                    className="has-text-centered"
                    style={{
                      minWidth: "76px",
                    }}
                  >
                    <div>{day.dayName}</div>
                    <div className="has-text-grey">
                      {day.date?.slice(5)}
                    </div>
                  </th>
                )
              )}
            </tr>
          </thead>

          <tbody>
            {heatmapData.timeGroups.map(
              (timeGroup, rowIndex) => {
                const timeLabel =
                  formatTimeGroup(
                    timeGroup,
                    intervalMinutes
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
                        zIndex: 1,
                        fontWeight: 600,
                        whiteSpace:
                          "nowrap",
                      }}
                    >
                      {timeLabel}
                    </td>

                    {heatmapData.days.map(
                      (day) => {
                        const cell =
                          heatmapData.grid[
                            day.date
                          ]?.[rowIndex];

                        const positive =
                          (
                            cell?.channelBreakdown ||
                            []
                          ).filter(
                            (channel) =>
                              channel.value > 0
                          );

                        const contributionTotal =
                            positive.reduce(
                                (total, channel) =>
                                total + channel.value,
                                0
                            );

                            const cellTotal = toNumber(
                            cell?.total
                            );

                            // Width relative to the largest combined
                            // interval in the selected week.
                            const magnitudePct =
                            heatmapData.maxIntervalTotal > 0
                                ? Math.min(
                                    100,
                                    Math.max(
                                    0,
                                    (cellTotal /
                                        heatmapData.maxIntervalTotal) *
                                        100
                                    )
                                )
                                : 0;

                        const tooltip = [
                            `${day.dayName} ${day.date}`,
                            `Time: ${timeLabel}`,
                            `Combined: ${formatValue(
                                cellTotal,
                                viewMode
                            )}`,
                            `Weekly maximum interval: ${formatValue(
                                heatmapData.maxIntervalTotal,
                                viewMode
                            )}`,
                            `Relative magnitude: ${magnitudePct.toFixed(
                                1
                            )}%`,
                            "",
                            ...positive
                                .sort(
                                (a, b) =>
                                    b.value - a.value
                                )
                                .map((channel) => {
                                const share =
                                    contributionTotal > 0
                                    ? (channel.value /
                                        contributionTotal) *
                                        100
                                    : 0;

                                return `${
                                    channel.icon
                                    ? `${channel.icon} `
                                    : ""
                                }${channel.name}: ${formatValue(
                                    channel.value,
                                    viewMode
                                )} (${share.toFixed(1)}%)`;
                                }),
                            ].join("\n");

                        return (
                          <td
                            key={day.date}
                            className="has-text-centered"
                            title={tooltip}
                            style={{
                                height:
                                zoom === 1
                                    ? "2.35rem"
                                    : "2.75rem",
                                padding: "3px 5px",
                                background: "#ffffff",
                                color: "#09092d",
                                verticalAlign: "middle",
                            }}
                            >
                            <div
                                style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "4px",
                                }}
                            >
                                {/* Interval value */}
                                <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: "0.67rem",
                                    lineHeight: 1,
                                }}
                                >
                                {formatValue(
                                    cellTotal,
                                    viewMode
                                )}
                                </div>

                                {/* Weekly-scale reference track */}
                                <div
                                style={{
                                    width: "100%",
                                    height: "10px",
                                    display: "flex",
                                    background: "#dedee8",
                                    borderRadius: "4px",
                                    overflow: "hidden",
                                }}
                                >
                                {/* Cell magnitude */}
                                <div
                                    style={{
                                    width: `${magnitudePct}%`,
                                    height: "100%",
                                    display: "flex",
                                    overflow: "hidden",
                                    borderRadius: "4px",
                                    transition:
                                        "width 160ms ease",
                                    }}
                                >
                                    {viewMode === "occ" ? (
                                        <div
                                            style={{
                                            width: "100%",
                                            height: "100%",
                                            background: "#4b4bf9",
                                            }}
                                        />
                                        ) : (
                                        positive.map((channel) => {
                                            const segmentPct =
                                            contributionTotal > 0
                                                ? (channel.value /
                                                    contributionTotal) *
                                                100
                                                : 0;

                                            return (
                                            <div
                                                key={channel.key}
                                                style={{
                                                width: `${segmentPct}%`,
                                                height: "100%",
                                                background:
                                                    channel.color,
                                                minWidth:
                                                    segmentPct > 0
                                                    ? "1px"
                                                    : 0,
                                                }}
                                            />
                                            );
                                        })
                                        )}
                                </div>
                                </div>
                            </div>
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
                background: "#f3f3f7",
                fontWeight: 700,
              }}
            >
              <td
                style={{
                  position: "sticky",
                  left: 0,
                  background: "#f3f3f7",
                  whiteSpace: "nowrap",
                }}
              >
                {totalLabel}
              </td>

              {heatmapData.days.map(
                (day) => (
                  <td
                    key={day.date}
                    className="has-text-centered"
                  >
                    {formatValue(
                      heatmapData
                        .dayTotals[day.date],
                      viewMode
                    )}
                  </td>
                )
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Scale and weekly total */}
        <div
        className="is-flex is-align-items-center is-justify-content-space-between mt-3"
        style={{
            gap: "1rem",
            flexWrap: "wrap",
        }}
        >
        {/* Bar-scale reference */}
        <div
            className="is-flex is-align-items-center"
            style={{
            gap: "0.5rem",
            flexWrap: "wrap",
            }}
        >
            <span className="is-size-7 has-text-grey">
            Bar scale:
            </span>

            <div
            style={{
                width: "110px",
                height: "9px",
                background: "#e8e8ef",
                borderRadius: "5px",
                overflow: "hidden",
            }}
            >
            <div
                style={{
                width: "100%",
                height: "100%",
                background: "#4b4bf9",
                }}
            />
            </div>

            <span className="is-size-7 has-text-grey">
            Full width = weekly maximum interval{" "}
            <strong>
                {formatValue(
                heatmapData.maxIntervalTotal,
                viewMode
                )}
            </strong>
            </span>
        </div>

        {/* Weekly result */}
        <div className="notification is-light py-2 px-3 mb-0 is-size-7">
            <strong>
            {viewMode === "fte"
                ? "Combined Weekly FTE"
                : viewMode === "occ"
                ? "Weekly Weighted Occupancy"
                : viewMode === "hours"
                ? "Combined Weekly Hours"
                : "Combined Weekly Blend Hours"}
            :
            </strong>{" "}
            {formatValue(
            heatmapData.weekTotal,
            viewMode
            )}
        </div>
      </div>
      <div
        className="is-flex is-align-items-center mt-3"
        style={{
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        {channelEntries.map(
          ({ key, config, color }) => (
            <div
              key={key}
              className="is-flex is-align-items-center is-size-7"
              style={{ gap: "0.35rem" }}
            >
              <span
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background: color,
                  display: "inline-block",
                }}
              />

              <span>
                {config?.icon}{" "}
                {config?.name || key}
              </span>
            </div>
          )
        )}
      </div>
    </div>
  );
}