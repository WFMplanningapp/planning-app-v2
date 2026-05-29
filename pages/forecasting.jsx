import Head from "next/head";
import { useState } from "react";
import { FaLock } from "react-icons/fa";
import { useAuth } from "../contexts/authContext";
import { formatDateMMDDYYYY, parseFlexibleDate } from "../components/forecasting/dateUtils";
import { MODEL_DEFS, MODEL_COLORS, MODEL_RUNNERS } from "../components/forecasting/models";
import { calcMetrics, getCI } from "../components/forecasting/metrics";
import { analyzeQuality, getQualityIssues, detectZeroDays } from "../components/forecasting/quality";
import Stepper from "../components/forecasting/Stepper";
import StepUpload from "../components/forecasting/StepUpload";
import StepQuality from "../components/forecasting/StepQuality";
import StepConfigure from "../components/forecasting/StepConfigure";
import StepResults from "../components/forecasting/StepResults";

const Forecasting = () => {
  const auth = useAuth();
  const [step, setStep] = useState(1);
  const [csvText, setCsvText] = useState("");
  const [rawData, setRawData] = useState([]);
  const [qualityReport, setQualityReport] = useState(null);
  const [qualityIssues, setQualityIssues] = useState([]);
  const [forecastDays, setForecastDays] = useState(14);
  const [confidence, setConfidence] = useState(0.9);
  const [activeModels, setActiveModels] = useState(MODEL_DEFS.map((m) => m.key));
  const [results, setResults] = useState([]);
  const [zeroDayInfo, setZeroDayInfo] = useState(null);
  const [forecastMeta, setForecastMeta] = useState({});
  const [isRunning, setIsRunning] = useState(false);

  // ── Load sample data ──
  const loadSampleData = () => {
    const base = 1000, lines = ["date,volume"], start = new Date(2025, 2, 1);
    for (let i = 0; i < 56; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const dow = d.getDay();
      const trend = i * 3.5;
      const seasonal = dow === 0 ? -200 : dow === 6 ? -150 : dow === 1 ? 100 : dow === 5 ? -50 : 50;
      const noise = (Math.random() - 0.5) * 180;
      const vol = Math.max(50, Math.round(base + trend + seasonal + noise));
      lines.push(`${formatDateMMDDYYYY(d)},${vol}`);
    }
    setCsvText(lines.join("\n"));
  };

  // ── Parse data ──
  const parseData = () => {
    if (!csvText.trim()) { alert("Please upload a CSV file first."); return; }
    const Papa = require("papaparse");
    const parsed = Papa.parse(csvText.trim(), { header: true, skipEmptyLines: true, dynamicTyping: false });

    let hMap = {};
    if (parsed.meta.fields) {
      parsed.meta.fields.forEach((f) => {
        const fl = f.trim().toLowerCase();
        if (["date", "fecha", "datum", "data", "jour", "day", "dia"].includes(fl)) hMap.date = f;
        if (["volume", "vol", "count", "calls", "contacts", "value", "cantidad", "qty", "quantity", "interactions", "chats", "emails", "tickets"].includes(fl)) hMap.volume = f;
      });
    }
    if (!hMap.date || !hMap.volume) {
      if (parsed.meta.fields && parsed.meta.fields.length >= 2) { hMap.date = parsed.meta.fields[0]; hMap.volume = parsed.meta.fields[1]; }
      else { alert("Could not identify date and volume columns."); return; }
    }

    // Auto-detect date format
    let detectedFormat = null;
    const sampleRows = parsed.data.slice(0, 10);
    let mmddCount = 0, ddmmCount = 0;
    sampleRows.forEach((row) => {
      const dateStr = String(row[hMap.date]).trim();
      const m = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (m) {
        const first = parseInt(m[1]), second = parseInt(m[2]);
        if (first > 12) ddmmCount++;
        else if (second > 12) mmddCount++;
      }
    });
    if (ddmmCount > 0 && mmddCount === 0) detectedFormat = "DD-MM-YYYY";
    else if (mmddCount > 0 && ddmmCount === 0) detectedFormat = "MM-DD-YYYY";

    const data = [], errors = [];
    parsed.data.forEach((row, idx) => {
      const dateStr = String(row[hMap.date]).trim();
      const vol = parseFloat(row[hMap.volume]);
      let d = null;
      if (detectedFormat === "DD-MM-YYYY") {
        const m = dateStr.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
        if (m) d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
      }
      if (!d) d = parseFlexibleDate(dateStr);
      if (!d) { errors.push(`Row ${idx + 2}: invalid date "${dateStr}"`); return; }
      if (isNaN(vol)) { errors.push(`Row ${idx + 2}: invalid volume`); return; }
      data.push({ date: d, volume: vol });
    });

    if (data.length < 7) {
      alert(`Only ${data.length} valid rows (minimum 7 required).${errors.length ? "\n\nFirst issues:\n" + errors.slice(0, 5).join("\n") : ""}`);
      return;
    }
    data.sort((a, b) => a.date - b.date);
    console.log(`📅 Date format detected: ${detectedFormat || "auto"} | ${data.length} valid rows | Range: ${formatDateMMDDYYYY(data[0].date)} → ${formatDateMMDDYYYY(data[data.length - 1].date)}`);

    setRawData(data);
    const qr = analyzeQuality(data);
    setQualityReport(qr);
    setQualityIssues(getQualityIssues(qr));
    setStep(2);
  };

  // ── Toggle active model ──
  const toggleActiveModel = (key) => {
    setActiveModels((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  // ── Run forecast ──
  const runForecast = () => {
    if (!activeModels.length) { alert("Select at least one model."); return; }
    setIsRunning(true);
    setTimeout(() => {
      try {
        const vols = rawData.map((r) => r.volume);
        const n = vols.length;
        const holdout = Math.max(3, Math.min(Math.floor(n * 0.2), 14));
        const trainVols = vols.slice(0, n - holdout);
        const testVols = vols.slice(n - holdout);
        const horizon = forecastDays;

        let modelResults = [];
        activeModels.forEach((key) => {
          const def = MODEL_DEFS.find((m) => m.key === key);
          if (!def || !MODEL_RUNNERS[key]) return;
          const res = MODEL_RUNNERS[key](trainVols, testVols, vols, n, holdout, horizon);
          const metrics = calcMetrics(testVols, res.testPred);
          const ciFunc = getCI(metrics.residuals, confidence);
          const ciArr = res.futurePred.map((v, i) => { const w = ciFunc(i + 1); return { lo: v - w, hi: v + w }; });
          modelResults.push({ key, name: def.name, desc: def.desc, color: MODEL_COLORS[key], testPred: res.testPred, futurePred: res.futurePred, params: res.params || {}, metrics, ci: ciArr });
        });

        const zdi = detectZeroDays(rawData);
        if (zdi.zeroDows.size > 0) {
          const lastDate = rawData[rawData.length - 1].date;
          modelResults.forEach((r) => {
            for (let i = 0; i < r.futurePred.length; i++) {
              const fd = new Date(lastDate); fd.setDate(fd.getDate() + i + 1);
              if (zdi.zeroDows.has(fd.getDay())) { r.futurePred[i] = 0; r.ci[i] = { lo: 0, hi: 0 }; }
            }
          });
        }

        modelResults.sort((a, b) => a.metrics.rmse - b.metrics.rmse);
        if (modelResults.length) modelResults[0].recommended = true;

        setResults(modelResults);
        setZeroDayInfo(zdi);
        setForecastMeta({ horizon, holdout, conf: confidence, trainN: trainVols.length });
        setIsRunning(false);
        setStep(4);
      } catch (err) {
        console.error("Forecast error:", err);
        setIsRunning(false);
        alert("Error running forecast: " + err.message);
      }
    }, 100);
  };

  return (
    <>
      <Head>
        <title>Planning App | Forecasting</title>
      </Head>
      <div>
        <h1 className="has-text-centered mb-2 is-size-5">FORECASTING STUDIO</h1>
        <div className="column">
          <Stepper step={step} />

          {step === 1 && (
            <StepUpload
              csvText={csvText}
              setCsvText={setCsvText}
              onParse={parseData}
              onLoadSample={loadSampleData}
            />
          )}

          {step === 2 && qualityReport && (
            <StepQuality
              rawData={rawData}
              qualityReport={qualityReport}
              qualityIssues={qualityIssues}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 3 && (
            <StepConfigure
              rawData={rawData}
              forecastDays={forecastDays}
              setForecastDays={setForecastDays}
              confidence={confidence}
              setConfidence={setConfidence}
              activeModels={activeModels}
              toggleActiveModel={toggleActiveModel}
              onBack={() => setStep(2)}
              onRun={runForecast}
            />
          )}

          {step === 4 && results.length > 0 && (
            <StepResults
              rawData={rawData}
              results={results}
              zeroDayInfo={zeroDayInfo}
              forecastMeta={forecastMeta}
              onReconfigure={() => setStep(3)}
              onNewData={() => setStep(1)}
            />
          )}

          {isRunning && (
            <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(255,255,255,0.9)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
              <div style={{ width: 48, height: 48, border: "4px solid #dbdbdb", borderTopColor: "rgb(74,74,249)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ color: "rgb(74,74,249)", fontWeight: 600 }}>Running forecast models…</div>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Forecasting;