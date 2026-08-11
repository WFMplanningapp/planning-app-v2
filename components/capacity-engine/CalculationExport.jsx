// ============================================
// CALCULATION EXPORT
// Export interval-level results to CSV
// ============================================

import { FaFileDownload } from "react-icons/fa";
import { flattenForExport } from "../../lib/engine/capacityEngineV4";

export default function CalculationExport({
  channelsConfig,
  channelResults,
  weekCode,
  capPlanName,
}) {
  const exportCSV = () => {
    if (!channelsConfig || !channelResults) return;

    const rows = flattenForExport(channelsConfig, channelResults);

    if (rows.length === 0) {
      alert("No data to export");
      return;
    }

    // Build CSV
    const headers = Object.keys(rows[0]);
    let csv = headers.join(",") + "\n";
    rows.forEach((row) => {
      csv +=
        headers
          .map((h) => {
            const val = row[h];
            if (typeof val === "string" && val.includes(",")) {
              return `"${val}"`;
            }
            return val ?? "";
          })
          .join(",") + "\n";
    });

    // Download
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `capacity_${(capPlanName || "export").replace(/\s+/g, "_")}_${weekCode || "all"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const rowCount =
    channelResults && channelsConfig
      ? Object.entries(channelResults).reduce(
          (total, [, dailyResults]) =>
            total +
            dailyResults.reduce(
              (s, day) => s + (day.intervals?.length || 0),
              0
            ),
          0
        )
      : 0;

  return (
    <button
      className="button is-small is-rounded is-link is-light"
      onClick={exportCSV}
      disabled={rowCount === 0}
    >
      <span className="icon is-small">
        <FaFileDownload />
      </span>
      <span>Export CSV ({rowCount} rows)</span>
    </button>
  );
}