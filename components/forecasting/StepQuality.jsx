import { useEffect, useRef, useState } from "react";
import { formatDateMMDDYYYY } from "./dateUtils";
import HelpTip, { HELP } from "./HelpTip";

const issueColor = { error: "#ff3860", warning: "#ffdd57", info: "#bfa1ff", good: "rgb(139,240,187)" };

const StepQuality = ({ rawData, qualityReport, qualityIssues, onBack, onNext }) => {
  const previewCanvasRef = useRef(null);
  const previewChartRef = useRef(null);
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
    if (!Chart || !previewCanvasRef.current || !rawData.length) return;
    if (previewChartRef.current) previewChartRef.current.destroy();
    previewChartRef.current = new Chart(previewCanvasRef.current.getContext("2d"), {
      type: "line",
      data: {
        labels: rawData.map((r) => r.date),
        datasets: [{
          label: "Actual Volume", data: rawData.map((r) => r.volume),
          borderColor: "#4b4bf9", backgroundColor: "rgba(75,75,249,0.08)",
          fill: true, tension: 0.3, pointRadius: rawData.length > 60 ? 1 : 3, borderWidth: 2,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#333" } } },
        scales: {
          x: { type: "time", time: { unit: rawData.length > 60 ? "week" : "day" }, grid: { color: "rgba(75,75,249,0.08)" }, ticks: { color: "#666", maxTicksLimit: 12, callback: (v) => formatDateMMDDYYYY(new Date(v)) } },
          y: { grid: { color: "rgba(0,0,0,0.06)" }, ticks: { color: "#666" } },
        },
      },
    });
    return () => { if (previewChartRef.current) previewChartRef.current.destroy(); };
  }, [Chart, rawData]);

  const qualityBadge = (q) => {
    if (!q) return null;
    const cls = q.quality === "High" ? "is-success" : q.quality === "Medium" ? "is-warning" : "is-danger";
    const emoji = q.quality === "High" ? "✅" : q.quality === "Medium" ? "⚠️" : "🔴";
    return <span className={`tag is-medium ${cls}`}>{emoji} Data Quality: {q.quality} ({q.score}/100)</span>;
  };

  const stats = [
    { label: "Data Points", value: qualityReport.n, help: null },
    { label: "Time Span", value: `${qualityReport.weeks}w`, help: null },
    { label: "Mean Volume", value: qualityReport.mean.toFixed(0), help: null },
    { label: "Std Deviation", value: qualityReport.std.toFixed(0), help: null },
    { label: "CV", value: `${qualityReport.cv.toFixed(1)}%`, help: HELP.cv },
    { label: "Missing Days", value: qualityReport.missingDays, help: null },
    { label: "Outliers", value: qualityReport.outliers, help: HELP.outliers },
    { label: "Stability", value: qualityReport.rollingStability, help: HELP.stability },
  ];

  return (
    <>
      <div className="box">
        <h2 className="subtitle is-5">🔍 Data Quality Assessment</h2>
        <div className="mb-4">
          {qualityBadge(qualityReport)}
          <HelpTip text={HELP.dataQuality} />
        </div>

        <div className="columns is-multiline">
          {stats.map((s, i) => (
            <div key={i} className="column is-3-desktop is-6-tablet">
              <div className="notification has-text-centered" style={{ padding: "12px", background: "#f5f5ff" }}>
                <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "rgb(74,74,249)" }}>{s.value}</div>
                <div className="has-text-grey" style={{ fontSize: "0.75rem" }}>
                  {s.label}
                  {s.help && <HelpTip text={s.help} />}
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="has-text-grey" style={{ fontSize: "0.9rem" }}>
          {qualityReport.trendSlope > 1 ? "📈 Upward trend" : qualityReport.trendSlope < -1 ? "📉 Downward trend" : "➡️ Flat / no clear trend"}
          &nbsp;&nbsp;|&nbsp;&nbsp;
          {qualityReport.hasWeeklyPattern ? "🔄 Weekly seasonality detected" : "🔲 No clear weekly seasonality"}
        </p>
      </div>

      <div className="box">
        <h2 className="subtitle is-5">⚠️ Issues & Suggestions</h2>
        {qualityIssues.map((issue, i) => (
          <div key={i} style={{ padding: "10px 14px", borderLeft: `3px solid ${issueColor[issue.t]}`, background: `${issueColor[issue.t]}08`, borderRadius: "0 6px 6px 0", marginBottom: 6, fontSize: "0.88rem" }}>
            {issue.m}
          </div>
        ))}
      </div>

      <div className="box">
        <h2 className="subtitle is-5">📉 Input Data Preview</h2>
        <div style={{ position: "relative", width: "100%", height: 380 }}>
          <canvas ref={previewCanvasRef} />
        </div>
      </div>

      <div className="buttons">
        <button className="button is-rounded" onClick={onBack}>← Back</button>
        <button className="button is-primary is-rounded" onClick={onNext}>⚙️ Configure Forecast →</button>
      </div>
    </>
  );
};

export default StepQuality;