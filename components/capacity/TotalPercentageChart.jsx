import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

// ONE: Define your exact color and line style for each important field
const fieldStyles = {
  // Gross FTE & Total FTE (blue)
  grossRequirement:  { color: "#247ba0", dash: "solid", name: "Gross FTE Req." },
  totalFTE:          { color: "#247ba0", dash: "3 3", name: "Planned Gross FTE" },

  // InCenter & Expected (orange)
  inCenterRequirement: { color: "#e67e22", dash: "solid", name: "InCenter Requirement" },
  expectedFTE:         { color: "#e67e22", dash: "2 5", name: "Planned InCenter FTE " },

  // Productive & Planned Productive (purple)
  productiveRequirement: { color: "#8e44ad", dash: "solid", name: "Productive Requirement" },
  PlanProdFTE:           { color: "#8e44ad", dash: "5 4", name: "Planned Productive FTE" },

  attrPercent:   { color: "#e7298a", name: "Attrition %" },
  fcAttrition:   { color: "#a6761d", name: "FC Attrition" },
};

const yAxisLabels = {
  left: "FTE / Requirement",
  right: "%",
};

const TotalPercentageChart = ({
  data,
  lines = [
    'productiveRequirement',
    'inCenterRequirement',
    'grossRequirement',
    'totalHC',
    'expectedFTE',
  ],
  bars = ['attrPercent', 'fcAttrition']
}) => (
  <ResponsiveContainer width="99%" height={420}>
    <ComposedChart
      data={data}
      margin={{
        top: 30,
        right: 10,
        left: 0,
        bottom: 60,
      }}
    >
      <Legend
        verticalAlign="top"
        wrapperStyle={{ top: 0, fontSize: 13 }}
        height={32}
        iconType="line"
      />
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis
        dataKey="firstDate"
        interval={0}
        angle={-60}
        dx={-6}
        textAnchor="end"
        fontSize={12}
        minTickGap={5}
      />
      <YAxis
        yAxisId="left"
        orientation="left"
        type="number"
        fontSize={12}
        width={44}
        label={{ value: yAxisLabels.left, angle: -90, position: 'insideLeft', fontSize: 12 }}
        tickCount={8}
        allowDecimals
      />
      <YAxis
        yAxisId="right"
        orientation="right"
        type="number"
        fontSize={12}
        width={44}
        label={{ value: yAxisLabels.right, angle: 90, position: 'insideRight', fontSize: 12 }}
        tickCount={8}
        allowDecimals
      />
      <Tooltip
        formatter={(value, name) =>
          typeof value === "number"
            ? [value.toFixed(2), fieldStyles[name]?.name || name]
            : [value, fieldStyles[name]?.name || name]
        }
      />

      {/* BARS (Background, for attrition etc) */}
      {bars &&
        bars.map((bar, index) => (
          <Bar
            key={`bar-${bar}`}
            dataKey={bar}
            yAxisId="right"
            fill={fieldStyles[bar]?.color || "#bbb"}
            opacity={0.18 + 0.14 * index}
            name={fieldStyles[bar]?.name || bar}
            barSize={16}
          />
        ))}

      {/* LINES (Requirements, FTE etc) */}
      {lines &&
        lines.map((line, index) => (
          <Line
            key={`line-${line}`}
            dataKey={line}
            type="monotone"
            yAxisId="left"
            stroke={fieldStyles[line]?.color || "#111"}
            strokeWidth={2}
            dot={false}
            name={fieldStyles[line]?.name || line}
            strokeDasharray={fieldStyles[line]?.dash || "solid"}
          />
        ))}
    </ComposedChart>
  </ResponsiveContainer>
);

export default TotalPercentageChart;