import { useState, useRef, useEffect } from "react";
import { formatDateMMDDYYYY } from "./dateUtils";
import HelpTip, { HELP } from "./HelpTip";
import ExportModal from "./ExportModal";

const StepResults = ({ rawData, results, zeroDayInfo, forecastMeta, onReconfigure, onNewData }) => {
  const [visibleModels, setVisibleModels] = useState(new Set(results.map((r) => r.key)));
  const [activeDataTab, setActiveDataTab] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const forecastCanvasRef = useRef(null);
  const forecastChartRef = useRef(null);
  const [Chart, setChart] = useState(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const loadChart = async () => {
        const chartModule = await import("chart.js");
        const { Chart: ChartJS, CategoryScale, LinearScale, TimeScale, PointElement, LineElement, LineController, Filler, Legend, Tooltip } = chartModule;
        ChartJS.register(CategoryScale, LinearScale, TimeScale, PointElement, LineElement, LineController, Filler, Legend, Tooltip);
        try { await import("chartjs-adapter-date-fns"); } catch (e) { console.warn("chartjs-adapter-date-fns not available"); }
        setChart(() => ChartJS);
      };
      loadChart();
    }
  }, []);

  useEffect(() => {
    if (!Chart || !forecastCanvasRef.current || !results.length) return;
    if (forecastChartRef.current) forecastChartRef.current.destroy();

    const lastDate = rawData[rawData.length - 1].date;
    const n = rawData.length;
    const futureDates = [];
    for (let i = 1; i <= forecastMeta.horizon; i++) {
      const d = new Date(lastDate); d.setDate(d.getDate() + i); futureDates.push(d);
    }
    const allDates = rawData.map((r) => r.date).concat(futureDates);

    const datasets = [{
      label: "Actual", data: rawData.map((r) => r.volume).concat(Array(futureDates.length).fill(null)),
      borderColor: "#4b4bf9", fill: false, tension: 0.3, pointRadius: n > 60 ? 0 : 2, borderWidth: 2.5, order: 0,
    }];

    results.forEach((r) => {
      const hidden = !visibleModels.has(r.key);
      const data = Array(n).fill(null); data[n - 1] = rawData[n - 1].volume;
      r.futurePred.forEach((v) => data.push(v));
      datasets.push({ label: r.name, data, borderColor: r.color, borderWidth: 2, borderDash: [6, 3], tension: 0.3, pointRadius: 0, fill: false, order: 1, hidden });
      const ciHi = Array(n).fill(null), ciLo = Array(n).fill(null);
      r.ci.forEach((c) => { ciHi.push(c.hi); ciLo.push(c.lo); });
      datasets.push({ label: `${r.name} CI`, data: ciHi, borderColor: "transparent", backgroundColor: r.color + "15", fill: "+1", pointRadius: 0, order: 2, hidden });
      datasets.push({ label: `${r.name} CI Low`, data: ciLo, borderColor: "transparent", backgroundColor: "transparent", fill: false, pointRadius: 0, order: 2, hidden });
    });

    forecastChartRef.current = new Chart(forecastCanvasRef.current.getContext("2d"), {
      type: "line", data: { labels: allDates, datasets },
      options: {
        responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { labels: { color: "#333", filter: (item) => !item.text.includes("CI") } },
          tooltip: { filter: (item) => !item.dataset.label?.includes("CI"), callbacks: { title: (ctx) => ctx.length && ctx[0].parsed.x ? formatDateMMDDYYYY(new Date(ctx[0].parsed.x)) : "", label: (ctx) => `${ctx.dataset.label}: ${ctx.raw !== null ? Math.round(ctx.raw).toLocaleString() : "-"}` } },
        },
        scales: {
          x: { type: "time", time: { unit: allDates.length > 80 ? "week" : "day" }, grid: { color: "rgba(0,0,0,0.04)" }, ticks: { color: "#666", maxTicksLimit: 14, callback: (v) => formatDateMMDDYYYY(new Date(v)) } },
          y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { color: "#666" } },
        },
      },
    });

    return () => { if (forecastChartRef.current) forecastChartRef.current.destroy(); };
  }, [Chart, results, visibleModels, rawData, forecastMeta]);

  const toggleModelVisibility = (key) => {
    setVisibleModels((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const getVerdict = (wmape) => wmape < 10 ? "🟢 Excellent" : wmape < 20 ? "🟡 Good" : wmape < 35 ? "🟠 Fair" : "🔴 Poor";

  return (
    <>
      {/* Zero-day info */}
      {zeroDayInfo && (zeroDayInfo.structural.length > 0 || zeroDayInfo.warnings.length > 0) && (
        <div className="box">
          <h2 className="subtitle is-5">🗓️ Day-of-Week Zero Detection</h2>
          {zeroDayInfo.structural.length > 0 && (
            <div style={{ padding: "10px 14px", borderLeft: "3px solid rgb(139,240,187)", background: "rgba(139,240,187,0.08)", borderRadius: "0 6px 6px 0", marginBottom: 6, fontSize: "0.88rem" }}>
              ✅ <strong>Structural zero-days:</strong> {zeroDayInfo.structural.join(", ")}. Forecasts adjusted to 0.
            </div>
          )}
          {zeroDayInfo.warnings.map((w, i) => (
            <div key={i} style={{ padding: "10px 14px", borderLeft: "3px solid #ffdd57", background: "rgba(255,221,87,0.08)", borderRadius: "0 6px 6px 0", marginBottom: 6, fontSize: "0.88rem" }}>
              ⚠️ {w}
            </div>
          ))}
        </div>
      )}

      {/* Model comparison table */}
      <div className="box">
        <h2 className="subtitle is-5">🏆 Model Comparison</h2>
        <div className="table-container">
          <table className="table is-fullwidth is-hoverable is-striped" style={{ fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Model</th>
                <th>MAE <HelpTip text={HELP.mae} /></th>
                <th>RMSE <HelpTip text={HELP.rmse} /></th>
                <th>MAPE (%) <HelpTip text={HELP.mape} /></th>
                <th>WMAPE (%) <HelpTip text={HELP.wmape} /></th>
                <th>Dir. Acc. <HelpTip text={HELP.dirAcc} /></th>
                <th>Verdict</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.key}>
                  <td style={{ color: r.color, fontWeight: 600 }}>
                    {r.name}
                    {r.recommended && <span className="tag is-success is-light ml-2" style={{ fontSize: "0.7rem" }}>★ BEST</span>}
                  </td>
                  <td>{r.metrics.mae.toFixed(1)}</td>
                  <td>{r.metrics.rmse.toFixed(1)}</td>
                  <td>{r.metrics.mape.toFixed(1)}%</td>
                  <td>{r.metrics.wmape.toFixed(1)}%</td>
                  <td>{r.metrics.dirAcc.toFixed(0)}%</td>
                  <td>{getVerdict(r.metrics.wmape)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Forecast Chart */}
      <div className="box">
        <h2 className="subtitle is-5">📊 Forecast Visualization</h2>
        <div className="buttons mb-3">
          {results.map((r) => (
            <button
              key={r.key}
              className={`button is-small is-rounded ${visibleModels.has(r.key) ? "" : "is-outlined"}`}
              style={{ borderColor: r.color, color: visibleModels.has(r.key) ? "#fff" : r.color, background: visibleModels.has(r.key) ? r.color : "transparent" }}
              onClick={() => toggleModelVisibility(r.key)}
            >
              {r.name}
            </button>
          ))}
        </div>
        <div style={{ position: "relative", width: "100%", height: 450 }}>
          <canvas ref={forecastCanvasRef} />
        </div>
      </div>

      {/* Model Detail Cards */}
      <div className="box">
        <h2 className="subtitle is-5">🔬 Model Details</h2>
        <div className="columns is-multiline">
          {results.map((r) => (
            <div key={r.key} className="column is-4-desktop is-6-tablet">
              <div className="notification" style={{ border: r.recommended ? "2px solid rgb(139,240,187)" : "1px solid #dbdbdb", background: "#fafafe", padding: 16 }}>
                <h3 style={{ color: r.color, fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>
                  {r.recommended && "🏆 "}{r.name}
                </h3>
                <p className="has-text-grey" style={{ fontSize: "0.78rem", marginBottom: 10 }}>{r.desc}</p>
                {[
                  ["MAE", r.metrics.mae.toFixed(1)],
                  ["RMSE", r.metrics.rmse.toFixed(1)],
                  ["MAPE", `${r.metrics.mape.toFixed(1)}%`],
                  ["WMAPE", `${r.metrics.wmape.toFixed(1)}%`],
                  ["Dir. Accuracy", `${r.metrics.dirAcc.toFixed(0)}%`],
                  ...Object.entries(r.params),
                ].map(([k, v], i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}>
                    <span className="has-text-grey">{k}</span>
                    <span style={{ fontWeight: 700, color: "rgb(74,74,249)" }}>{v}</span>
                  </div>
                ))}
                {r.recommended && (
                  <div className="has-text-centered mt-2">
                    <span className="tag is-success" style={{ fontSize: "0.75rem" }}>★ Recommended</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Forecast Data Tabs */}
      <div className="box">
        <h2 className="subtitle is-5">📋 Forecast Data</h2>
        <div className="tabs is-small">
          <ul>
            {results.map((r, i) => (
              <li key={r.key} className={activeDataTab === i ? "is-active" : ""}>
                <a onClick={() => setActiveDataTab(i)}>{r.name}</a>
              </li>
            ))}
          </ul>
        </div>
        {results[activeDataTab] && (
          <div className="table-container">
            <table className="table is-fullwidth is-hoverable" style={{ fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Forecast</th>
                  <th>CI Low <HelpTip text={HELP.ciLow} /></th>
                  <th>CI High <HelpTip text={HELP.ciHigh} /></th>
                </tr>
              </thead>
              <tbody>
                {results[activeDataTab].futurePred.map((v, j) => {
                  const d = new Date(rawData[rawData.length - 1].date);
                  d.setDate(d.getDate() + j + 1);
                  return (
                    <tr key={j}>
                      <td>{formatDateMMDDYYYY(d)}</td>
                      <td style={{ fontWeight: 700, color: results[activeDataTab].color }}>{Math.round(v)}</td>
                      <td>{Math.round(results[activeDataTab].ci[j].lo)}</td>
                      <td>{Math.round(results[activeDataTab].ci[j].hi)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="buttons mt-4">
          <button className="button is-primary is-rounded" onClick={() => setShowExportModal(true)}>📥 Export Forecast</button>
          <button className="button is-rounded" onClick={onReconfigure}>⚙️ Reconfigure</button>
          <button className="button is-rounded" onClick={onNewData}>🔄 New Data</button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <ExportModal
          results={results}
          forecastMeta={forecastMeta}
          rawData={rawData}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </>
  );
};

export default StepResults;