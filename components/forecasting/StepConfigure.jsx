import { MODEL_DEFS } from "./models";
import HelpTip, { HELP } from "./HelpTip";

const StepConfigure = ({ rawData, forecastDays, setForecastDays, confidence, setConfidence, activeModels, toggleActiveModel, onBack, onRun }) => {
  const dataLen = rawData.length;
  const maxRecommended = Math.floor(dataLen / 3);
  const maxSafe = Math.min(90, Math.floor(dataLen / 2));
  const isWarning = forecastDays > maxRecommended && forecastDays <= maxSafe;
  const isDanger = forecastDays > maxSafe;

  return (
    <div className="box">
      <h2 className="subtitle is-5">⚙️ Forecast Configuration</h2>

      <div className="columns">
        <div className="column is-4">
          <div className="field">
            <label className="label" style={{ fontSize: "0.82rem" }}>
              Forecast Horizon (days)
              <HelpTip text={HELP.horizon} />
            </label>
            <input
              className="input"
              type="number"
              value={forecastDays}
              onChange={(e) => setForecastDays(parseInt(e.target.value) || 1)}
              min={1}
              max={180}
            />
            <p className="help">
              Based on {dataLen} data points: recommended max <strong>{maxRecommended} days</strong>,
              hard limit <strong>{maxSafe} days</strong>
            </p>
          </div>
        </div>
        <div className="column is-4">
          <div className="field">
            <label className="label" style={{ fontSize: "0.82rem" }}>
              Confidence Interval
              <HelpTip text={HELP.confidence} />
            </label>
            <div className="select is-fullwidth">
              <select value={confidence} onChange={(e) => setConfidence(parseFloat(e.target.value))}>
                <option value={0.8}>80%</option>
                <option value={0.9}>90%</option>
                <option value={0.95}>95%</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {isWarning && (
        <div className="notification is-warning is-light" style={{ fontSize: "0.88rem" }}>
          ⚠️ <strong>Caution:</strong> You're forecasting <strong>{forecastDays} days</strong> with only{" "}
          <strong>{dataLen} data points</strong>. Best practice recommends no more than{" "}
          <strong>{maxRecommended} days</strong> (⅓ of your data).
          Results beyond this may be unreliable — confidence intervals will widen significantly.
        </div>
      )}

      {isDanger && (
        <div className="notification is-danger is-light" style={{ fontSize: "0.88rem" }}>
          🔴 <strong>Not recommended:</strong> Forecasting <strong>{forecastDays} days</strong> ahead with only{" "}
          <strong>{dataLen} data points</strong> will produce unreliable results.
          Maximum suggested: <strong>{maxSafe} days</strong> (½ of your data).
          <br />
          <button className="button is-small is-rounded is-danger is-outlined mt-2" onClick={() => setForecastDays(maxRecommended)}>
            Set to recommended ({maxRecommended} days)
          </button>
        </div>
      )}

      <div className="field">
        <label className="label" style={{ fontSize: "0.82rem" }}>Models to Run</label>
        <div className="buttons">
          {MODEL_DEFS.map((m) => (
            <span key={m.key} style={{ display: "inline-flex", alignItems: "center", gap: 2, marginBottom: 8 }}>
              <HelpTip text={HELP[m.key]} />
              <button
                className={`button is-small is-rounded ${activeModels.includes(m.key) ? "is-info" : ""}`}
                onClick={() => toggleActiveModel(m.key)}
              >
                {m.name}
              </button>
            </span>
          ))}
        </div>
      </div>

      <div className="buttons mt-4">
        <button className="button is-rounded" onClick={onBack}>← Back</button>
        <button className="button is-success is-rounded" onClick={onRun}>🚀 Run Forecast</button>
      </div>
    </div>
  );
};

export default StepConfigure;