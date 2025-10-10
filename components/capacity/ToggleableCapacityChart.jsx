import React, { useState } from "react";
import TotalPercentageChart from "./TotalPercentageChart"; // adjust import path as needed

// Step 1: Define available lines and bars
const availableLines = [
  { key: 'productiveRequirement', label: 'Productive Requirement' },
  { key: 'compositeProductiveFTE', label: 'Productive FTE (Actual/Predictive)' },
  { key: 'inCenterRequirement', label: 'InCenter Requirement' },
  { key: 'compositeInCenterFTE', label: 'InCenter FTE (Actual/Predictive)' },
  { key: 'grossRequirement', label: 'Gross FTE Req.' },
  { key: 'totalFTE', label: 'Total FTE' },
];
const availableBars = [
  { key: 'attrPercent', label: 'Attrition %' },
  { key: 'fcAttrition', label: 'FC Attrition' },
];

// Step 2: Your new toggleable chart component
const ToggleableCapacityChart = ({ data }) => {
  const [visibleLines, setVisibleLines] = useState(availableLines.map(l => l.key));
  const [visibleBars, setVisibleBars] = useState(availableBars.map(b => b.key));

  const toggleLine = (key) =>
    setVisibleLines(current =>
      current.includes(key) ? current.filter(x => x !== key) : [...current, key]
    );
  const toggleBar = (key) =>
    setVisibleBars(current =>
      current.includes(key) ? current.filter(x => x !== key) : [...current, key]
    );

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '1em',
          flexWrap: 'wrap',
          marginBottom: 16,
          alignItems: "center"
        }}
      >
        <span><strong>Toggle Comparisons:</strong></span>
        {availableLines.map(({ key, label }) => (
          <label key={key} style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={visibleLines.includes(key)}
              onChange={() => toggleLine(key)}
              style={{ verticalAlign: "middle" }}
            />{" "}
            {label}
          </label>
        ))}
        {availableBars.map(({ key, label }) => (
          <label key={key} style={{ marginRight: 10 }}>
            <input
              type="checkbox"
              checked={visibleBars.includes(key)}
              onChange={() => toggleBar(key)}
              style={{ verticalAlign: "middle" }}
            />{" "}
            {label}
          </label>
        ))}
      </div>
      <TotalPercentageChart
        data={data}
        lines={visibleLines}
        bars={visibleBars}
      />
    </>
  );
};

export default ToggleableCapacityChart;