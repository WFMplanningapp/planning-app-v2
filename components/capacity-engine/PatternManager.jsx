// ============================================
// PATTERN MANAGER
//
// Upload, visualize, copy, and manage interval
// patterns using permanent channel keys.
//
// Model behavior:
// - Hours: Hours Distribution % + Shrinkage %
// - Other models: Volume Distribution % +
//   AHT Multiplier + Shrinkage %
// ============================================

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import {
  useAuth,
} from "../../contexts/authContext";

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

const DAY_COLORS = [
  "#4b4bf9", // Monday
  "#ff8d96", // Tuesday
  "#8bf0bb", // Wednesday
  "#bfa1ff", // Thursday
  "#f97316", // Friday
  "#06b6d4", // Saturday
  "#ec4899", // Sunday
];

const DAY_KEYS = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

// ============================================
// GENERAL HELPERS
// ============================================

function normalizeChannelName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeModel(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

function channelRequiresAHT(config) {
  return (
    normalizeModel(
      config?.model
    ) !== "hours"
  );
}

function formatPatternValue(
  value,
  decimals = 2
) {
  const numericValue =
    Number(value);

  if (
    value === null ||
    value === undefined ||
    value === "" ||
    !Number.isFinite(
      numericValue
    )
  ) {
    return "Missing";
  }

  return numericValue.toFixed(
    decimals
  );
}

function getApiErrorMessage(
  data,
  fallback
) {
  const validationErrors =
    data?.validation?.errors;

  const details =
    Array.isArray(
      validationErrors
    )
      ? validationErrors
          .slice(0, 5)
          .map(
            (error) =>
              error?.message ||
              String(error)
          )
          .join(" | ")
      : "";

  return [
    data?.message || fallback,
    details,
  ]
    .filter(Boolean)
    .join(" ");
}

function safeFileName(value) {
  return String(value || "channel")
    .trim()
    .replace(
      /[^a-zA-Z0-9_-]+/g,
      "_"
    );
}

// ============================================
// DATE HELPERS
// ============================================

function isValidISODate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    yearText,
    monthText,
    dayText,
  ] = value.split("-");

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
  );
}

function normalizeDate(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value =
    String(rawValue).trim();

  const isoMatch =
    value.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (isoMatch) {
    const [
      ,
      year,
      month,
      day,
    ] = isoMatch;

    const normalized =
      `${year}-${month.padStart(
        2,
        "0"
      )}-${day.padStart(
        2,
        "0"
      )}`;

    return isValidISODate(
      normalized
    )
      ? normalized
      : null;
  }

  const mdyMatch =
    value.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    );

  if (mdyMatch) {
    const [
      ,
      month,
      day,
      year,
    ] = mdyMatch;

    const normalized =
      `${year}-${month.padStart(
        2,
        "0"
      )}-${day.padStart(
        2,
        "0"
      )}`;

    return isValidISODate(
      normalized
    )
      ? normalized
      : null;
  }

  return null;
}

function toISODate(value) {
  if (!value) {
    return null;
  }

  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}/.test(
      value
    )
  ) {
    const normalized =
      value.slice(0, 10);

    return isValidISODate(
      normalized
    )
      ? normalized
      : null;
  }

  const date =
    new Date(value);

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
}

function addDaysToISODate(
  dateString,
  days
) {
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
      days
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function getSevenDates(weekStart) {
  return Array.from(
    {
      length: 7,
    },
    (_, index) =>
      addDaysToISODate(
        weekStart,
        index
      )
  ).filter(Boolean);
}

function formatWeekLabel(
  weekStart
) {
  if (!weekStart) {
    return "";
  }

  const weekEnd =
    addDaysToISODate(
      weekStart,
      6
    );

  return `${weekStart} → ${weekEnd}`;
}

function getWeekdayLabel(
  dateString,
  format = "short"
) {
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
      weekday: format,
      timeZone: "UTC",
    }
  );
}

function getDayKey(dateString) {
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

  return DAY_KEYS[
    date.getUTCDay()
  ];
}

// ============================================
// TIME HELPERS
// ============================================

function timeToMinutes(
  time,
  allow24 = false
) {
  if (
    typeof time !== "string"
  ) {
    return null;
  }

  const match =
    time.match(
      /^(\d{2}):(\d{2})$/
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

  if (
    allow24 &&
    hours === 24 &&
    minutes === 0
  ) {
    return 24 * 60;
  }

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return (
    hours * 60 +
    minutes
  );
}

function minutesToTime(
  totalMinutes
) {
  const hours =
    Math.floor(
      totalMinutes / 60
    );

  const minutes =
    totalMinutes % 60;

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    minutes
  ).padStart(
    2,
    "0"
  )}`;
}

// ============================================
// CSV HELPERS
// ============================================

function looksLikeDate(value) {
  if (!value) {
    return false;
  }

  const text =
    String(value).trim();

  return (
    /^\d{4}-\d{1,2}-\d{1,2}$/.test(
      text
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(
      text
    )
  );
}

function looksLikeTime(value) {
  if (!value) {
    return false;
  }

  return /^\d{1,2}:\d{2}$/.test(
    String(value).trim()
  );
}

function normalizeTime(value) {
  if (!looksLikeTime(value)) {
    return value;
  }

  const [
    hour,
    minute,
  ] = String(value)
    .trim()
    .split(":");

  return `${hour.padStart(
    2,
    "0"
  )}:${minute}`;
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

  const authorization =
    auth.authorization();

  // ==========================================
  // STATE
  // ==========================================

  /*
   * selectedChannel always contains the
   * permanent channel key.
   */
  const [
    selectedChannel,
    setSelectedChannel,
  ] = useState("");

  const [
    preview,
    setPreview,
  ] = useState(null);

  const [
    uploading,
    setUploading,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState(null);

  /*
   * loadedPatterns is grouped by channelKey.
   */
  const [
    loadedPatterns,
    setLoadedPatterns,
  ] = useState({});

  const [
    loadingPatterns,
    setLoadingPatterns,
  ] = useState(false);

  const [
    viewMode,
    setViewMode,
  ] = useState("chart");

  const [
    metric,
    setMetric,
  ] = useState("arrival");

  /*
  * The visualization compares weekdays for
  * one channel and one selected week.
  */
  const [
    visualizationChannel,
    setVisualizationChannel,
  ] = useState("");

  const [
    selectedVisualizationWeek,
    setSelectedVisualizationWeek,
  ] = useState("");

  /*
   * Visibility is also keyed by channelKey.
   */
  const [
    visibleChannels,
    setVisibleChannels,
  ] = useState({});

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

  const channelEntries =
    Object.entries(
      channelsConfig || {}
    ).map(
      ([
        key,
        config,
      ]) => {
        const name =
          String(
            config?.name || key
          ).trim();

        const model =
          normalizeModel(
            config?.model
          );

        return {
          key,
          name,
          model,
          requiresAHT:
            channelRequiresAHT(
              config
            ),
          config,
        };
      }
    );

  const channelByKey =
    Object.fromEntries(
      channelEntries.map(
        (channel) => [
          channel.key,
          channel,
        ]
      )
    );

  const selectedChannelEntry =
    channelByKey[
      selectedChannel
    ] || null;

  const selectedChannelName =
    selectedChannelEntry?.name ||
    selectedChannel;

  const selectedRequiresAHT =
    selectedChannelEntry
      ? selectedChannelEntry
          .requiresAHT
      : true;

  const selectedChannelPattern =
    loadedPatterns[
      selectedChannel
    ];

  // ==========================================
  // AVAILABLE WEEKS
  // ==========================================

  const availableWeekStarts = [
    ...new Set(
      (weekDocs || [])
        .map((week) =>
          toISODate(
            week?.firstDate
          )
        )
        .filter(Boolean)
    ),
  ].sort();

  const getWeekDates =
    useCallback(() => {
      const dates = [];

      availableWeekStarts.forEach(
        (weekStart) => {
          dates.push(
            ...getSevenDates(
              weekStart
            )
          );
        }
      );

      return [
        ...new Set(dates),
      ].sort();
    }, [
      availableWeekStarts.join(
        "|"
      ),
    ]);

  const sourceWeekOptions =
    availableWeekStarts.filter(
      (weekStart) => {
        if (
          !selectedChannelPattern
        ) {
          return false;
        }

        return getSevenDates(
          weekStart
        ).every(
          (date) =>
            Array.isArray(
              selectedChannelPattern
                .intervals?.[
                date
              ]
            )
        );
      }
    );

  const targetWeekOptions =
    availableWeekStarts.filter(
      (weekStart) =>
        weekStart !==
        copySourceWeek
    );

  // ==========================================
  // TEMPLATE TIME SLOTS
  // ==========================================

  const getTimeSlots =
    useCallback(
      (
        channelKey,
        dateString
      ) => {
        const interval =
          Number(
            intervalMinutes
          ) || 30;

        const channel =
          channelsConfig?.[
            channelKey
          ];

        if (
          !channel ||
          !dateString
        ) {
          return [];
        }

        const dayKey =
          getDayKey(
            dateString
          );

        const hoop =
          channel?.hoop?.[
            dayKey
          ];

        if (!hoop?.open) {
          return [];
        }

        const startTime =
          hoop.fullDay
            ? "00:00"
            : hoop.start ||
              "08:00";

        const endTime =
          hoop.fullDay
            ? "24:00"
            : hoop.end ||
              "18:00";

        const startMinutes =
          timeToMinutes(
            startTime,
            false
          );

        const endMinutes =
          timeToMinutes(
            endTime,
            true
          );

        if (
          startMinutes ===
            null ||
          endMinutes === null ||
          endMinutes <=
            startMinutes
        ) {
          return [];
        }

        const slots = [];

        for (
          let minute =
            startMinutes;
          minute <
          endMinutes;
          minute += interval
        ) {
          slots.push(
            minutesToTime(
              minute
            )
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
        channelEntries.length ===
          0
      ) {
        setLoadedPatterns({});
        setVisibleChannels({});
        setVisualizationChannel("");
        setSelectedVisualizationWeek("");
        return;
      }

      setLoadingPatterns(true);

      try {
        const response =
          await fetch(
            `/api/capacity-engine/patterns?capPlan=${encodeURIComponent(
              capPlanId
            )}`,
            {
              headers: {
                Authorization:
                  authorization,
              },
            }
          );

        const data =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(
              data,
              `Unable to load patterns (${response.status}).`
            )
          );
        }

        const documents =
          Array.isArray(data.data)
            ? data.data
            : [];

        const results = {};

        documents.forEach(
          (document) => {
            /*
             * Prefer the permanent key.
             * Resolve legacy records by their
             * current display name only when
             * channelKey is absent.
             */
            let channelKey =
              document.channelKey;

            if (
              !channelKey &&
              document.channel
            ) {
              const matches =
                channelEntries.filter(
                  (channel) =>
                    normalizeChannelName(
                      channel.name
                    ) ===
                    normalizeChannelName(
                      document.channel
                    )
                );

              if (
                matches.length === 1
              ) {
                channelKey =
                  matches[0].key;
              }
            }

            if (!channelKey) {
              return;
            }

            const configured =
              channelByKey[
                channelKey
              ];

            const channelName =
              configured?.name ||
              document.channel ||
              channelKey;

            const requiresAHT =
              configured
                ? configured.requiresAHT
                : true;

            if (
              !results[
                channelKey
              ]
            ) {
              results[
                channelKey
              ] = {
                channelKey,
                channelName,
                model:
                  configured?.model ||
                  "",
                requiresAHT,
                dates: [],
                intervals: {},
              };
            }

            if (
              !results[
                channelKey
              ].dates.includes(
                document.date
              )
            ) {
              results[
                channelKey
              ].dates.push(
                document.date
              );
            }

            results[
              channelKey
            ].intervals[
              document.date
            ] =
              Array.isArray(
                document.intervals
              )
                ? document.intervals
                : [];
          }
        );

        Object.values(
          results
        ).forEach(
          (pattern) => {
            pattern.dates.sort();

            pattern.totalIntervals =
              Math.max(
                0,
                ...pattern.dates.map(
                  (date) =>
                    pattern
                      .intervals[
                      date
                    ]?.length ||
                    0
                )
              );
          }
        );

        setLoadedPatterns(
          results
        );

        const visibility = {};

        Object.keys(
          results
        ).forEach(
          (channelKey) => {
            visibility[
              channelKey
            ] = true;
          }
        );

        setVisibleChannels(
          visibility
        );

        const loadedChannelKeys =
          Object.keys(results);

        setVisualizationChannel(
          (currentChannel) =>
            loadedChannelKeys.includes(
              currentChannel
            )
              ? currentChannel
              : loadedChannelKeys[0] ||
                ""
        );
      } catch (error) {
        console.error(
          "Failed to load patterns:",
          error
        );

        setLoadedPatterns({});
        setVisibleChannels({});
        setVisualizationChannel("");
        setSelectedVisualizationWeek("");

        setMessage({
          type: "danger",
          text:
            error?.message ||
            "Existing patterns could not be loaded.",
        });
      } finally {
        setLoadingPatterns(
          false
        );
      }
    }, [
      capPlanId,
      channelsConfig,
      authorization,
    ]);

  useEffect(() => {
    if (
      capPlanId &&
      channelEntries.length >
        0
    ) {
      loadExistingPatterns();
    }
  }, [
    capPlanId,
    channelEntries.length,
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
            week !==
            copySourceWeek
        )
    );
  }, [copySourceWeek]);

  // ==========================================
  // CSV PARSING
  // ==========================================

  const parsePatternCSV = (
    text,
    requiresAHT
  ) => {
    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return null;
    }

    const delimiter =
      text.includes("\t")
        ? "\t"
        : ",";

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

    if (lines.length < 2) {
      return null;
    }

    const sections = {
      arrival: [],
      aht: [],
      shrinkage: [],
    };

    const foundSections = {
      arrival: false,
      aht: false,
      shrinkage: false,
    };

    let currentSection =
      null;

    let currentDates = [];
    let allDates = [];

    lines.forEach((line) => {
      const columns =
        line
          .split(delimiter)
          .map((column) =>
            column.trim()
          );

      if (
        columns.some(
          (column) =>
            column.startsWith(
              "#"
            )
        )
      ) {
        return;
      }

      const nonEmpty =
        columns
          .map(
            (
              value,
              index
            ) => ({
              value,
              index,
            })
          )
          .filter(
            (item) =>
              item.value.length >
              0
          );

      if (
        nonEmpty.length === 0
      ) {
        return;
      }

      const lowerJoined =
        nonEmpty
          .map((item) =>
            item.value.toLowerCase()
          )
          .join(" ");

      let detectedSection =
        null;

      if (
        lowerJoined.includes(
          "shrinkage"
        )
      ) {
        detectedSection =
          "shrinkage";
      } else if (
        nonEmpty.some(
          (item) =>
            item.value
              .toLowerCase()
              .includes("aht")
        )
      ) {
        detectedSection =
          "aht";
      } else if (
        lowerJoined.includes(
          "volume"
        ) ||
        lowerJoined.includes(
          "arrival"
        ) ||
        lowerJoined.includes(
          "hours"
        ) ||
        lowerJoined.includes(
          "demand"
        )
      ) {
        detectedSection =
          "arrival";
      }

      if (detectedSection) {
        currentSection =
          detectedSection;

        foundSections[
          detectedSection
        ] = true;

        currentDates =
          columns
            .filter(
              (column) =>
                looksLikeDate(
                  column
                )
            )
            .map(normalizeDate)
            .filter(Boolean);

        allDates = [
          ...new Set([
            ...allDates,
            ...currentDates,
          ]),
        ];

        return;
      }

      if (!currentSection) {
        return;
      }

      const timeEntry =
        nonEmpty.find(
          (item) =>
            looksLikeTime(
              item.value
            )
        );

      if (!timeEntry) {
        return;
      }

      const time =
        normalizeTime(
          timeEntry.value
        );

      currentDates.forEach(
        (
          date,
          dateIndex
        ) => {
          const valueIndex =
            timeEntry.index +
            1 +
            dateIndex;

          const rawValue =
            columns[
              valueIndex
            ];

          let value = null;

          if (
            rawValue !==
              undefined &&
            rawValue !== ""
          ) {
            const numeric =
              Number(rawValue);

            value =
              Number.isFinite(
                numeric
              )
                ? numeric
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
      !foundSections.arrival ||
      !foundSections.shrinkage ||
      (
        requiresAHT &&
        !foundSections.aht
      )
    ) {
      return null;
    }

    const merged = {};

    allDates.forEach(
      (date) => {
        merged[date] = [];
      }
    );

    const allTimes = [
      ...new Set(
        sections.arrival.map(
          (row) => row.time
        )
      ),
    ].sort();

    allDates.forEach(
      (date) => {
        allTimes.forEach(
          (time) => {
            const findValue = (
              section
            ) =>
              sections[
                section
              ].find(
                (row) =>
                  row.date ===
                    date &&
                  row.time ===
                    time
              )?.value ??
              null;

            const arrivalPct =
              findValue(
                "arrival"
              );

            const ahtMultiplier =
              requiresAHT
                ? findValue(
                    "aht"
                  )
                : null;

            const shrinkagePct =
              findValue(
                "shrinkage"
              );

            const outsideHOOP =
              requiresAHT
                ? arrivalPct ===
                    null &&
                  ahtMultiplier ===
                    null &&
                  shrinkagePct ===
                    null
                : arrivalPct ===
                    null &&
                  shrinkagePct ===
                    null;

            if (outsideHOOP) {
              return;
            }

            merged[
              date
            ].push({
              time,
              arrivalPct,

              ...(requiresAHT
                ? {
                    ahtMultiplier,
                  }
                : {}),

              shrinkagePct,
            });
          }
        );
      }
    );

    return {
      dates: allDates,
      intervals: merged,
      requiresAHT,

      totalIntervals:
        Math.max(
          0,
          ...allDates.map(
            (date) =>
              merged[date]
                .length
          )
        ),

      totalRows:
        allDates.reduce(
          (
            total,
            date
          ) =>
            total +
            merged[date]
              .length,
          0
        ),
    };
  };

  // ==========================================
  // HANDLE FILE
  // ==========================================

  const handleFile = (
    event
  ) => {
    const file =
      event.target
        .files?.[0];

    if (!file) {
      return;
    }

    const reader =
      new FileReader();

    reader.onload = (
      readerEvent
    ) => {
      const parsed =
        parsePatternCSV(
          readerEvent
            .target?.result,
          selectedRequiresAHT
        );

      if (!parsed) {
        setPreview(null);

        setMessage({
          type: "danger",

          text:
            selectedRequiresAHT
              ? "Invalid pattern CSV. Expected Volume/Arrival, AHT, and Shrinkage sections."
              : "Invalid Hours pattern CSV. Expected Hours Distribution and Shrinkage sections. AHT must not be included.",
        });

        return;
      }

      setPreview(parsed);

      setMessage({
        type: "info",

        text:
          `Parsed ${parsed.dates.length} date(s), ` +
          `${parsed.totalIntervals} intervals/day, and ` +
          `${parsed.totalRows} total records for ${selectedChannelName}.`,
      });
    };

    reader.onerror = () => {
      setPreview(null);

      setMessage({
        type: "danger",
        text:
          "The selected pattern file could not be read.",
      });
    };

    reader.readAsText(file);
  };

  // ==========================================
  // UPLOAD
  // ==========================================

  const upload = async () => {
    if (
      !preview ||
      !selectedChannel ||
      !selectedChannelEntry
    ) {
      return;
    }

    const payload =
      preview.dates.map(
        (date) => ({
          channelKey:
            selectedChannel,

          channel:
            selectedChannelEntry
              .name,

          date,

          intervals:
            preview.intervals[
              date
            ] || [],
        })
      );

    setUploading(true);
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

            body:
              JSON.stringify({
                payload,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setMessage({
          type: "danger",

          text:
            getApiErrorMessage(
              data,
              `Upload failed (${response.status}).`
            ),
        });

        return;
      }

      setMessage({
        type: "success",

        text:
          data.message ||
          "Pattern upload completed.",
      });

      setPreview(null);

      if (fileRef.current) {
        fileRef.current.value =
          "";
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
  // DELETE PATTERNS
  // ==========================================

  const deletePatterns =
    async (
      channelKey
    ) => {
      const channelName =
        channelByKey[
          channelKey
        ]?.name ||
        loadedPatterns[
          channelKey
        ]?.channelName ||
        channelKey;

      const confirmed =
        window.confirm(
          `Delete all patterns for ${channelName}?`
        );

      if (!confirmed) {
        return;
      }

      try {
        const response =
          await fetch(
            `/api/capacity-engine/patterns?capPlan=${encodeURIComponent(
              capPlanId
            )}&channelKey=${encodeURIComponent(
              channelKey
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
          throw new Error(
            getApiErrorMessage(
              data,
              `Delete failed (${response.status}).`
            )
          );
        }

        setMessage({
          type: "success",

          text:
            data.message ||
            "Patterns deleted.",
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
            error?.message ||
            "The patterns could not be deleted.",
        });
      }
    };

  // ==========================================
  // DOWNLOAD TEMPLATE
  // ==========================================

  const downloadTemplate = () => {
    const dates =
      getWeekDates();

    if (
      dates.length === 0
    ) {
      setMessage({
        type: "warning",

        text:
          "Select a week range first to generate a template with the correct dates.",
      });

      return;
    }

    if (
      !selectedChannel ||
      !selectedChannelEntry
    ) {
      setMessage({
        type: "warning",

        text:
          "Select a channel before downloading the template.",
      });

      return;
    }

    const slotsByDate =
      Object.fromEntries(
        dates.map(
          (date) => [
            date,
            getTimeSlots(
              selectedChannel,
              date
            ),
          ]
        )
      );

    const allTimes = [
      ...new Set(
        Object.values(
          slotsByDate
        ).flat()
      ),
    ].sort();

    if (
      allTimes.length === 0
    ) {
      setMessage({
        type: "danger",

        text:
          "The selected channel has no open intervals in the selected week range.",
      });

      return;
    }

    const validTimeSets =
      Object.fromEntries(
        dates.map(
          (date) => [
            date,
            new Set(
              slotsByDate[
                date
              ]
            ),
          ]
        )
      );

    const buildSection = (
      label,
      getValue
    ) => {
      let section =
        `${label},${dates.join(
          ","
        )}\n`;

      allTimes.forEach(
        (time) => {
          section +=
            `${time},${dates
              .map(
                (date) =>
                  getValue(
                    date,
                    time
                  )
              )
              .join(",")}\n`;
        }
      );

      return section;
    };

    const getDistributionValue = (
      date,
      time
    ) => {
      if (
        !validTimeSets[
          date
        ].has(time)
      ) {
        return "";
      }

      const count =
        slotsByDate[
          date
        ].length;

      return count > 0
        ? (
            100 / count
          ).toFixed(4)
        : "";
    };

    const distributionLabel =
      selectedRequiresAHT
        ? "Volume Distribution %"
        : "Hours Distribution %";

    let csv =
      buildSection(
        distributionLabel,
        getDistributionValue
      );

    /*
     * Hours templates intentionally do not
     * contain an AHT section.
     */
    if (
      selectedRequiresAHT
    ) {
      csv += "\n";

      csv += buildSection(
        "AHT Multiplier",
        (date, time) =>
          validTimeSets[
            date
          ].has(time)
            ? "1.0"
            : ""
      );
    }

    csv += "\n";

    csv += buildSection(
      "Shrinkage %",
      (date, time) =>
        validTimeSets[
          date
        ].has(time)
          ? "0"
          : ""
    );

    csv +=
      `\n# Channel: ${selectedChannelEntry.name}\n`;

    csv +=
      `# Channel Key: ${selectedChannel}\n`;

    csv +=
      `# Model: ${selectedChannelEntry.model || "default"}\n`;

    csv +=
      `# Interval (min): ${intervalMinutes || 30}\n`;

    csv +=
      "# Blank cells are outside the channel HOOP for that date.\n";

    if (
      !selectedRequiresAHT
    ) {
      csv +=
        "# Hours patterns do not use AHT.\n";
    }

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;

    link.download =
      `pattern_${safeFileName(
        selectedChannelEntry.name
      )}.csv`;

    document.body.appendChild(
      link
    );

    link.click();

    document.body.removeChild(
      link
    );

    URL.revokeObjectURL(url);
  };

  // ==========================================
  // COPY PATTERNS
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
                week !==
                weekStart
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
        !selectedChannelEntry ||
        !copySourceWeek ||
        copyTargetWeeks.length ===
          0
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
                .intervals?.[
                date
              ]
            )
        );

      if (
        missingSourceDates.length >
        0
      ) {
        setMessage({
          type: "danger",

          text:
            `The source week is incomplete. Missing: ` +
            `${missingSourceDates.join(", ")}.`,
        });

        return;
      }

      const existingTargetDates =
        [];

      copyTargetWeeks.forEach(
        (targetWeek) => {
          getSevenDates(
            targetWeek
          ).forEach(
            (date) => {
              if (
                Array.isArray(
                  channelPattern
                    .intervals?.[
                    date
                  ]
                )
              ) {
                existingTargetDates.push(
                  date
                );
              }
            }
          );
        }
      );

      if (
        existingTargetDates.length >
        0
      ) {
        const confirmed =
          window.confirm(
            `${existingTargetDates.length} target date(s) already contain patterns for ${selectedChannelEntry.name}. Continuing will replace those dates. Continue?`
          );

        if (!confirmed) {
          return;
        }
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
                channelKey:
                  selectedChannel,

                channel:
                  selectedChannelEntry
                    .name,

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

                      ...(selectedRequiresAHT
                        ? {
                            ahtMultiplier:
                              interval.ahtMultiplier,
                          }
                        : {}),

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

              body:
                JSON.stringify({
                  payload,

                  operation:
                    "copy",

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

            text:
              getApiErrorMessage(
                data,
                `Copy failed (${response.status}).`
              ),
          });

          return;
        }

        setMessage({
          type: "success",

          text:
            data.message ||
            "Pattern copy completed.",
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
        setCopyingPatterns(
          false
        );
      }
    };

  // ==========================================
// WEEKLY VISUALIZATION DATA
// ==========================================

const [
  focusedVisualizationDate,
  setFocusedVisualizationDate,
] = useState("");

const [
  hoveredVisualizationDate,
  setHoveredVisualizationDate,
] = useState("");

const [
  weekdaysOnly,
  setWeekdaysOnly,
] = useState(false);

const loadedChannelKeys =
  Object.keys(
    loadedPatterns
  );

const hasPatterns =
  loadedChannelKeys.length > 0;

const visualizationPattern =
  loadedPatterns[
    visualizationChannel
  ] || null;

const visualizationChannelEntry =
  channelByKey[
    visualizationChannel
  ] || null;

const visualizationChannelName =
  visualizationPattern?.channelName ||
  visualizationChannelEntry?.name ||
  visualizationChannel;

const visualizationRequiresAHT =
  visualizationPattern
    ? visualizationPattern
        .requiresAHT !== false
    : visualizationChannelEntry
        ?.requiresAHT !== false;

/*
 * Only weeks containing at least one stored
 * date for the selected channel are offered.
 */
const visualizationWeekOptions =
  availableWeekStarts.filter(
    (weekStart) =>
      getSevenDates(
        weekStart
      ).some(
        (date) =>
          Array.isArray(
            visualizationPattern
              ?.intervals?.[
              date
            ]
          )
      )
  );

const visualizationWeekOptionsKey =
  visualizationWeekOptions.join(
    "|"
  );

/*
 * Keep the selected week valid whenever the
 * chart channel or stored data changes.
 */
useEffect(() => {
  if (
    visualizationWeekOptions.length ===
    0
  ) {
    setSelectedVisualizationWeek(
      ""
    );

    return;
  }

  setSelectedVisualizationWeek(
    (currentWeek) =>
      visualizationWeekOptions.includes(
        currentWeek
      )
        ? currentWeek
        : visualizationWeekOptions[0]
  );
}, [
  visualizationChannel,
  visualizationWeekOptionsKey,
]);

/*
 * Hours channels do not have an AHT metric.
 * If the user changes from a volume channel
 * to an Hours channel while viewing AHT,
 * return to the distribution chart.
 */
useEffect(() => {
  if (
    metric === "aht" &&
    !visualizationRequiresAHT
  ) {
    setMetric("arrival");
  }
}, [
  metric,
  visualizationRequiresAHT,
]);

const visualizationWeekDates =
  selectedVisualizationWeek
    ? getSevenDates(
        selectedVisualizationWeek
      )
    : [];

/*
 * A working day contains at least one
 * interval. Closed and unavailable dates
 * are omitted.
 */
const allWorkingVisualizationDates =
  visualizationWeekDates.filter(
    (date) => {
      const intervals =
        visualizationPattern
          ?.intervals?.[
          date
        ];

      return (
        Array.isArray(
          intervals
        ) &&
        intervals.length > 0
      );
    }
  );

const isWeekendDate = (
  dateString
) => {
  const date = new Date(
    `${dateString}T00:00:00.000Z`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  const weekday =
    date.getUTCDay();

  return (
    weekday === 0 ||
    weekday === 6
  );
};

/*
 * The weekday filter affects only the
 * visualization. It does not modify data.
 */
const workingVisualizationDates =
  weekdaysOnly
    ? allWorkingVisualizationDates.filter(
        (date) =>
          !isWeekendDate(
            date
          )
      )
    : allWorkingVisualizationDates;

const workingVisualizationDatesKey =
  workingVisualizationDates.join(
    "|"
  );

/*
 * Clear a selected or hovered date if it is
 * no longer displayed after changing the
 * channel, week, or weekday filter.
 */
useEffect(() => {
  if (
    focusedVisualizationDate &&
    !workingVisualizationDates.includes(
      focusedVisualizationDate
    )
  ) {
    setFocusedVisualizationDate(
      ""
    );
  }

  if (
    hoveredVisualizationDate &&
    !workingVisualizationDates.includes(
      hoveredVisualizationDate
    )
  ) {
    setHoveredVisualizationDate(
      ""
    );
  }
}, [
  visualizationChannel,
  selectedVisualizationWeek,
  weekdaysOnly,
  workingVisualizationDatesKey,
  focusedVisualizationDate,
  hoveredVisualizationDate,
]);

/*
 * Hover temporarily takes priority over the
 * day selected by the planner.
 */
const activeVisualizationDate =
  hoveredVisualizationDate ||
  focusedVisualizationDate;

const toggleFocusedDate = (
  date
) => {
  setFocusedVisualizationDate(
    (currentDate) =>
      currentDate === date
        ? ""
        : date
  );
};

const showAllVisualizationDates =
  () => {
    setFocusedVisualizationDate(
      ""
    );

    setHoveredVisualizationDate(
      ""
    );
};

const getVisualizationMetricValue = (
  interval
) => {
  if (!interval) {
    return undefined;
  }

  switch (metric) {
    case "arrival":
      return interval.arrivalPct;

    case "aht":
      return interval.ahtMultiplier;

    case "shrinkage":
      return interval.shrinkagePct;

    default:
      return undefined;
  }
};

const buildWeeklyChartData = () => {
  if (
    !visualizationPattern ||
    !selectedVisualizationWeek ||
    workingVisualizationDates.length ===
      0
  ) {
    return [];
  }

  const allTimes =
    new Set();

  workingVisualizationDates.forEach(
    (date) => {
      const intervals =
        visualizationPattern
          .intervals[
          date
        ];

      intervals.forEach(
        (interval) => {
          if (interval?.time) {
            allTimes.add(
              interval.time
            );
          }
        }
      );
    }
  );

  return [
    ...allTimes,
  ]
    .sort()
    .map((time) => {
      const point = {
        time,
      };

      workingVisualizationDates.forEach(
        (date) => {
          const interval =
            visualizationPattern
              .intervals[
              date
            ].find(
              (item) =>
                item.time ===
                time
            );

          const value =
            getVisualizationMetricValue(
              interval
            );

          if (
            value !== undefined &&
            value !== null &&
            Number.isFinite(
              Number(value)
            )
          ) {
            point[date] =
              Number(value);
          }
        }
      );

      return point;
    });
};

const chartData =
  buildWeeklyChartData();

const distributionLabel =
  visualizationRequiresAHT
    ? "Volume Distribution %"
    : "Hours Distribution %";

const metricLabels = {
  arrival:
    distributionLabel,

  aht:
    "AHT Multiplier",

  shrinkage:
    "Shrinkage %",
};

const previewDate =
  preview?.dates?.[0] ||
  null;

const previewIntervals =
  previewDate
    ? preview?.intervals?.[
        previewDate
      ] || []
    : [];

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

      {/* ==================================== */}
      {/* PATTERN STATUS */}
      {/* ==================================== */}

      <div
        className="box mb-4"
        style={{
          background:
            "#fafafa",
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
                  channel.key
                ];

              const hasData =
                Boolean(pattern);

              return (
                <div
                  key={
                    channel.key
                  }
                  className="column is-narrow"
                >
                  <div
                    className={`tag is-medium ${
                      hasData
                        ? "is-success is-light"
                        : "is-danger is-light"
                    }`}
                    style={{
                      gap:
                        "0.3rem",
                    }}
                  >
                    {hasData ? (
                      <FaCheckCircle className="has-text-success" />
                    ) : (
                      <FaTimesCircle className="has-text-danger" />
                    )}

                    <strong>
                      {channel.name}
                    </strong>

                    <span className="is-size-7">
                      {channel.requiresAHT
                        ? "Volume"
                        : "Hours"}
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

      {/* ==================================== */}
      {/* UPLOAD */}
      {/* ==================================== */}

      <div className="box mb-4">
        <strong
          className="is-size-6 mb-2"
          style={{
            display:
              "block",
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
                  onChange={(
                    event
                  ) => {
                    setSelectedChannel(
                      event.target
                        .value
                    );

                    setPreview(null);
                    setMessage(null);

                    if (
                      fileRef.current
                    ) {
                      fileRef.current.value =
                        "";
                    }
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
                          channel.key
                        }
                      >
                        {
                          channel.name
                        }{" "}
                        (
                        {channel.requiresAHT
                          ? "Volume + AHT"
                          : "Hours"}
                        )
                        {loadedPatterns[
                          channel.key
                        ]
                          ? " ✓"
                          : ""}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="column">
            <div
              className="is-flex is-align-items-end"
              style={{
                gap:
                  "0.5rem",

                paddingTop:
                  "1.5rem",

                flexWrap:
                  "wrap",
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
                        selectedChannelName
                      }
                    </span>
                  </button>
                )}
            </div>
          </div>
        </div>

        {selectedChannelEntry && (
          <div className="notification is-info is-light is-size-7 py-2">
            <strong>
              {
                selectedChannelEntry.name
              }
            </strong>{" "}
            uses{" "}
            {selectedRequiresAHT
              ? "Volume Distribution %, AHT Multiplier, and Shrinkage %."
              : "Hours Distribution % and Shrinkage %. AHT is not used for this model."}
          </div>
        )}

        {preview && (
          <div className="mt-3">
            <div className="tags mb-2">
              <span className="tag is-info is-light">
                {
                  preview.dates
                    .length
                }{" "}
                date(s)
              </span>

              <span className="tag is-success is-light">
                {
                  preview.totalIntervals
                }{" "}
                intervals/day
              </span>

              <span className="tag is-warning is-light">
                {
                  preview.totalRows
                }{" "}
                total records
              </span>

              <span className="tag is-primary is-light">
                {selectedRequiresAHT
                  ? "Volume model"
                  : "Hours model"}
              </span>
            </div>

            <p className="is-size-7 has-text-grey mb-2">
              Dates:{" "}
              {
                preview.dates
              }{" "}
              →{" "}
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

            {previewDate && (
              <div
                className="table-container"
                style={{
                  maxHeight:
                    "220px",

                  overflow:
                    "auto",
                }}
              >
                <table className="table is-narrow is-striped is-fullwidth is-size-7">
                  <thead>
                    <tr>
                      <th>Time</th>

                      <th>
                        {selectedRequiresAHT
                          ? "Volume %"
                          : "Hours %"}
                      </th>

                      {selectedRequiresAHT && (
                        <th>
                          AHT Mult.
                        </th>
                      )}

                      <th>
                        Shrinkage %
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {previewIntervals.map(
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

                          {selectedRequiresAHT && (
                            <td>
                              {formatPatternValue(
                                interval.ahtMultiplier
                              )}
                            </td>
                          )}

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
                  {previewDate}.
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
                  : `Upload ${preview.dates.length} day(s)`}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* ==================================== */}
      {/* COPY PATTERN */}
      {/* ==================================== */}

      <div className="box mb-4">
        <strong
          className="is-size-6 mb-1"
          style={{
            display:
              "block",
          }}
        >
          Reuse Pattern Across Weeks
        </strong>

        <p className="is-size-7 has-text-grey mb-3">
          Copy a validated source
          pattern to matching weekdays
          in one or more selected weeks.
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
                  onChange={(
                    event
                  ) => {
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
                          channel.key
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
                    Select source week...
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
                {
                  selectedChannelName
                }
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
                selected plan range.
              </div>
            ) : (
              <div
                className="mb-3"
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(230px, 1fr))",

                  gap:
                    "0.5rem",
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

                          border:
                            selected
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

     {/* ==================================== */}
    {/* WEEKLY VISUALIZATION */}
    {/* ==================================== */}

    {hasPatterns && (
      <div className="box">
        <div className="mb-3">
          <strong className="is-size-6">
            Weekly Pattern Comparison
          </strong>

          <p className="is-size-7 has-text-grey mt-1">
            Compare the selected channel’s
            working-day distributions across
            one week. Each line represents a
            different day.
          </p>
        </div>

        {/* ================================== */}
        {/* CHART FILTERS */}
        {/* ================================== */}

        <div className="columns is-vcentered mb-2">
          <div className="column is-4">
            <div className="field">
              <label className="label is-small">
                Chart channel
              </label>

              <div className="select is-small is-fullwidth">
                <select
                  value={
                    visualizationChannel
                  }
                  onChange={(
                    event
                  ) => {
                    setVisualizationChannel(
                      event.target.value
                    );

                    setSelectedVisualizationWeek(
                      ""
                    );

                    setFocusedVisualizationDate(
                      ""
                    );

                    setHoveredVisualizationDate(
                      ""
                    );
                  }}
                >
                  {loadedChannelKeys.map(
                    (channelKey) => {
                      const pattern =
                        loadedPatterns[
                          channelKey
                        ];

                      return (
                        <option
                          key={
                            channelKey
                          }
                          value={
                            channelKey
                          }
                        >
                          {
                            pattern.channelName
                          }{" "}
                          (
                          {pattern.requiresAHT
                            ? "Volume"
                            : "Hours"}
                          )
                        </option>
                      );
                    }
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="column is-4">
            <div className="field">
              <label className="label is-small">
                Week
              </label>

              <div className="select is-small is-fullwidth">
                <select
                  value={
                    selectedVisualizationWeek
                  }
                  disabled={
                    visualizationWeekOptions.length ===
                    0
                  }
                  onChange={(
                    event
                  ) => {
                    setSelectedVisualizationWeek(
                      event.target.value
                    );

                    setFocusedVisualizationDate(
                      ""
                    );

                    setHoveredVisualizationDate(
                      ""
                    );
                  }}
                >
                  {visualizationWeekOptions.length ===
                  0 ? (
                    <option value="">
                      No pattern weeks available
                    </option>
                  ) : (
                    visualizationWeekOptions.map(
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
                    )
                  )}
                </select>
              </div>
            </div>
          </div>

          <div className="column">
            <div
              className="is-flex is-align-items-flex-end is-justify-content-flex-end"
              style={{
                paddingTop:
                  "1.5rem",
              }}
            >
              <div className="buttons has-addons are-small mb-0">
                <button
                  type="button"
                  className={`button is-small ${
                    viewMode === "chart"
                      ? "is-info"
                      : ""
                  }`}
                  onClick={() =>
                    setViewMode(
                      "chart"
                    )
                  }
                  title="Chart view"
                >
                  <FaChartArea />
                </button>

                <button
                  type="button"
                  className={`button is-small ${
                    viewMode === "table"
                      ? "is-info"
                      : ""
                  }`}
                  onClick={() =>
                    setViewMode(
                      "table"
                    )
                  }
                  title="Table view"
                >
                  <FaTable />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ================================== */}
        {/* METRIC TABS */}
        {/* ================================== */}

        <div
          className="is-flex is-align-items-center is-justify-content-space-between is-flex-wrap-wrap mb-3"
          style={{
            gap: "0.75rem",
          }}
        >
          <div className="buttons has-addons are-small mb-0">
            <button
              type="button"
              className={`button is-small ${
                metric === "arrival"
                  ? "is-info"
                  : ""
              }`}
              onClick={() =>
                setMetric(
                  "arrival"
                )
              }
            >
              {distributionLabel}
            </button>

            {visualizationRequiresAHT && (
              <button
                type="button"
                className={`button is-small ${
                  metric === "aht"
                    ? "is-info"
                    : ""
                }`}
                onClick={() =>
                  setMetric(
                    "aht"
                  )
                }
              >
                AHT
              </button>
            )}

            <button
              type="button"
              className={`button is-small ${
                metric === "shrinkage"
                  ? "is-info"
                  : ""
              }`}
              onClick={() =>
                setMetric(
                  "shrinkage"
                )
              }
            >
              Shrinkage %
            </button>
          </div>

          <div
            className="is-flex is-align-items-center"
            style={{
              gap: "0.5rem",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className={`button is-small ${
                weekdaysOnly
                  ? "is-info is-light"
                  : "is-light"
              }`}
              onClick={() => {
                setWeekdaysOnly(
                  (currentValue) =>
                    !currentValue
                );

                setFocusedVisualizationDate(
                  ""
                );

                setHoveredVisualizationDate(
                  ""
                );
              }}
              title="Show or hide Saturday and Sunday"
            >
              {weekdaysOnly
                ? "All Weekdays"
                : "Mon-Fri only"}
            </button>

            <button
              type="button"
              className="button is-small is-light"
              onClick={
                showAllVisualizationDates
              }
              disabled={
                !activeVisualizationDate
              }
              title="Give every displayed day equal emphasis"
            >
              Show all
            </button>

            <span className="tag is-light">
              <strong>
                {visualizationChannelName}
              </strong>

              &nbsp;·&nbsp;

              {visualizationRequiresAHT
                ? "Volume model"
                : "Hours model"}
            </span>
          </div>
        </div>

        {!visualizationRequiresAHT && (
          <div className="notification is-info is-light is-size-7 py-2">
            This Hours channel uses Hours
            Distribution % and Shrinkage %.
            AHT is not applicable.
          </div>
        )}

        {/* ================================== */}
        {/* INTERACTIVE DAY LEGEND */}
        {/* ================================== */}

        {workingVisualizationDates.length >
          0 && (
          <div className="mb-3">
            <p className="is-size-7 has-text-grey mb-2">
              Select a day to focus its line.
              Hover over another day for a
              temporary comparison.
            </p>

            <div
              className="is-flex"
              style={{
                gap: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              {workingVisualizationDates.map(
                (
                  date,
                  index
                ) => {
                  const focused =
                    focusedVisualizationDate ===
                    date;

                  const active =
                    activeVisualizationDate ===
                    date;

                  const dimmed =
                    Boolean(
                      activeVisualizationDate
                    ) &&
                    !active;

                  const color =
                    DAY_COLORS[
                      index %
                        DAY_COLORS.length
                    ];

                  return (
                    <button
                      type="button"
                      key={date}
                      className="button is-small"
                      onClick={() =>
                        toggleFocusedDate(
                          date
                        )
                      }
                      onMouseEnter={() =>
                        setHoveredVisualizationDate(
                          date
                        )
                      }
                      onMouseLeave={() =>
                        setHoveredVisualizationDate(
                          ""
                        )
                      }
                      aria-pressed={
                        focused
                      }
                      title={
                        focused
                          ? "Remove focus from this day"
                          : `Focus ${getWeekdayLabel(
                              date,
                              "long"
                            )}`
                      }
                      style={{
                        border:
                          focused
                            ? `2px solid ${color}`
                            : "1px solid #dddddd",

                        background:
                          focused
                            ? `${color}18`
                            : "#ffffff",

                        opacity:
                          dimmed
                            ? 0.45
                            : 1,

                        transition:
                          "opacity 140ms ease, border-color 140ms ease, background 140ms ease",
                      }}
                    >
                      <span
                        style={{
                          width: "18px",

                          height:
                            active
                              ? "4px"
                              : "3px",

                          borderRadius:
                            "2px",

                          backgroundColor:
                            color,

                          display:
                            "inline-block",

                          marginRight:
                            "0.35rem",
                        }}
                      />

                      <strong>
                        {getWeekdayLabel(
                          date,
                          "long"
                        )}
                      </strong>

                      <span className="has-text-grey ml-1">
                        {date}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>
        )}

        <p className="is-size-7 has-text-grey mb-2">
        <strong>
          {metricLabels[metric]}
        </strong>

        {selectedVisualizationWeek && (
          <>
            {" "}
            —{" "}
            {formatWeekLabel(
              selectedVisualizationWeek
            )}
          </>
        )}

        {workingVisualizationDates.length >
          0 && (
          <>
            {" "}
            ·{" "}
            {
              workingVisualizationDates.length
            }{" "}
            displayed working day
            {workingVisualizationDates.length ===
            1
              ? ""
              : "s"}
          </>
        )}

        {focusedVisualizationDate && (
          <>
            {" "}
            · Focused:{" "}
            <strong>
              {getWeekdayLabel(
                focusedVisualizationDate,
                "long"
              )}{" "}
              {
                focusedVisualizationDate
              }
            </strong>
          </>
        )}
      </p>

        {/* ================================== */}
        {/* CHART VIEW */}
        {/* ================================== */}

        {viewMode === "chart" &&
          chartData.length > 0 &&
          workingVisualizationDates.length >
            0 && (
            <ResponsiveContainer
              width="100%"
              height={360}
            >
              <LineChart
                data={
                  chartData
                }
                margin={{
                  top: 10,
                  right: 25,
                  left: 15,
                  bottom: 5,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#eeeeee"
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
                  domain={
                    metric === "aht"
                      ? [
                          "auto",
                          "auto",
                        ]
                      : [
                          0,
                          "auto",
                        ]
                  }
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
                    borderRadius: "6px",
                    border:
                      "1px solid #e5e5e5",
                  }}
                  labelFormatter={(
                    time
                  ) =>
                    `Time: ${time}`
                  }
                  itemSorter={(item) =>
                    item?.dataKey ===
                    activeVisualizationDate
                      ? -1
                      : 1
                  }
                  formatter={(
                    value,
                    date
                  ) => [
                    metric === "aht"
                      ? `×${Number(
                          value
                        ).toFixed(
                          2
                        )}`
                      : `${Number(
                          value
                        ).toFixed(
                          2
                        )}%`,

                    `${getWeekdayLabel(
                      date,
                      "long"
                    )} ${date}`,
                  ]}
                />

                {workingVisualizationDates.map(
                  (
                    date,
                    index
                  ) => {
                    const active =
                      activeVisualizationDate ===
                      date;

                    const hasActiveDate =
                      Boolean(
                        activeVisualizationDate
                      );

                    const dimmed =
                      hasActiveDate &&
                      !active;

                    const color =
                      DAY_COLORS[
                        index %
                          DAY_COLORS.length
                      ];

                    return (
                      <Line
                        key={date}

                        /*
                        * Pattern values belong to discrete
                        * intervals, so straight segments are
                        * more accurate than smoothed curves.
                        */
                        type="linear"

                        dataKey={date}
                        name={date}
                        stroke={color}

                        strokeWidth={
                          active
                            ? 3.5
                            : hasActiveDate
                              ? 1.25
                              : 2
                        }

                        strokeOpacity={
                          dimmed
                            ? 0.16
                            : 1
                        }

                        dot={false}
                        connectNulls={false}

                        activeDot={{
                          r:
                            active ||
                            !hasActiveDate
                              ? 4
                              : 2,

                          strokeWidth: 1,
                        }}

                        isAnimationActive={
                          false
                        }
                      />
                    );
                  }
                )}
              </LineChart>
            </ResponsiveContainer>
          )}

        {/* ================================== */}
        {/* TABLE VIEW */}
        {/* ================================== */}

        {viewMode === "table" &&
          chartData.length > 0 &&
          workingVisualizationDates.length >
            0 && (
            <div
              className="table-container"
              style={{
                maxHeight:
                  "450px",

                overflow:
                  "auto",
              }}
            >
              <table className="table is-narrow is-striped is-bordered is-fullwidth is-size-7">
                <thead>
                  <tr>
                    <th>Time</th>

                    {workingVisualizationDates.map(
                      (
                        date,
                        index
                      ) => (
                        <th
                          key={
                            date
                          }
                          className="has-text-centered"
                          style={{
                            borderBottom:
                              `3px solid ${
                                DAY_COLORS[
                                  index %
                                    DAY_COLORS.length
                                ]
                              }`,
                          }}
                        >
                          <div>
                            {getWeekdayLabel(
                              date,
                              "short"
                            )}
                          </div>

                          <div className="has-text-grey has-text-weight-normal">
                            {date}
                          </div>
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
                            {row.time}
                          </strong>
                        </td>

                        {workingVisualizationDates.map(
                          (date) => {
                            const value =
                              row[date];

                            return (
                              <td
                                key={
                                  date
                                }
                                className="has-text-centered"
                              >
                                {value !==
                                undefined
                                  ? metric ===
                                    "aht"
                                    ? `×${Number(
                                        value
                                      ).toFixed(
                                        2
                                      )}`
                                    : `${Number(
                                        value
                                      ).toFixed(
                                        2
                                      )}%`
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

        {/* ================================== */}
        {/* EMPTY STATE */}
        {/* ================================== */}

        {(
          !selectedVisualizationWeek ||
          chartData.length === 0 ||
          workingVisualizationDates.length ===
            0
        ) && (
          <div className="notification is-warning is-light is-size-7">
            No working-day pattern data is
            available for the selected
            channel and week.
          </div>
        )}
      </div>
    )}
    </div>
  );
}