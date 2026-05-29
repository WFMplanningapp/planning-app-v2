import { useState, useRef } from "react";
import { createPortal } from "react-dom";

export const HELP = {
  mae: "MAE (Mean Absolute Error) — The average size of forecast errors in the same units as your data. Lower = better. Example: MAE of 50 means forecasts are off by ~50 units on average.",
  rmse: "RMSE (Root Mean Squared Error) — Similar to MAE but penalizes large errors more heavily. If RMSE is much higher than MAE, you have occasional big misses.",
  mape: "MAPE (Mean Absolute % Error) — Average error as a percentage of actual values. Great for comparing across different scales. Under 10% = excellent, 10-20% = good, 20-35% = fair.",
  wmape: "WMAPE (Weighted MAPE) — Like MAPE but gives more weight to higher-volume days. More reliable when volumes vary significantly day to day.",
  dirAcc: "Directional Accuracy — How often the model correctly predicted whether volume would go up or down vs the previous day. Above 60% is good.",
  confidence: "Confidence Interval — The range where actual values are likely to fall. 80% = narrower but less certain, 95% = wider but more reliable. 90% is a balanced default for planning.",
  horizon: "Forecast Horizon — How many days ahead to predict. Rule of thumb: don't forecast more than ⅓ of your data length for reliable results.",
  naive: "Simply repeats the last known value. A baseline to beat — if other models can't beat Naive, your data may be too random to forecast.",
  ma: "Averages the last 7 days. Smooths out noise but reacts slowly to sudden changes. Good for stable, low-variability data.",
  wma: "Like Moving Average but gives more importance to recent days. Reacts faster to trends than simple MA.",
  ema: "Applies exponentially decreasing weights to older data. The alpha parameter controls how fast old data is 'forgotten'. Very popular in operations.",
  holt: "Extends exponential smoothing by adding a trend component. Good when volume is consistently growing or declining.",
  hw: "The most sophisticated model here — captures both trend AND weekly seasonal patterns. Best when you have at least 2-3 weeks of data with clear day-of-week patterns.",
  lr: "Fits a straight line through your data. Simple but effective when there's a clear linear trend with no seasonality.",
  drift: "Draws a line from your first data point to the last and extends it. Similar to linear regression but even simpler.",
  dataQuality: "Data quality score reflects completeness, consistency, and forecastability of your data. Higher scores mean more reliable forecasts.",
  cv: "CV (Coefficient of Variation) — Standard deviation as a percentage of the mean. Higher CV = more volatile data = harder to forecast accurately.",
  outliers: "Outliers are values that are unusually far from the norm (beyond 1.5× the interquartile range). A few outliers are normal; many suggest data quality issues.",
  stability: "Rolling stability measures how much the weekly average changes over time. Stable = consistent patterns, Volatile = erratic changes.",
  ciLow: "CI Low — The lower bound of the confidence interval. Actual values are unlikely to fall below this.",
  ciHigh: "CI High — The upper bound of the confidence interval. Actual values are unlikely to exceed this.",
};

const HelpTip = ({ text }) => {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, goDown: false });
  const iconRef = useRef(null);

  const handleEnter = () => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const spaceAbove = rect.top;
      const goDown = spaceAbove < 140;
      setPos({
        top: goDown ? rect.bottom + 8 : rect.top - 8,
        left: rect.left + rect.width / 2,
        goDown,
      });
    }
    setShow(true);
  };

  return (
    <>
      <span
        ref={iconRef}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 18,
          height: 18,
          borderRadius: "50%",
          background: "rgba(74,74,249,0.1)",
          color: "rgb(74,74,249)",
          fontSize: "0.65rem",
          fontWeight: 700,
          border: "1px solid rgba(74,74,249,0.3)",
          verticalAlign: "middle",
          marginLeft: 6,
          cursor: "help",
        }}
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        onClick={() => (show ? setShow(false) : handleEnter())}
      >
        ?
      </span>
      {show &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: pos.goDown ? pos.top : "auto",
              bottom: pos.goDown ? "auto" : `${window.innerHeight - pos.top}px`,
              left: pos.left,
              transform: "translateX(-50%)",
              background: "#09092d",
              color: "#ffffff",
              padding: "12px 16px",
              borderRadius: 10,
              fontSize: "0.78rem",
              lineHeight: 1.5,
              width: 280,
              maxWidth: "90vw",
              boxShadow: "0 8px 24px rgba(9,9,45,0.35)",
              zIndex: 99999,
              whiteSpace: "normal",
              textAlign: "left",
              fontWeight: 400,
              pointerEvents: "none",
            }}
          >
            {text}
            <span
              style={{
                position: "absolute",
                left: "50%",
                transform: "translateX(-50%)",
                ...(pos.goDown
                  ? { bottom: "100%", border: "6px solid transparent", borderBottomColor: "#09092d" }
                  : { top: "100%", border: "6px solid transparent", borderTopColor: "#09092d" }
                ),
              }}
            />
          </div>,
          document.body
        )}
    </>
  );
};

export default HelpTip;