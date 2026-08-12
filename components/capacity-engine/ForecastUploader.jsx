// ============================================
// FORECAST UPLOADER
//
// Uploads daily forecast volumes by channel.
//
// CSV format:
//   channel,date,volume
//
// Channel identity:
//   - channelKey is the permanent identifier.
//   - channel is the editable display name.
//
// The CSV remains user-friendly and uses the
// current channel display name. Before upload,
// each name is resolved to its stable key.
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
  FaCheck,
} from "react-icons/fa";

// ============================================
// GENERAL HELPERS
// ============================================

function normalizeChannelName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeDate(rawValue) {
  if (!rawValue) {
    return null;
  }

  const value =
    String(rawValue).trim();

  // ISO format: YYYY-M-D or YYYY-MM-DD
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

  // US format: M/D/YYYY
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

function getWeekCode(isoDate) {
  const date = new Date(
    `${isoDate}T00:00:00.000Z`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  /*
   * Preserve the application's existing
   * year/week convention.
   */
  const year =
    date.getUTCFullYear();

  const januaryFirst =
    new Date(
      Date.UTC(year, 0, 1)
    );

  const dayOfYear =
    Math.floor(
      (
        date.getTime() -
        januaryFirst.getTime()
      ) /
        86400000
    ) + 1;

  const weekNumber =
    Math.ceil(
      (
        dayOfYear +
        januaryFirst.getUTCDay()
      ) / 7
    );

  return `${year}w${weekNumber}`;
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
    return value.slice(0, 10);
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

function addDaysUTC(
  dateString,
  dayCount
) {
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
      dayCount
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function getApiErrorMessage(
  responseData,
  fallback
) {
  const validationErrors =
    responseData?.validation
      ?.errors;

  const validationDetails =
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
    responseData?.message ||
      fallback,
    validationDetails,
  ]
    .filter(Boolean)
    .join(" ");
}

// ============================================
// COMPONENT
// ============================================

export default function ForecastUploader({
  capPlanId,
  channelsConfig,
  weekDocs,
  onUploadComplete,
}) {
  const auth = useAuth();
  const fileRef = useRef(null);

  // ==========================================
  // STATE
  // ==========================================

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

  const [
    existingForecasts,
    setExistingForecasts,
  ] = useState([]);

  const [
    loadingExisting,
    setLoadingExisting,
  ] = useState(false);

  const authorization =
    auth.authorization();

  // ==========================================
  // CHANNEL CONFIGURATION
  // ==========================================

  const channelEntries =
    channelsConfig
      ? Object.entries(
          channelsConfig
        ).map(
          ([
            key,
            config,
          ]) => ({
            key,

            name: String(
              config?.name || key
            ).trim(),
          })
        )
      : [];

  // ==========================================
  // LOAD EXISTING FORECASTS
  // ==========================================

  const loadExisting =
    useCallback(async () => {
      if (!capPlanId) {
        setExistingForecasts(
          []
        );

        return;
      }

      setLoadingExisting(true);

      try {
        const response =
          await fetch(
            `/api/capacity-engine/forecast?capPlan=${encodeURIComponent(
              capPlanId
            )}`,
            {
              headers: {
                Authorization:
                  authorization,
              },
            }
          );

        const responseData =
          await response.json();

        if (!response.ok) {
          throw new Error(
            getApiErrorMessage(
              responseData,
              `Unable to load forecasts (${response.status}).`
            )
          );
        }

        setExistingForecasts(
          Array.isArray(
            responseData.data
          )
            ? responseData.data
            : []
        );
      } catch (error) {
        console.error(
          "Failed to load existing forecasts:",
          error
        );

        setExistingForecasts(
          []
        );

        setMessage({
          type: "danger",

          text:
            error?.message ||
            "Unable to load existing forecasts.",
        });
      } finally {
        setLoadingExisting(
          false
        );
      }
    }, [
      capPlanId,
      authorization,
    ]);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  // ==========================================
  // PARSE CSV
  // ==========================================

  const parseCSV = (text) => {
    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return null;
    }

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

    const delimiter =
      lines[0].includes("\t")
        ? "\t"
        : ",";

    const header = lines[0]
      .split(delimiter)
      .map((column) =>
        column
          .trim()
          .toLowerCase()
      );

    const channelIndex =
      header.findIndex(
        (column) =>
          column === "channel" ||
          column === "name"
      );

    const dateIndex =
      header.findIndex(
        (column) =>
          column === "date"
      );

    const volumeIndex =
      header.findIndex(
        (column) =>
          column === "volume" ||
          column === "volumes" ||
          column === "vol"
      );

    if (
      channelIndex === -1 ||
      dateIndex === -1 ||
      volumeIndex === -1
    ) {
      return null;
    }

    const results = [];

    for (
      let lineIndex = 1;
      lineIndex < lines.length;
      lineIndex += 1
    ) {
      const columns =
        lines[lineIndex]
          .split(delimiter)
          .map((column) =>
            column.trim()
          );

      const channel =
        columns[
          channelIndex
        ] || "";

      const rawDate =
        columns[
          dateIndex
        ] || "";

      const rawVolume =
        columns[
          volumeIndex
        ];

      /*
       * Ignore completely empty rows.
       */
      if (
        !channel &&
        !rawDate &&
        (
          rawVolume ===
            undefined ||
          rawVolume === ""
        )
      ) {
        continue;
      }

      const date =
        normalizeDate(
          rawDate
        );

      const volume =
        rawVolume === ""
          ? Number.NaN
          : Number(
              rawVolume
            );

      results.push({
        sourceRow:
          lineIndex + 1,

        channel:
          String(channel).trim(),

        date,

        volume,

        week:
          date
            ? getWeekCode(date)
            : null,

        dateValid:
          Boolean(date),

        volumeValid:
          Number.isFinite(
            volume
          ) && volume >= 0,
      });
    }

    return results.length > 0
      ? results
      : null;
  };

  // ==========================================
  // HANDLE FILE
  // ==========================================

  const handleFile = (event) => {
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
        parseCSV(
          readerEvent
            .target?.result
        );

      if (
        !parsed ||
        parsed.length === 0
      ) {
        setMessage({
          type: "danger",

          text:
            "Invalid CSV format. Expected columns: channel, date, volume.",
        });

        setPreview(null);

        return;
      }

      /*
       * Resolve each CSV display name to one
       * stable configured channel key.
       */
      const validated =
        parsed.map((row) => {
          const uploadedChannel =
            String(
              row.channel || ""
            ).trim();

          const normalizedName =
            normalizeChannelName(
              uploadedChannel
            );

          const matches =
            channelEntries.filter(
              (channel) =>
                normalizeChannelName(
                  channel.name
                ) ===
                normalizedName
            );

          const matchedChannel =
            matches.length === 1
              ? matches[0]
              : null;

          const channelValid =
            Boolean(
              matchedChannel
            );

          return {
            ...row,

            uploadedChannel,

            /*
             * Send the configured current
             * display name, not arbitrary CSV
             * capitalization.
             */
            channel:
              matchedChannel?.name ||
              uploadedChannel,

            channelKey:
              matchedChannel?.key ||
              "",

            channelValid,

            valid:
              channelValid &&
              row.dateValid &&
              row.volumeValid,
          };
        });

      const invalidRows =
        validated.filter(
          (row) =>
            !row.valid
        );

      if (
        invalidRows.length > 0
      ) {
        const unknownChannels = [
          ...new Set(
            invalidRows
              .filter(
                (row) =>
                  !row.channelValid
              )
              .map(
                (row) =>
                  row.uploadedChannel ||
                  "(blank)"
              )
          ),
        ];

        const invalidDateCount =
          invalidRows.filter(
            (row) =>
              !row.dateValid
          ).length;

        const invalidVolumeCount =
          invalidRows.filter(
            (row) =>
              !row.volumeValid
          ).length;

        const details = [];

        if (
          unknownChannels.length >
          0
        ) {
          details.push(
            `Unknown channel(s): ${unknownChannels.join(
              ", "
            )}.`
          );
        }

        if (
          invalidDateCount > 0
        ) {
          details.push(
            `${invalidDateCount} row(s) have an invalid date.`
          );
        }

        if (
          invalidVolumeCount > 0
        ) {
          details.push(
            `${invalidVolumeCount} row(s) have an invalid volume.`
          );
        }

        setMessage({
          type: "danger",

          text:
            `${invalidRows.length} row(s) failed validation. ` +
            details.join(" ") +
            " Correct the CSV before uploading.",
        });
      } else {
        setMessage({
          type: "info",

          text:
            `Validated ${validated.length} forecast record(s). ` +
            "All channel names were matched to stable channel identifiers.",
        });
      }

      setPreview(
        validated
      );
    };

    reader.onerror = () => {
      setPreview(null);

      setMessage({
        type: "danger",

        text:
          "The selected CSV file could not be read.",
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
      preview.length === 0
    ) {
      return;
    }

    const invalidRows =
      preview.filter(
        (row) => !row.valid
      );

    if (
      invalidRows.length > 0
    ) {
      setMessage({
        type: "danger",

        text:
          "The forecast cannot be uploaded until every row is valid and every channel matches the current configuration.",
      });

      return;
    }

    /*
     * Send only supported API fields.
     */
    const payload =
      preview.map((row) => ({
        channelKey:
          row.channelKey,

        channel:
          row.channel,

        date:
          row.date,

        volume:
          row.volume,

        week:
          row.week,
      }));

    setUploading(true);
    setMessage(null);

    try {
      const response =
        await fetch(
          `/api/capacity-engine/forecast?capPlan=${encodeURIComponent(
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

      const responseData =
        await response.json();

      if (!response.ok) {
        setMessage({
          type: "danger",

          text:
            getApiErrorMessage(
              responseData,
              `Upload failed (${response.status}).`
            ),
        });

        return;
      }

      setMessage({
        type: "success",

        text:
          responseData.message ||
          "Forecast upload completed.",
      });

      setPreview(null);

      if (fileRef.current) {
        fileRef.current.value =
          "";
      }

      await loadExisting();

      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error) {
      console.error(
        "Forecast upload failed:",
        error
      );

      setMessage({
        type: "danger",

        text:
          "The forecast upload failed.",
      });
    } finally {
      setUploading(false);
    }
  };

  // ==========================================
  // DELETE ALL FORECASTS
  // ==========================================

  const deleteAll = async () => {
    const confirmed =
      window.confirm(
        "Delete all forecast data for this capacity plan?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/capacity-engine/forecast?capPlan=${encodeURIComponent(
            capPlanId
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
          getApiErrorMessage(
            responseData,
            `Delete failed (${response.status}).`
          )
        );
      }

      setMessage({
        type: "success",

        text:
          responseData.message ||
          "Forecasts deleted.",
      });

      setExistingForecasts(
        []
      );
    } catch (error) {
      console.error(
        "Forecast deletion failed:",
        error
      );

      setMessage({
        type: "danger",

        text:
          error?.message ||
          "The forecasts could not be deleted.",
      });
    }
  };

  // ==========================================
  // DOWNLOAD TEMPLATE
  // ==========================================

  const downloadTemplate = () => {
    if (
      channelEntries.length === 0
    ) {
      setMessage({
        type: "warning",

        text:
          "No configured channels are available for the forecast template.",
      });

      return;
    }

    const dates = [];

    (weekDocs || []).forEach(
      (week) => {
        const firstDate =
          toISODate(
            week?.firstDate
          );

        if (!firstDate) {
          return;
        }

        for (
          let dayIndex = 0;
          dayIndex < 7;
          dayIndex += 1
        ) {
          const date =
            addDaysUTC(
              firstDate,
              dayIndex
            );

          if (date) {
            dates.push(date);
          }
        }
      }
    );

    const uniqueDates = [
      ...new Set(dates),
    ].sort();

    if (
      uniqueDates.length === 0
    ) {
      setMessage({
        type: "warning",

        text:
          "Select a week range before downloading the forecast template.",
      });

      return;
    }

    let csv =
      "channel,date,volume\n";

    channelEntries.forEach(
      (channel) => {
        uniqueDates.forEach(
          (date) => {
            csv +=
              `${channel.name},${date},0\n`;
          }
        );
      }
    );

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
      "forecast_template.csv";

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
  // PREVIEW SUMMARY
  // ==========================================

  const summarizePreview = () => {
    if (!preview) {
      return null;
    }

    const channels = [
      ...new Set(
        preview.map(
          (row) =>
            row.channel
        )
      ),
    ];

    const dates = [
      ...new Set(
        preview
          .map(
            (row) =>
              row.date
          )
          .filter(Boolean)
      ),
    ].sort();

    const totalVolume =
      preview.reduce(
        (total, row) =>
          total +
          (
            Number.isFinite(
              row.volume
            )
              ? row.volume
              : 0
          ),
        0
      );

    return {
      channels,
      dates,
      totalVolume,
      rows:
        preview.length,

      invalidRows:
        preview.filter(
          (row) =>
            !row.valid
        ).length,
    };
  };

  // ==========================================
  // DERIVED DISPLAY VALUES
  // ==========================================

  if (!capPlanId) {
    return null;
  }

  const summary =
    summarizePreview();

  const previewHasInvalidRows =
    Boolean(
      preview?.some(
        (row) =>
          !row.valid
      )
    );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="box">
      <h3 className="title is-5 mb-3">
        Forecast Upload
      </h3>

      {message && (
        <div
          className={`notification is-${message.type} is-light`}
        >
          {message.text}
        </div>
      )}

      {/* ==================================== */}
      {/* ACTIONS */}
      {/* ==================================== */}

      <div className="is-flex is-align-items-center is-flex-wrap-wrap mb-3">
        <div className="file is-small is-info mr-3 mb-2">
          <label className="file-label">
            <input
              ref={fileRef}
              className="file-input"
              type="file"
              accept=".csv"
              onChange={
                handleFile
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
          className="button is-small is-light is-rounded mr-3 mb-2"
          onClick={
            downloadTemplate
          }
        >
          <span className="icon is-small">
            <FaFileDownload />
          </span>

          <span>Template</span>
        </button>

        <button
          type="button"
          className="button is-small is-light is-rounded mr-3 mb-2"
          onClick={
            loadExisting
          }
          disabled={
            loadingExisting
          }
        >
          {loadingExisting
            ? "Loading..."
            : `View Existing (${existingForecasts.length})`}
        </button>

        {existingForecasts.length >
          0 && (
          <button
            type="button"
            className="button is-small is-danger is-light is-rounded mb-2"
            onClick={
              deleteAll
            }
          >
            <span className="icon is-small">
              <FaTrash />
            </span>

            <span>
              Clear All
            </span>
          </button>
        )}
      </div>

      {/* ==================================== */}
      {/* CSV PREVIEW */}
      {/* ==================================== */}

      {summary && (
        <div className="mb-3">
          <div className="tags">
            <span className="tag is-info is-light">
              {summary.rows} rows
            </span>

            <span className="tag is-success is-light">
              {
                summary.channels
                  .length
              }{" "}
              channel(s):{" "}
              {summary.channels.join(
                ", "
              )}
            </span>

            <span className="tag is-warning is-light">
              {
                summary.dates
                  .length
              }{" "}
              date(s)
              {summary.dates.length >
              0
                ? `: ${
                    summary
                      .dates
                  } → ${
                    summary.dates[
                      summary
                        .dates
                        .length -
                        1
                    ]
                  }`
                : ""}
            </span>

            <span className="tag is-primary is-light">
              Total volume:{" "}
              {summary.totalVolume.toLocaleString()}
            </span>

            {summary.invalidRows >
              0 && (
              <span className="tag is-danger">
                {
                  summary.invalidRows
                }{" "}
                invalid row(s)
              </span>
            )}
          </div>

          <div
            className="table-container"
            style={{
              maxHeight:
                "240px",

              overflow:
                "auto",
            }}
          >
            <table className="table is-narrow is-striped is-fullwidth is-size-7">
              <thead>
                <tr>
                  <th>
                    CSV Row
                  </th>

                  <th>
                    Channel
                  </th>

                  <th>
                    Channel Key
                  </th>

                  <th>Date</th>

                  <th>Volume</th>

                  <th>Valid</th>
                </tr>
              </thead>

              <tbody>
                {preview
                  .slice(0, 20)
                  .map(
                    (
                      row,
                      index
                    ) => (
                      <tr
                        key={`${row.sourceRow}-${row.channelKey}-${row.date}-${index}`}
                      >
                        <td>
                          {
                            row.sourceRow
                          }
                        </td>

                        <td>
                          {
                            row.channel
                          }
                        </td>

                        <td>
                          <code>
                            {row.channelKey ||
                              "—"}
                          </code>
                        </td>

                        <td>
                          {row.date ||
                            "Invalid"}
                        </td>

                        <td>
                          {Number.isFinite(
                            row.volume
                          )
                            ? row.volume
                            : "Invalid"}
                        </td>

                        <td>
                          {row.valid ? (
                            <FaCheck className="has-text-success" />
                          ) : (
                            <span className="has-text-danger">
                              ⚠
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  )}

                {preview.length >
                  20 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="has-text-centered has-text-grey"
                    >
                      ...and{" "}
                      {preview.length -
                        20}{" "}
                      more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            className="button is-small is-success is-rounded mt-2"
            onClick={upload}
            disabled={
              uploading ||
              previewHasInvalidRows
            }
          >
            <span className="icon is-small">
              <FaUpload />
            </span>

            <span>
              {uploading
                ? "Uploading..."
                : `Upload ${preview.length} Records`}
            </span>
          </button>
        </div>
      )}

      {/* ==================================== */}
      {/* EXISTING FORECASTS */}
      {/* ==================================== */}

      {existingForecasts.length >
        0 &&
        !preview && (
          <div className="mt-3">
            <label className="label is-small">
              Stored Forecasts
            </label>

            <div
              className="table-container"
              style={{
                maxHeight:
                  "240px",

                overflow:
                  "auto",
              }}
            >
              <table className="table is-narrow is-striped is-fullwidth is-size-7">
                <thead>
                  <tr>
                    <th>
                      Channel
                    </th>

                    <th>
                      Channel Key
                    </th>

                    <th>Date</th>

                    <th>
                      Volume
                    </th>

                    <th>
                      Updated By
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {existingForecasts
                    .slice(0, 100)
                    .map(
                      (
                        forecast,
                        index
                      ) => (
                        <tr
                          key={
                            forecast._id ||
                            `${forecast.channelKey}-${forecast.date}-${index}`
                          }
                        >
                          <td>
                            {
                              forecast.channel
                            }
                          </td>

                          <td>
                            <code>
                              {forecast.channelKey ||
                                "Legacy"}
                            </code>
                          </td>

                          <td>
                            {
                              forecast.date
                            }
                          </td>

                          <td>
                            {
                              forecast.volume
                            }
                          </td>

                          <td className="has-text-grey">
                            {forecast.updatedBy ||
                              "—"}
                          </td>
                        </tr>
                      )
                    )}
                </tbody>
              </table>
            </div>

            {existingForecasts.length >
              100 && (
              <p className="is-size-7 has-text-grey mt-1">
                Showing the first 100
                of{" "}
                {
                  existingForecasts.length
                }{" "}
                stored forecasts.
              </p>
            )}
          </div>
        )}
    </div>
  );
}