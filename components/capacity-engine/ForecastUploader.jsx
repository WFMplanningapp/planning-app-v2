// ============================================
// FORECAST UPLOADER
// Upload CSV with daily volumes per channel
// Format: channel,date,volume
// ============================================

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";

import { useAuth } from "../../contexts/authContext";
import { FaUpload, FaTrash, FaFileDownload, FaCheck } from "react-icons/fa";

export default function ForecastUploader({ capPlanId, channelsConfig, weekDocs, onUploadComplete }) {
  const auth = useAuth();
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);
  const [existingForecasts, setExistingForecasts] = useState([]);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const authorization = auth.authorization();

  const loadExisting = useCallback(async () => {
  if (!capPlanId) {
    setExistingForecasts([]);
    return;
  }

  setLoadingExisting(true);

  try {
    const response = await fetch(
      `/api/capacity-engine/forecast?capPlan=${encodeURIComponent(
        capPlanId
      )}`,
      {
        headers: {
          Authorization: authorization,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message ||
          `Unable to load forecasts (${response.status})`
      );
    }

    setExistingForecasts(
      Array.isArray(data.data)
        ? data.data
        : []
    );
  } catch (err) {
    console.error(
      "Failed to load existing forecasts:",
      err
    );

    setExistingForecasts([]);
    setMessage({
      type: "danger",
      text:
        err.message ||
        "Unable to load existing forecasts.",
    });
  } finally {
    setLoadingExisting(false);
  }
}, [capPlanId, authorization]);

useEffect(() => {
  loadExisting();
}, [loadExisting]);

  // Parse CSV (handles both comma and tab delimiters)
  const parseCSV = (text) => {

    // Add this helper at the top of parseCSV
    const getWeekCode = (isoDate) => {
      const d = new Date(isoDate + "T00:00:00");
      const jan1 = new Date(d.getFullYear(), 0, 1);
      const dayOfYear = Math.ceil((d - jan1) / 86400000) + 1;
      const weekNum = Math.ceil((dayOfYear + jan1.getDay()) / 7);
      return `${d.getFullYear()}w${weekNum}`;
    };

    const lines = text
      .trim()
      .split("\n")
      .map((l) => l.replace(/\r/g, ""))
      .filter((l) => l.trim().length > 0);

    if (lines.length < 2) return [];

    // Detect delimiter
    const delimiter = lines[0].includes("\t") ? "\t" : ",";

    const header = lines[0]
      .split(delimiter)
      .map((h) => h.trim().toLowerCase());

    const channelIdx = header.findIndex(
      (h) => h === "channel" || h === "name"
    );
    const dateIdx = header.findIndex((h) => h === "date");
    const volumeIdx = header.findIndex(
      (h) => h === "volume" || h === "volumes" || h === "vol"
    );

    if (channelIdx === -1 || dateIdx === -1 || volumeIdx === -1) {
      return null; // Invalid format
    }

    // Normalize date to ISO YYYY-MM-DD
    const normalizeDate = (raw) => {
      if (!raw) return null;
      const s = raw.trim();
      // Already ISO
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
        const [y, m, d] = s.split("-");
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      // US format: M/D/YYYY
      const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mdyMatch) {
        const [, m, d, y] = mdyMatch;
        return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      }
      return null;
    };

    const results = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(delimiter).map((c) => c.trim());

      const channel = cols[channelIdx] || "";
      const rawDate = cols[dateIdx] || "";
      const volume = parseFloat(cols[volumeIdx]) || 0;

      if (!channel || !rawDate) continue;

      const isoDate = normalizeDate(rawDate);
      if (!isoDate) continue;

      results.push({
        channel,
        date: isoDate,
        volume,
        week: getWeekCode(isoDate),
      });
    }

    return results.length > 0 ? results : null;
  };

  // Handle file selection
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const parsed = parseCSV(event.target.result);
      if (!parsed) {
        setMessage({
          type: "danger",
          text: "Invalid CSV format. Expected columns: channel, date, volume",
        });
        setPreview(null);
        return;
      }

      // Validate channel names against config
      const configChannelNames = channelsConfig
        ? Object.values(channelsConfig).map((c) => c.name.toLowerCase())
        : [];

      const validated = parsed.map((row) => ({
        ...row,
        valid:
          configChannelNames.length === 0 ||
          configChannelNames.includes(row.channel.toLowerCase()),
      }));

      const invalidCount = validated.filter((r) => !r.valid).length;
      if (invalidCount > 0) {
        setMessage({
          type: "warning",
          text: `${invalidCount} row(s) have channel names not matching your configuration. They will still be uploaded.`,
        });
      } else {
        setMessage(null);
      }

      setPreview(validated);
    };
    reader.readAsText(file);
  };

  // Upload to API
  const upload = async () => {
    if (!preview || preview.length === 0) return;
    setUploading(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/capacity-engine/forecast?capPlan=${capPlanId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({ payload: preview }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        setMessage({ type: "danger", text: data.message || `Upload failed (${response.status})` });
        setUploading(false);
        return;
      }
setMessage({ type: "success", text: data.message });
  setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
          if (onUploadComplete) onUploadComplete();
            loadExisting();
    } catch (err) {
      setMessage({ type: "danger", text: "Upload failed" });
    }
    setUploading(false);
  };

  // Delete all forecasts
  const deleteAll = async () => {
    if (!confirm("Delete all forecast data for this cap plan?")) return;
    try {
      const response = await fetch(
        `/api/capacity-engine/forecast?capPlan=${capPlanId}`,
        {
          method: "DELETE",
          headers: { Authorization: auth.authorization() },
        }
      );
      const data = await response.json();
      setMessage({ type: "success", text: data.message });
      setExistingForecasts([]);
    } catch (err) {
      setMessage({ type: "danger", text: "Delete failed" });
    }
  };

  // Download template
  const downloadTemplate = () => {
    const channelNames = channelsConfig
      ? Object.values(channelsConfig).map((c) => c.name)
      : ["Phone Main", "Email BO"];

    // Build dates from weekDocs
    const dates = [];
    if (weekDocs && weekDocs.length > 0) {
      weekDocs.forEach((w) => {
        const start = new Date(w.firstDate);
        for (let i = 0; i < 7; i++) {
          const d = new Date(start);
          d.setDate(d.getDate() + i);
          dates.push(d.toISOString().slice(0, 10));
        }
      });
    } else {
      dates.push("2026-01-01", "2026-01-02");
    }

    let csv = "channel,date,volume\n";
    channelNames.forEach((ch) => {
      dates.forEach((date) => {
        csv += `${ch},${date},0\n`;
      });
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "forecast_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summarize preview
  const summarizePreview = () => {
    if (!preview) return null;
    const channels = [...new Set(preview.map((r) => r.channel))];
    const dates = [...new Set(preview.map((r) => r.date))].sort();
    const totalVolume = preview.reduce((s, r) => s + r.volume, 0);
    return { channels, dates, totalVolume, rows: preview.length };
  };

  if (!capPlanId) return null;

  const summary = summarizePreview();

  return (
    <div className="box">
      <h3 className="title is-5 mb-3">Forecast Upload</h3>

      {message && (
        <div className={`notification is-${message.type} is-light`}>
          {message.text}
        </div>
      )}

      <div className="is-flex is-align-items-center mb-3">
        <div className="file is-small is-info mr-3">
          <label className="file-label">
            <input
              ref={fileRef}
              className="file-input"
              type="file"
              accept=".csv"
              onChange={handleFile}
            />
            <span className="file-cta">
              <span className="file-icon">
                <FaUpload />
              </span>
              <span className="file-label">Choose CSV</span>
            </span>
          </label>
        </div>

        <button
          className="button is-small is-light is-rounded mr-3"
          onClick={downloadTemplate}
        >
          <span className="icon is-small">
            <FaFileDownload />
          </span>
          <span>Template</span>
        </button>

        <button
          className="button is-small is-light is-rounded mr-3"
          onClick={loadExisting}
          disabled={loadingExisting}
        >
          {loadingExisting ? "Loading..." : `View Existing (${existingForecasts.length})`}
        </button>

        {existingForecasts.length > 0 && (
          <button
            className="button is-small is-danger is-light is-rounded"
            onClick={deleteAll}
          >
            <span className="icon is-small">
              <FaTrash />
            </span>
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Preview */}
      {summary && (
        <div className="mb-3">
          <div className="tags">
            <span className="tag is-info is-light">
              {summary.rows} rows
            </span>
            <span className="tag is-success is-light">
              {summary.channels.length} channel(s): {summary.channels.join(", ")}
            </span>
            <span className="tag is-warning is-light">
              {summary.dates.length} date(s): {summary.dates} → {summary.dates[summary.dates.length - 1]}
            </span>
            <span className="tag is-primary is-light">
              Total volume: {summary.totalVolume.toLocaleString()}
            </span>
          </div>

          {/* Preview Table — first 10 rows */}
          <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
            <table className="table is-narrow is-striped is-fullwidth is-size-7">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Date</th>
                  <th>Volume</th>
                  <th>Valid</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((row, i) => (
                  <tr key={i}>
                    <td>{row.channel}</td>
                    <td>{row.date}</td>
                    <td>{row.volume}</td>
                    <td>
                      {row.valid !== false ? (
                        <FaCheck className="has-text-success" />
                      ) : (
                        <span className="has-text-danger">⚠</span>
                      )}
                    </td>
                  </tr>
                ))}
                {preview.length > 20 && (
                  <tr>
                    <td colSpan={4} className="has-text-centered has-text-grey">
                      ...and {preview.length - 20} more rows
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <button
            className="button is-small is-success is-rounded mt-2"
            onClick={upload}
            disabled={uploading}
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

      {/* Existing Forecasts Summary */}
      {existingForecasts.length > 0 && !preview && (
        <div className="mt-3">
          <label className="label is-small">Stored Forecasts</label>
          <div className="table-container" style={{ maxHeight: "200px", overflowY: "auto" }}>
            <table className="table is-narrow is-striped is-fullwidth is-size-7">
              <thead>
                <tr>
                  <th>Channel</th>
                  <th>Date</th>
                  <th>Volume</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {existingForecasts.slice(0, 50).map((f, i) => (
                  <tr key={i}>
                    <td>{f.channel}</td>
                    <td>{f.date}</td>
                    <td>{f.volume}</td>
                    <td className="is-size-7 has-text-grey">
                      {f.updatedBy || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}