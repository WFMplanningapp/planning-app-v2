// ============================================
// PATTERN MANAGER
// Upload, visualize, copy, and manage interval
// patterns per channel
// ============================================

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import { useAuth } from "../../contexts/authContext";

import {
  FaUpload,
  FaTrash,
  FaFileDownload,
  FaCheckCircle,
  FaTimesCircle,
  FaChartArea,
  FaTable,
  FaSync,
  FaCopy,
} from "react-icons/fa";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ============================================
// CONSTANTS
// ============================================

const CHANNEL_COLORS = [
  "#4b4bf9",
  "#ff8d96",
  "#8bf0bb",
  "#bfa1ff",
  "#f9ef77",
  "#f97316",
  "#06b6d4",
  "#ec4899",
];

// ============================================
// DATE HELPERS
// ============================================

const normalizeDate = (raw) => {
  if (!raw) return null;

  const value = String(raw).trim();

  const isoMatch = value.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/
  );

  if (isoMatch) {
    const [, year, month, day] = isoMatch;

    return `${year}-${month.padStart(
      2,
      "0"
    )}-${day.padStart(2, "0")}`;
  }

  const mdyMatch = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );

  if (mdyMatch) {
    const [, month, day, year] = mdyMatch;

    return `${year}-${month.padStart(
      2,
      "0"
    )}-${day.padStart(2, "0")}`;
  }

  return null;
};

const toISODate = (value) => {
  if (!value) return null;

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    return value;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
};

const addDaysToISODate = (
  dateString,
  days
) => {
  if (!dateString) return null;

  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setUTCDate(
    date.getUTCDate() + days
  );

  return date.toISOString().slice(0, 10);
};

const getSevenDates = (weekStart) =>
  Array.from(
    { length: 7 },
    (_, index) =>
      addDaysToISODate(weekStart, index)
  );

const formatWeekLabel = (weekStart) => {
  if (!weekStart) return "";

  const weekEnd = addDaysToISODate(
    weekStart,
    6
  );

  return `${weekStart} → ${weekEnd}`;
};

const getWeekdayLabel = (
  dateString,
  format = "short"
) => {
  if (!dateString) return "";

  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(
    "en-US",
    {
      weekday: format,
      timeZone: "UTC",
    }
  );
};

// ============================================
// CSV HELPERS
// ============================================

const looksLikeDate = (value) => {
  if (!value) return false;

  const text = String(value).trim();

  return (
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(
      text
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(
      text
    )
  );
};

const looksLikeTime = (value) => {
  if (!value) return false;

  return /^\d{1,2}:\d{2}$/.test(
    String(value).trim()
  );
};

const normalizeTime = (value) => {
  if (!looksLikeTime(value)) {
    return value;
  }

  const [hour, minute] = String(value)
    .trim()
    .split(":");

  return `${hour.padStart(
    2,
    "0"
  )}:${minute}`;
};

function formatPatternValue(
  value,
  decimals = 2
) {
  const numericValue = Number(value);

  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(numericValue)
  ) {
    return "Missing";
  }

  return numericValue.toFixed(decimals);
}

// ============================================
// COMPONENT
// ============================================

export default function PatternManager({
  capPlanId,
  channelsConfig,
  intervalMinutes,
  weekDocs,
  onUploadComplete,
}) {
  const auth = useAuth();
  const fileRef = useRef(null);

  // ==========================================
  // STATE
  // ==========================================

  const [
    selectedChannel,
    setSelectedChannel,
  ] = useState("");

  const [preview, setPreview] =
    useState(null);

  const [uploading, setUploading] =
    useState(false);

  const [message, setMessage] =
    useState(null);

  const [
    loadedPatterns,
    setLoadedPatterns,
  ] = useState({});

  const [
    loadingPatterns,
    setLoadingPatterns,
  ] = useState(false);

  const [viewMode, setViewMode] =
    useState("chart");

  const [metric, setMetric] =
    useState("arrival");

  const [
    selectedDate,
    setSelectedDate,
  ] = useState("");

  const [
    visibleChannels,
    setVisibleChannels,
  ] = useState({});

  // Copy/reuse state
  const [
    copySourceWeek,
    setCopySourceWeek,
  ] = useState("");

  const [
    copyTargetWeeks,
    setCopyTargetWeeks,
  ] = useState([]);

  const [
    copyingPatterns,
    setCopyingPatterns,
  ] = useState(false);

  // ==========================================
  // CHANNEL CONFIGURATION
  // ==========================================

  const channelEntries = channelsConfig
    ? Object.entries(
        channelsConfig
      ).map(([key, config]) => ({
        key,
        name: config.name,
      }))
    : [];

  const channelNames =
    channelEntries.map(
      (channel) => channel.name
    );

  const selectedChannelPattern =
    loadedPatterns[selectedChannel];

  // ==========================================
  // AVAILABLE WEEKS
  // ==========================================

  const availableWeekStarts = [
    ...new Set(
      (weekDocs || [])
        .map((week) =>
          toISODate(week.firstDate)
        )
        .filter(Boolean)
    ),
  ].sort();

  const sourceWeekOptions =
    availableWeekStarts.filter(
      (weekStart) => {
        if (!selectedChannelPattern) {
          return false;
        }

        const weekDates =
          getSevenDates(weekStart);

        return weekDates.every((date) =>
          Array.isArray(
            selectedChannelPattern
              .intervals?.[date]
          )
        );
      }
    );

  const targetWeekOptions =
    availableWeekStarts.filter(
      (weekStart) =>
        weekStart !== copySourceWeek
    );

  // ==========================================
  // BUILD DATES FROM WEEK DOCUMENTS
  // ==========================================

  const getWeekDates = useCallback(() => {
    const dates = [];

    availableWeekStarts.forEach(
      (weekStart) => {
        dates.push(
          ...getSevenDates(weekStart)
        );
      }
    );

    return [...new Set(dates)].sort();
  }, [weekDocs]);

  // ==========================================
  // BUILD TEMPLATE TIME SLOTS
  // ==========================================

  const getTimeSlots = useCallback(
    (forChannel) => {
      const interval =
        Number(intervalMinutes) || 30;

      let startMinutes = 8 * 60;
      let endMinutes = 18 * 60;

      if (
        forChannel &&
        channelsConfig
      ) {
        const channelEntry =
          Object.values(
            channelsConfig
          ).find(
            (channel) =>
              String(
                channel?.name || ""
              )
                .trim()
                .toLowerCase() ===
              String(forChannel)
                .trim()
                .toLowerCase()
          );

        if (channelEntry?.hoop) {
          let earliest = 24 * 60;
          let latest = 0;

          Object.values(
            channelEntry.hoop
          ).forEach((day) => {
            if (!day?.open) return;

            if (day.fullDay) {
              earliest = 0;
              latest = 24 * 60;
              return;
            }

            const [startHour, startMinute] =
              (
                day.start || "08:00"
              )
                .split(":")
                .map(Number);

            const [endHour, endMinute] =
              (
                day.end || "18:00"
              )
                .split(":")
                .map(Number);

            const currentStart =
              startHour * 60 +
              startMinute;

            const currentEnd =
              endHour * 60 +
              endMinute;

            if (currentStart < earliest) {
              earliest = currentStart;
            }

            if (currentEnd > latest) {
              latest = currentEnd;
            }
          });

          if (earliest < latest) {
            startMinutes = earliest;
            endMinutes = latest;
          }
        }
      }

      const slots = [];

      for (
        let minute = startMinutes;
        minute < endMinutes;
        minute += interval
      ) {
        const hour = Math.floor(
          minute / 60
        );

        const minutePart =
          minute % 60;

        slots.push(
          `${String(hour).padStart(
            2,
            "0"
          )}:${String(
            minutePart
          ).padStart(2, "0")}`
        );
      }

      return slots;
    },
    [
      channelsConfig,
      intervalMinutes,
    ]
  );

  // ==========================================
  // LOAD EXISTING PATTERNS
  // ==========================================

  const loadExistingPatterns =
    useCallback(async () => {
      if (
        !capPlanId ||
        !channelsConfig
      ) {
        return;
      }

      setLoadingPatterns(true);

      try {
        const response = await fetch(
          `/api/capacity-engine/patterns?capPlan=${encodeURIComponent(
            capPlanId
          )}`,
          {
            headers: {
              Authorization:
                auth.authorization(),
            },
          }
        );

        const data =
          await response.json();

        if (
          !response.ok ||
          !Array.isArray(data.data) ||
          data.data.length === 0
        ) {
          setLoadedPatterns({});
          setVisibleChannels({});
          setSelectedDate("");
          return;
        }

        const results = {};

        data.data.forEach(
          (document) => {
            const channel =
              document.channel;

            if (!channel) return;

            if (!results[channel]) {
              results[channel] = {
                dates: [],
                intervals: {},
              };
            }

            if (
              !results[
                channel
              ].dates.includes(
                document.date
              )
            ) {
              results[
                channel
              ].dates.push(
                document.date
              );
            }

            results[
              channel
            ].intervals[
              document.date
            ] =
              document.intervals || [];
          }
        );

        Object.keys(results).forEach(
          (channel) => {
            results[
              channel
            ].dates.sort();

            const firstDate =
              results[channel].dates[0];

            results[
              channel
            ].totalIntervals =
              results[channel]
                .intervals[
                firstDate
              ]?.length || 0;
          }
        );

        setLoadedPatterns(results);

        const visibility = {};

        Object.keys(results).forEach(
          (channel) => {
            visibility[channel] = true;
          }
        );

        setVisibleChannels(
          visibility
        );

        const loadedDates = [
          ...new Set(
            Object.values(
              results
            ).flatMap(
              (result) =>
                result.dates
            )
          ),
        ].sort();

        if (
          loadedDates.length > 0
        ) {
          setSelectedDate(
            (currentDate) =>
              loadedDates.includes(
                currentDate
              )
                ? currentDate
                : loadedDates[0]
          );
        }
      } catch (error) {
        console.error(
          "Failed to load patterns:",
          error
        );

        setMessage({
          type: "danger",
          text:
            "Existing patterns could not be loaded.",
        });
      } finally {
        setLoadingPatterns(false);
      }
    }, [
      capPlanId,
      channelsConfig,
      auth,
    ]);

  useEffect(() => {
    if (
      capPlanId &&
      channelNames.length > 0
    ) {
      loadExistingPatterns();
    }
  }, [
    capPlanId,
    channelNames.length,
    loadExistingPatterns,
  ]);

  useEffect(() => {
    setCopySourceWeek("");
    setCopyTargetWeeks([]);
  }, [selectedChannel]);

  useEffect(() => {
    setCopyTargetWeeks(
      (currentWeeks) =>
        currentWeeks.filter(
          (week) =>
            week !== copySourceWeek
        )
    );
  }, [copySourceWeek]);

  // ==========================================
  // PARSE CSV
  // ==========================================

  const parsePatternCSV = (text) => {
    const delimiter =
      text.includes("\t") ? "\t" : ",";

    const lines = text
      .trim()
      .split("\n")
      .map((line) =>
        line.replace(/\r/g, "")
      )
      .filter(
        (line) =>
          line.trim().length > 0
      );

    if (lines.length < 4) {
      return null;
    }

    const sections = {
      arrival: [],
      aht: [],
      shrinkage: [],
    };

    let currentSection = null;
    let currentDates = [];
    let allDates = [];

    lines.forEach((line) => {
      const columns = line
        .split(delimiter)
        .map((column) =>
          column.trim()
        );

      if (
        columns.some((column) =>
          column.startsWith("#")
        )
      ) {
        return;
      }

      const nonEmpty = columns
        .map((value, index) => ({
          value,
          index,
        }))
        .filter(
          (item) =>
            item.value.length > 0
        );

      if (nonEmpty.length === 0) {
        return;
      }

      const lowerJoined = nonEmpty
        .map((item) =>
          item.value.toLowerCase()
        )
        .join(" ");

      let detectedSection = null;

      if (
        lowerJoined.includes(
          "volume"
        ) ||
        lowerJoined.includes(
          "arrival"
        )
      ) {
        detectedSection = "arrival";
      } else if (
        nonEmpty.some(
          (item) =>
            item.value.toLowerCase() ===
            "aht"
        )
      ) {
        detectedSection = "aht";
      } else if (
        lowerJoined.includes(
          "shrinkage"
        )
      ) {
        detectedSection =
          "shrinkage";
      }

      if (detectedSection) {
        currentSection =
          detectedSection;

        currentDates = columns
          .filter((column) =>
            looksLikeDate(column)
          )
          .map(normalizeDate)
          .filter(Boolean);

        if (
          currentDates.length > 0
        ) {
          allDates = [
            ...new Set([
              ...allDates,
              ...currentDates,
            ]),
          ];
        }

        return;
      }

      if (!currentSection) {
        return;
      }

      const timeEntry =
        nonEmpty.find((item) =>
          looksLikeTime(item.value)
        );

      if (!timeEntry) {
        return;
      }

      const time = normalizeTime(
        timeEntry.value
      );

      const timeColumnIndex =
        timeEntry.index;

      currentDates.forEach(
        (date, dateIndex) => {
          const valueColumnIndex =
            timeColumnIndex +
            1 +
            dateIndex;

          const rawValue =
            columns[
              valueColumnIndex
            ];

          let value = null;

          if (
            rawValue !== undefined &&
            rawValue !== ""
          ) {
            const numericValue =
              Number(rawValue);

            value = Number.isFinite(
              numericValue
            )
              ? numericValue
              : null;
          }

          sections[
            currentSection
          ].push({
            time,
            date,
            value,
          });
        }
      );
    });

    allDates.sort();

    if (
      allDates.length === 0 ||
      sections.arrival.length === 0
    ) {
      return null;
    }

    const merged = {};

    allDates.forEach((date) => {
      merged[date] = [];
    });

    const allTimes = [
      ...new Set(
        sections.arrival.map(
          (row) => row.time
        )
      ),
    ].sort();

    allDates.forEach((date) => {
      allTimes.forEach((time) => {
        const arrivalRow =
          sections.arrival.find(
            (row) =>
              row.date === date &&
              row.time === time
          );

        const ahtRow =
          sections.aht.find(
            (row) =>
              row.date === date &&
              row.time === time
          );

        const shrinkageRow =
          sections.shrinkage.find(
            (row) =>
              row.date === date &&
              row.time === time
          );

        merged[date].push({
          time,
          arrivalPct:
            arrivalRow?.value ??
            null,
          ahtMultiplier:
            ahtRow?.value ?? null,
          shrinkagePct:
            shrinkageRow?.value ??
            null,
        });
      });
    });

    return {
      dates: allDates,
      intervals: merged,
      totalIntervals:
        allTimes.length,
      totalRows:
        allTimes.length *
        allDates.length,
    };
  };

  // ==========================================
  // HANDLE FILE
  // ==========================================

  const handleFile = (event) => {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (
      readerEvent
    ) => {
      const parsed =
        parsePatternCSV(
          readerEvent.target.result
        );

      if (
        !parsed ||
        parsed.dates.length === 0
      ) {
        setMessage({
          type: "danger",
          text:
            "Invalid pattern CSV. Expected Volume/Arrival, AHT, and Shrinkage sections.",
        });

        setPreview(null);
        return;
      }

      setMessage({
        type: "info",
        text: `Parsed ${parsed.dates.length} date(s), ${parsed.totalIntervals} intervals/day, and ${parsed.totalRows} total records.`,
      });

      setPreview(parsed);
    };

    reader.readAsText(file);
  };

  // ==========================================
  // FORMAT API VALIDATION ERROR
  // ==========================================

  const getApiErrorMessage = (
    data,
    fallback
  ) => {
    const validationErrors =
      data?.validation?.errors || [];

    const errorDetails =
      validationErrors
        .slice(0, 5)
        .map(
          (error) => error.message
        )
        .join(" | ");

    if (errorDetails) {
      return `${
        data.message ||
        "Validation failed."
      } ${errorDetails}`;
    }

    return data?.message || fallback;
  };

  // ==========================================
  // UPLOAD
  // ==========================================

  const upload = async () => {
    if (
      !preview ||
      !selectedChannel
    ) {
      return;
    }

    setUploading(true);
    setMessage(null);

    const payload =
      preview.dates.map((date) => ({
        channel: selectedChannel,
        date,
        intervals:
          preview.intervals[
            date
          ] || [],
      }));

    try {
      const response = await fetch(
        `/api/capacity-engine/patterns?capPlan=${encodeURIComponent(
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
            payload,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage({
          type: "danger",
          text: getApiErrorMessage(
            data,
            `Upload failed (${response.status}).`
          ),
        });

        return;
      }

      setMessage({
        type: "success",
        text: data.message,
      });

      setPreview(null);

      if (fileRef.current) {
        fileRef.current.value = "";
      }

      await loadExistingPatterns();

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error(
        "Pattern upload failed:",
        error
      );

      setMessage({
        type: "danger",
        text:
          "The pattern upload failed.",
      });
    } finally {
      setUploading(false);
    }
  };

  // ==========================================
  // DELETE CHANNEL PATTERNS
  // ==========================================

  const deletePatterns = async (
    channelName
  ) => {
    const confirmed =
      window.confirm(
        `Delete all patterns for ${channelName}?`
      );

    if (!confirmed) return;

    try {
      const response = await fetch(
        `/api/capacity-engine/patterns?capPlan=${encodeURIComponent(
          capPlanId
        )}&channel=${encodeURIComponent(
          channelName
        )}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              auth.authorization(),
          },
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage({
          type: "danger",
          text:
            data.message ||
            "Delete failed.",
        });

        return;
      }

      setMessage({
        type: "success",
        text: data.message,
      });

      await loadExistingPatterns();
    } catch (error) {
      console.error(
        "Pattern deletion failed:",
        error
      );

      setMessage({
        type: "danger",
        text:
          "The patterns could not be deleted.",
      });
    }
  };

  // ==========================================
  // DOWNLOAD TEMPLATE
  // ==========================================

  const downloadTemplate = () => {
    const dates = getWeekDates();

    if (dates.length === 0) {
      setMessage({
        type: "warning",
        text:
          "Select a week range first to generate a template with the correct dates.",
      });

      return;
    }

    const times = getTimeSlots(
      selectedChannel
    );

    if (times.length === 0) {
      setMessage({
        type: "danger",
        text:
          "No valid interval times were found for the selected channel.",
      });

      return;
    }

    const percentage = (
      100 / times.length
    ).toFixed(2);

    let csv = `Volume,${dates.join(
      ","
    )}\n`;

    times.forEach((time) => {
      csv += `${time},${dates
        .map(() => percentage)
        .join(",")}\n`;
    });

    csv += `\nAHT,${dates.join(
      ","
    )}\n`;

    times.forEach((time) => {
      csv += `${time},${dates
        .map(() => "1.0")
        .join(",")}\n`;
    });

    csv += `\nShrinkage,${dates.join(
      ","
    )}\n`;

    times.forEach((time) => {
      csv += `${time},${dates
        .map(() => "0")
        .join(",")}\n`;
    });

    csv += `\n# Channel: ${
      selectedChannel || "unknown"
    }\n`;

    if (
      selectedChannel &&
      channelsConfig
    ) {
      const channelConfig =
        Object.values(
          channelsConfig
        ).find(
          (channel) =>
            String(
              channel?.name || ""
            )
              .trim()
              .toLowerCase() ===
            String(selectedChannel)
              .trim()
              .toLowerCase()
        );

      if (channelConfig) {
        csv += `# Base AHT (sec): ${
          channelConfig.baseAHT ?? 0
        }\n`;
      }
    }

    csv += `# Interval (min): ${
      intervalMinutes || 30
    }\n`;

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download = `pattern_${
      selectedChannel || "template"
    }.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  // ==========================================
  // COPY PATTERN TO SELECTED WEEKS
  // ==========================================

  const toggleCopyTargetWeek = (
    weekStart
  ) => {
    setCopyTargetWeeks(
      (currentWeeks) =>
        currentWeeks.includes(
          weekStart
        )
          ? currentWeeks.filter(
              (week) =>
                week !== weekStart
            )
          : [
              ...currentWeeks,
              weekStart,
            ].sort()
    );
  };

  const selectAllTargetWeeks = () => {
    setCopyTargetWeeks(
      targetWeekOptions
    );
  };

  const clearTargetWeeks = () => {
    setCopyTargetWeeks([]);
  };

  const copyPatternToWeeks =
    async () => {
      if (
        !selectedChannel ||
        !copySourceWeek ||
        copyTargetWeeks.length === 0
      ) {
        setMessage({
          type: "warning",
          text:
            "Select a channel, a source week, and at least one target week.",
        });

        return;
      }

      const channelPattern =
        loadedPatterns[
          selectedChannel
        ];

      if (!channelPattern) {
        setMessage({
          type: "danger",
          text:
            "No pattern was found for the selected channel.",
        });

        return;
      }

      const sourceDates =
        getSevenDates(
          copySourceWeek
        );

      const missingSourceDates =
        sourceDates.filter(
          (date) =>
            !Array.isArray(
              channelPattern
                .intervals?.[date]
            )
        );

      if (
        missingSourceDates.length > 0
      ) {
        setMessage({
          type: "danger",
          text: `The source week is incomplete. Missing: ${missingSourceDates.join(
            ", "
          )}.`,
        });

        return;
      }

      const existingTargetDates =
        [];

      copyTargetWeeks.forEach(
        (targetWeek) => {
          getSevenDates(
            targetWeek
          ).forEach((date) => {
            if (
              Array.isArray(
                channelPattern
                  .intervals?.[date]
              )
            ) {
              existingTargetDates.push(
                date
              );
            }
          });
        }
      );

      if (
        existingTargetDates.length > 0
      ) {
        const confirmed =
          window.confirm(
            `${existingTargetDates.length} target date(s) already contain patterns for ${selectedChannel}. Continuing will replace those dates. Do you want to continue?`
          );

        if (!confirmed) return;
      }

      const payload = [];

      copyTargetWeeks.forEach(
        (targetWeek) => {
          const targetDates =
            getSevenDates(
              targetWeek
            );

          sourceDates.forEach(
            (
              sourceDate,
              dayIndex
            ) => {
              const sourceIntervals =
                channelPattern
                  .intervals[
                  sourceDate
                ];

              payload.push({
                channel:
                  selectedChannel,

                date:
                  targetDates[
                    dayIndex
                  ],

                intervals:
                  sourceIntervals.map(
                    (interval) => ({
                      time:
                        interval.time,

                      arrivalPct:
                        interval.arrivalPct,

                      ahtMultiplier:
                        interval.ahtMultiplier,

                      shrinkagePct:
                        interval.shrinkagePct,
                    })
                  ),
              });
            }
          );
        }
      );

      setCopyingPatterns(true);
      setMessage(null);

      try {
        const response =
          await fetch(
            `/api/capacity-engine/patterns?capPlan=${encodeURIComponent(
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
                payload,
                operation: "copy",
                copiedFromWeek:
                  copySourceWeek,
              }),
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          setMessage({
            type: "danger",
            text: getApiErrorMessage(
              data,
              `Copy failed (${response.status}).`
            ),
          });

          return;
        }

        setMessage({
          type: "success",
          text: data.message,
        });

        setCopyTargetWeeks([]);

        await loadExistingPatterns();

        if (onUploadComplete) {
          onUploadComplete();
        }
      } catch (error) {
        console.error(
          "Pattern copy failed:",
          error
        );

        setMessage({
          type: "danger",
          text:
            "The pattern could not be copied.",
        });
      } finally {
        setCopyingPatterns(false);
      }
    };

  // ==========================================
  // CHART DATA
  // ==========================================

  const buildChartData = () => {
    if (
      Object.keys(
        loadedPatterns
      ).length === 0 ||
      !selectedDate
    ) {
      return [];
    }

    const allTimes = new Set();

    Object.entries(
      loadedPatterns
    ).forEach(
      ([channel, data]) => {
        const intervals =
          data.intervals[
            selectedDate
          ];

        if (
          Array.isArray(intervals)
        ) {
          intervals.forEach(
            (interval) =>
              allTimes.add(
                interval.time
              )
          );
        }
      }
    );

    const sortedTimes = [
      ...allTimes,
    ].sort();

    return sortedTimes.map(
      (time) => {
        const point = { time };

        Object.entries(
          loadedPatterns
        ).forEach(
          ([channel, data]) => {
            if (
              visibleChannels[
                channel
              ] === false
            ) {
              return;
            }

            const dayIntervals =
              data.intervals[
                selectedDate
              ];

            if (
              !Array.isArray(
                dayIntervals
              )
            ) {
              return;
            }

            const interval =
              dayIntervals.find(
                (item) =>
                  item.time === time
              );

            if (!interval) return;

            switch (metric) {
              case "arrival":
                point[channel] =
                  interval.arrivalPct ??
                  0;
                break;

              case "aht":
                point[channel] =
                  interval.ahtMultiplier ??
                  1;
                break;

              case "shrinkage":
                point[channel] =
                  interval.shrinkagePct ??
                  0;
                break;

              default:
                break;
            }
          }
        );

        return point;
      }
    );
  };

  // ==========================================
  // DERIVED DISPLAY DATA
  // ==========================================

  const allDates = [
    ...new Set(
      Object.values(
        loadedPatterns
      ).flatMap(
        (result) => result.dates
      )
    ),
  ].sort();

  const metricLabels = {
    arrival:
      "Volume Distribution %",
    aht: "AHT Multiplier",
    shrinkage: "Shrinkage %",
  };

  const chartData =
    buildChartData();

  const loadedChannelNames =
    Object.keys(loadedPatterns);

  const hasPatterns =
    loadedChannelNames.length > 0;

  if (!capPlanId) {
    return null;
  }

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div>
      {message && (
        <div
          className={`notification is-${message.type} is-light is-size-7 py-2`}
        >
          {message.text}
        </div>
      )}

      {/* ====================================== */}
      {/* PATTERN STATUS */}
      {/* ====================================== */}

      <div
        className="box mb-4"
        style={{
          background: "#fafafa",
        }}
      >
        <div className="is-flex is-align-items-center is-justify-content-space-between mb-2">
          <strong className="is-size-6">
            Pattern Status
          </strong>

          <button
            type="button"
            className="button is-small is-light is-rounded"
            onClick={
              loadExistingPatterns
            }
            disabled={
              loadingPatterns
            }
          >
            <span className="icon is-small">
              <FaSync
                className={
                  loadingPatterns
                    ? "fa-spin"
                    : ""
                }
              />
            </span>

            <span>
              {loadingPatterns
                ? "Loading..."
                : "Refresh"}
            </span>
          </button>
        </div>

        <div className="columns is-multiline is-mobile">
          {channelEntries.map(
            (channel) => {
              const pattern =
                loadedPatterns[
                  channel.name
                ];

              const hasData =
                Boolean(pattern);

              return (
                <div
                  key={channel.key}
                  className="column is-narrow"
                >
                  <div
                    className={`tag is-medium ${
                      hasData
                        ? "is-success is-light"
                        : "is-danger is-light"
                    }`}
                    style={{
                      gap: "0.3rem",
                    }}
                  >
                    {hasData ? (
                      <FaCheckCircle className="has-text-success" />
                    ) : (
                      <FaTimesCircle className="has-text-danger" />
                    )}

                    <span>
                      <strong>
                        {channel.name}
                      </strong>
                    </span>

                    {hasData && (
                      <span className="is-size-7">
                        (
                        {
                          pattern
                            .dates
                            .length
                        }
                        d ×{" "}
                        {
                          pattern.totalIntervals
                        }
                        iv)
                      </span>
                    )}
                  </div>
                </div>
              );
            }
          )}
        </div>
      </div>

      {/* ====================================== */}
      {/* UPLOAD */}
      {/* ====================================== */}

      <div className="box mb-4">
        <strong
          className="is-size-6 mb-2"
          style={{
            display: "block",
          }}
        >
          Upload Pattern
        </strong>

        <div className="columns is-vcentered mb-2">
          <div className="column is-3">
            <div className="field">
              <label className="label is-small">
                Channel
              </label>

              <div className="select is-small is-fullwidth">
                <select
                  value={
                    selectedChannel
                  }
                  onChange={(event) => {
                    setSelectedChannel(
                      event.target
                        .value
                    );

                    setPreview(null);
                    setMessage(null);
                  }}
                >
                  <option value="">
                    Select channel...
                  </option>

                  {channelEntries.map(
                    (channel) => {
                      const hasData =
                        Boolean(
                          loadedPatterns[
                            channel
                              .name
                          ]
                        );

                      return (
                        <option
                          key={
                            channel.key
                          }
                          value={
                            channel.name
                          }
                        >
                          {
                            channel.name
                          }{" "}
                          {hasData
                            ? "✓"
                            : ""}
                        </option>
                      );
                    }
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="column">
            <div
              className="is-flex is-align-items-end"
              style={{
                gap: "0.5rem",
                paddingTop:
                  "1.5rem",
                flexWrap: "wrap",
              }}
            >
              <div className="file is-small is-info">
                <label className="file-label">
                  <input
                    ref={fileRef}
                    className="file-input"
                    type="file"
                    accept=".csv"
                    onChange={
                      handleFile
                    }
                    disabled={
                      !selectedChannel
                    }
                  />

                  <span className="file-cta">
                    <span className="file-icon">
                      <FaUpload />
                    </span>

                    <span className="file-label">
                      Choose CSV
                    </span>
                  </span>
                </label>
              </div>

              <button
                type="button"
                className="button is-small is-light is-rounded"
                onClick={
                  downloadTemplate
                }
                disabled={
                  !selectedChannel
                }
              >
                <span className="icon is-small">
                  <FaFileDownload />
                </span>

                <span>
                  Template
                </span>
              </button>

              {selectedChannel &&
                loadedPatterns[
                  selectedChannel
                ] && (
                  <button
                    type="button"
                    className="button is-small is-danger is-light is-rounded"
                    onClick={() =>
                      deletePatterns(
                        selectedChannel
                      )
                    }
                  >
                    <span className="icon is-small">
                      <FaTrash />
                    </span>

                    <span>
                      Clear{" "}
                      {
                        selectedChannel
                      }
                    </span>
                  </button>
                )}
            </div>
          </div>
        </div>

        {preview && (
          <div className="mt-3">
            <div className="tags mb-2">
              <span className="tag is-info is-light">
                {preview.dates.length}{" "}
                date(s)
              </span>

              <span className="tag is-success is-light">
                {
                  preview.totalIntervals
                }{" "}
                intervals/day
              </span>

              <span className="tag is-warning is-light">
                {preview.totalRows}{" "}
                total records
              </span>
            </div>

            <p className="is-size-7 has-text-grey mb-2">
              Dates:{" "}
              {preview.dates} →{" "}
              {
                preview.dates[
                  preview.dates
                    .length - 1
                ]
              }

              {loadedPatterns[
                selectedChannel
              ] && (
                <span className="has-text-warning ml-2">
                  ⚠ Existing
                  patterns on matching
                  dates will be
                  replaced.
                </span>
              )}
            </p>

            {preview.dates.length >
              0 &&
              preview.intervals[
                preview.dates
              ] && (
                <div
                  className="table-container"
                  style={{
                    maxHeight:
                      "200px",
                    overflow:
                      "auto",
                  }}
                >
                  <table className="table is-narrow is-striped is-fullwidth is-size-7">
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>
                          Arrival %
                        </th>
                        <th>
                          AHT Mult.
                        </th>
                        <th>
                          Shrinkage %
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {preview.intervals[
                        preview.dates
                      ].map(
                        (
                          interval,
                          index
                        ) => (
                          <tr
                            key={`${interval.time}-${index}`}
                          >
                            <td>
                              {
                                interval.time
                              }
                            </td>

                            <td>
                              {formatPatternValue(
                                interval.arrivalPct
                              )}
                            </td>

                            <td>
                              {formatPatternValue(
                                interval.ahtMultiplier
                              )}
                            </td>

                            <td>
                              {formatPatternValue(
                                interval.shrinkagePct
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>

                  <p className="is-size-7 has-text-grey">
                    Preview:{" "}
                    {preview.dates}.
                    All{" "}
                    {
                      preview.dates
                        .length
                    }{" "}
                    dates will be
                    uploaded.
                  </p>
                </div>
              )}

            <button
              type="button"
              className="button is-small is-success is-rounded mt-2"
              onClick={upload}
              disabled={
                uploading ||
                !selectedChannel
              }
            >
              <span className="icon is-small">
                <FaUpload />
              </span>

              <span>
                {uploading
                  ? "Uploading..."
                  : `Upload ${preview.dates.length} day(s) × ${preview.totalIntervals} intervals`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ====================================== */}
      {/* REUSE PATTERN */}
      {/* ====================================== */}

      <div className="box mb-4">
        <strong
          className="is-size-6 mb-1"
          style={{
            display: "block",
          }}
        >
          Reuse Pattern Across Weeks
        </strong>

        <p className="is-size-7 has-text-grey mb-3">
          Copy a validated source
          pattern to the matching
          weekdays of one or more
          selected weeks.
        </p>

        <div className="columns">
          <div className="column is-4">
            <div className="field">
              <label className="label is-small">
                Channel
              </label>

              <div className="select is-small is-fullwidth">
                <select
                  value={
                    selectedChannel
                  }
                  onChange={(event) => {
                    setSelectedChannel(
                      event.target
                        .value
                    );

                    setPreview(null);
                    setMessage(null);
                  }}
                >
                  <option value="">
                    Select channel...
                  </option>

                  {channelEntries.map(
                    (channel) => (
                      <option
                        key={
                          channel.key
                        }
                        value={
                          channel.name
                        }
                      >
                        {
                          channel.name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="column is-4">
            <div className="field">
              <label className="label is-small">
                Source week
              </label>

              <div className="select is-small is-fullwidth">
                <select
                  value={
                    copySourceWeek
                  }
                  disabled={
                    !selectedChannel
                  }
                  onChange={(
                    event
                  ) =>
                    setCopySourceWeek(
                      event.target
                        .value
                    )
                  }
                >
                  <option value="">
                    Select source
                    week...
                  </option>

                  {sourceWeekOptions.map(
                    (weekStart) => (
                      <option
                        key={
                          weekStart
                        }
                        value={
                          weekStart
                        }
                      >
                        {formatWeekLabel(
                          weekStart
                        )}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {selectedChannel &&
          sourceWeekOptions.length ===
            0 && (
            <div className="notification is-warning is-light is-size-7 py-2">
              No complete seven-day
              source pattern is
              currently available for{" "}
              <strong>
                {selectedChannel}
              </strong>
              .
            </div>
          )}

        {copySourceWeek && (
          <>
            <div className="is-flex is-align-items-center is-justify-content-space-between mb-2">
              <label className="label is-small mb-0">
                Target weeks
              </label>

              <div className="buttons are-small mb-0">
                <button
                  type="button"
                  className="button is-light"
                  onClick={
                    selectAllTargetWeeks
                  }
                  disabled={
                    targetWeekOptions.length ===
                    0
                  }
                >
                  Select all
                </button>

                <button
                  type="button"
                  className="button is-light"
                  onClick={
                    clearTargetWeeks
                  }
                  disabled={
                    copyTargetWeeks.length ===
                    0
                  }
                >
                  Clear
                </button>
              </div>
            </div>

            {targetWeekOptions.length ===
            0 ? (
              <div className="notification is-warning is-light is-size-7 py-2">
                No other weeks are
                available in the
                selected capacity-plan
                range.
              </div>
            ) : (
              <div
                className="mb-3"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(230px, 1fr))",
                  gap: "0.5rem",
                }}
              >
                {targetWeekOptions.map(
                  (weekStart) => {
                    const targetDates =
                      getSevenDates(
                        weekStart
                      );

                    const existingCount =
                      targetDates.filter(
                        (date) =>
                          Array.isArray(
                            selectedChannelPattern
                              ?.intervals?.[
                              date
                            ]
                          )
                      ).length;

                    const selected =
                      copyTargetWeeks.includes(
                        weekStart
                      );

                    return (
                      <label
                        key={
                          weekStart
                        }
                        className="box is-size-7"
                        style={{
                          padding:
                            "0.75rem",
                          margin: 0,
                          cursor:
                            "pointer",
                          border: selected
                            ? "2px solid #4b4bf9"
                            : "1px solid #e5e5e5",
                          background:
                            selected
                              ? "#f3f3ff"
                              : "#ffffff",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selected
                          }
                          onChange={() =>
                            toggleCopyTargetWeek(
                              weekStart
                            )
                          }
                          style={{
                            marginRight:
                              "0.5rem",
                          }}
                        />

                        <strong>
                          {formatWeekLabel(
                            weekStart
                          )}
                        </strong>

                        {existingCount >
                          0 && (
                          <span className="tag is-warning is-light ml-2">
                            {
                              existingCount
                            }{" "}
                            existing
                          </span>
                        )}
                      </label>
                    );
                  }
                )}
              </div>
            )}

            <button
              type="button"
              className="button is-small is-info is-rounded"
              disabled={
                copyingPatterns ||
                copyTargetWeeks.length ===
                  0
              }
              onClick={
                copyPatternToWeeks
              }
            >
              <span className="icon is-small">
                <FaCopy />
              </span>

              <span>
                {copyingPatterns
                  ? "Copying..."
                  : `Copy to ${copyTargetWeeks.length} selected week${
                      copyTargetWeeks.length ===
                      1
                        ? ""
                        : "s"
                    }`}
              </span>
            </button>
          </>
        )}
      </div>

      {/* ====================================== */}
      {/* VISUALIZATION */}
      {/* ====================================== */}

      {hasPatterns && (
        <div className="box">
          <div
            className="is-flex is-align-items-center is-justify-content-space-between mb-3 is-flex-wrap-wrap"
            style={{
              gap: "0.5rem",
            }}
          >
            <div className="buttons has-addons are-small mb-0">
              {[
                {
                  key: "arrival",
                  label: "Volume %",
                },
                {
                  key: "aht",
                  label: "AHT",
                },
                {
                  key: "shrinkage",
                  label:
                    "Shrinkage %",
                },
              ].map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  className={`button is-small ${
                    metric ===
                    tab.key
                      ? "is-info"
                      : ""
                  }`}
                  onClick={() =>
                    setMetric(
                      tab.key
                    )
                  }
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              className="is-flex is-align-items-center"
              style={{
                gap: "0.5rem",
              }}
            >
              <div className="select is-small">
                <select
                  value={
                    selectedDate
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedDate(
                      event.target
                        .value
                    )
                  }
                >
                  {allDates.map(
                    (date) => (
                      <option
                        key={date}
                        value={date}
                      >
                        {getWeekdayLabel(
                          date,
                          "short"
                        )}{" "}
                        {date}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="buttons has-addons are-small mb-0">
                <button
                  type="button"
                  className={`button is-small ${
                    viewMode ===
                    "chart"
                      ? "is-info"
                      : ""
                  }`}
                  onClick={() =>
                    setViewMode(
                      "chart"
                    )
                  }
                >
                  <FaChartArea />
                </button>

                <button
                  type="button"
                  className={`button is-small ${
                    viewMode ===
                    "table"
                      ? "is-info"
                      : ""
                  }`}
                  onClick={() =>
                    setViewMode(
                      "table"
                    )
                  }
                >
                  <FaTable />
                </button>
              </div>
            </div>
          </div>

          <div
            className="is-flex mb-3"
            style={{
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            {loadedChannelNames.map(
              (channel, index) => (
                <label
                  key={channel}
                  className="is-flex is-align-items-center is-size-7"
                  style={{
                    gap: "0.3rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      visibleChannels[
                        channel
                      ] !== false
                    }
                    onChange={() =>
                      setVisibleChannels(
                        (current) => ({
                          ...current,
                          [channel]:
                            !current[
                              channel
                            ],
                        })
                      )
                    }
                  />

                  <span
                    style={{
                      width: "12px",
                      height: "12px",
                      borderRadius:
                        "2px",
                      backgroundColor:
                        CHANNEL_COLORS[
                          index %
                            CHANNEL_COLORS.length
                        ],
                      display:
                        "inline-block",
                    }}
                  />

                  {channel}
                </label>
              )
            )}
          </div>

          <p className="is-size-7 has-text-grey mb-2">
            <strong>
              {metricLabels[metric]}
            </strong>{" "}
            — {selectedDate} (
            {getWeekdayLabel(
              selectedDate,
              "long"
            )}
            )
          </p>

          {viewMode === "chart" &&
            chartData.length > 0 && (
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <LineChart
                  data={chartData}
                  margin={{
                    top: 5,
                    right: 20,
                    left: 10,
                    bottom: 5,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#eee"
                  />

                  <XAxis
                    dataKey="time"
                    tick={{
                      fontSize: 10,
                    }}
                    interval="preserveStartEnd"
                  />

                  <YAxis
                    tick={{
                      fontSize: 10,
                    }}
                    label={{
                      value:
                        metricLabels[
                          metric
                        ],
                      angle: -90,
                      position:
                        "insideLeft",
                      style: {
                        fontSize: 10,
                      },
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                    }}
                    formatter={(
                      value,
                      name
                    ) => [
                      metric === "aht"
                        ? `×${value}`
                        : `${Number(
                            value
                          ).toFixed(
                            2
                          )}%`,
                      name,
                    ]}
                  />

                  <Legend
                    wrapperStyle={{
                      fontSize: 11,
                    }}
                    iconType="line"
                  />

                  {loadedChannelNames
                    .filter(
                      (channel) =>
                        visibleChannels[
                          channel
                        ] !== false
                    )
                    .map(
                      (
                        channel,
                        index
                      ) => (
                        <Line
                          key={
                            channel
                          }
                          type="monotone"
                          dataKey={
                            channel
                          }
                          stroke={
                            CHANNEL_COLORS[
                              index %
                                CHANNEL_COLORS.length
                            ]
                          }
                          strokeWidth={
                            2
                          }
                          dot={false}
                          activeDot={{
                            r: 4,
                          }}
                        />
                      )
                    )}
                </LineChart>
              </ResponsiveContainer>
            )}

          {viewMode === "table" &&
            chartData.length > 0 && (
              <div
                className="table-container"
                style={{
                  maxHeight:
                    "400px",
                  overflow: "auto",
                }}
              >
                <table className="table is-narrow is-striped is-bordered is-fullwidth is-size-7">
                  <thead>
                    <tr>
                      <th>Time</th>

                      {loadedChannelNames
                        .filter(
                          (channel) =>
                            visibleChannels[
                              channel
                            ] !==
                            false
                        )
                        .map(
                          (
                            channel,
                            index
                          ) => (
                            <th
                              key={
                                channel
                              }
                              className="has-text-centered"
                              style={{
                                borderBottom: `3px solid ${
                                  CHANNEL_COLORS[
                                    index %
                                      CHANNEL_COLORS.length
                                  ]
                                }`,
                              }}
                            >
                              {
                                channel
                              }
                            </th>
                          )
                        )}
                    </tr>
                  </thead>

                  <tbody>
                    {chartData.map(
                      (
                        row,
                        index
                      ) => (
                        <tr
                          key={`${row.time}-${index}`}
                        >
                          <td>
                            <strong>
                              {
                                row.time
                              }
                            </strong>
                          </td>

                          {loadedChannelNames
                            .filter(
                              (
                                channel
                              ) =>
                                visibleChannels[
                                  channel
                                ] !==
                                false
                            )
                            .map(
                              (
                                channel
                              ) => {
                                const value =
                                  row[
                                    channel
                                  ];

                                return (
                                  <td
                                    key={
                                      channel
                                    }
                                    className="has-text-centered"
                                  >
                                    {value !==
                                    undefined
                                      ? metric ===
                                        "aht"
                                        ? `×${value}`
                                        : Number(
                                            value
                                          ).toFixed(
                                            2
                                          )
                                      : "—"}
                                  </td>
                                );
                              }
                            )}
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}

          {chartData.length === 0 && (
            <div className="notification is-warning is-light is-size-7">
              No pattern data is
              available for{" "}
              {selectedDate}.
            </div>
          )}
        </div>
      )}
    </div>
  );
}