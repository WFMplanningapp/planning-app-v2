import { useState } from "react";
import { formatDateMMDDYYYY } from "./dateUtils";

const ExportModal = ({ results, forecastMeta, rawData, onClose }) => {
  const [exportSelection, setExportSelection] = useState("all");

  const handleExport = () => {
    const lastDate = rawData[rawData.length - 1].date;
    const modelsToExport = exportSelection === "all"
      ? results
      : results.filter((r) => r.key === exportSelection);

    if (!modelsToExport.length) return;

    let csv = "Date," + modelsToExport.map((r) => `${r.name},${r.name} CI Low,${r.name} CI High`).join(",") + "\n";

    for (let i = 0; i < forecastMeta.horizon; i++) {
      const d = new Date(lastDate);
      d.setDate(d.getDate() + i + 1);
      let row = formatDateMMDDYYYY(d);
      modelsToExport.forEach((r) => {
        row += `,${Math.round(r.futurePred[i])},${Math.round(r.ci[i].lo)},${Math.round(r.ci[i].hi)}`;
      });
      csv += row + "\n";
    }

    const modelLabel = exportSelection === "all"
      ? "all_models"
      : modelsToExport[0].name.replace(/[\s()\/]/g, "_");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forecast_${modelLabel}_${formatDateMMDDYYYY(new Date())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(9,9,45,0.5)", zIndex: 999,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="box"
        style={{ width: "100%", maxWidth: 480, margin: "0 16px", animation: "fadeIn 0.25s ease" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="subtitle is-5 mb-4">📥 Export Forecast</h2>
        <p className="has-text-grey mb-4" style={{ fontSize: "0.9rem" }}>
          Choose which model forecast to export. The CSV will include predicted values
          and confidence intervals for each day in the forecast horizon.
        </p>

        <div className="field">
          <label className="label" style={{ fontSize: "0.82rem" }}>Select Model</label>
          <div className="select is-fullwidth">
            <select value={exportSelection} onChange={(e) => setExportSelection(e.target.value)}>
              <option value="all">📊 All Models</option>
              {results.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.recommended ? "🏆 " : ""}{r.name}
                  {r.recommended ? " (Recommended)" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="notification is-light" style={{ fontSize: "0.82rem", padding: "12px 16px", marginTop: 12 }}>
          <strong>Export summary:</strong>
          <br />
          • Models: {exportSelection === "all" ? `All (${results.length})` : results.find((r) => r.key === exportSelection)?.name}
          <br />
          • Forecast days: {forecastMeta.horizon}
          <br />
          • Columns: Date, Forecast, CI Low, CI High
          {exportSelection === "all" && <span> (× {results.length} models)</span>}
        </div>

        <div className="buttons mt-4" style={{ justifyContent: "flex-end" }}>
          <button className="button is-rounded" onClick={onClose}>Cancel</button>
          <button className="button is-primary is-rounded" onClick={handleExport}>📥 Download CSV</button>
        </div>
      </div>
    </div>
  );
};

export default ExportModal;