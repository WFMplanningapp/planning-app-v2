import { useRef, useCallback } from "react";
import HelpTip from "./HelpTip";

const StepUpload = ({ csvText, setCsvText, onParse, onLoadSample }) => {
  const fileInputRef = useRef(null);

  const handleFile = useCallback((input) => {
    const file = input instanceof File ? input : input?.target?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCsvText(e.target.result);
    reader.readAsText(file);
  }, [setCsvText]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  return (
    <div className="box">
      <h2 className="subtitle is-5">📂 Upload Your Data</h2>
      <p className="has-text-grey mb-4" style={{ fontSize: "0.9rem" }}>
        Upload a CSV file with two columns: <code>date</code> and <code>volume</code>.
        Most date formats are supported automatically (MM-DD-YYYY, YYYY-MM-DD, DD/MM/YYYY, etc.).
        Each row represents one day. The more data you provide, the more accurate the forecast.
        <HelpTip text="Ideal dataset: 4-12 weeks of daily data with no gaps. The tool will analyze your data quality and warn you about any issues before forecasting." />
      </p>

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          border: "2px dashed rgb(74,74,249)",
          borderRadius: 12,
          padding: "48px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: "rgba(74,74,249,0.03)",
          marginBottom: 16,
        }}
      >
        <span style={{ fontSize: "2.5rem", display: "block", marginBottom: 8 }}>⬆️</span>
        <strong>Drag & drop your CSV here</strong>
        <p className="has-text-grey" style={{ fontSize: "0.85rem", marginTop: 6 }}>
          or click to browse files
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.txt"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>

      {csvText && (
        <div className="notification is-success is-light" style={{ fontSize: "0.88rem" }}>
          ✅ File loaded successfully — <strong>{csvText.split("\n").filter((l) => l.trim()).length - 1}</strong> data rows detected.
        </div>
      )}

      <div className="buttons mt-4">
        <button className="button is-primary is-rounded" onClick={onParse} disabled={!csvText.trim()}>
          📊 Parse & Analyze Data
        </button>
        <button className="button is-info is-rounded is-outlined" onClick={onLoadSample}>
          Load Sample Data
        </button>
      </div>
    </div>
  );
};

export default StepUpload;