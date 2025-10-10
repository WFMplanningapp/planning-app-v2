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
  ReferenceLine,
} from "recharts";

const fieldStyles = {
  grossRequirement:  { color: "#247ba0", dash: "solid", name: "Gross FTE Req." },
  totalFTE:          { color: "#247ba0", dash: "3 3", name: "Planned Gross FTE" },
  inCenterRequirement: { color: "#e67e22", dash: "solid", name: "InCenter Requirement" },
  compositeInCenterFTE:   { color: "#e67e22", dash: "2 5", name: "InCenter FTE (Actual/Predictive)" },
  productiveRequirement: { color: "#8e44ad", dash: "solid", name: "Productive Requirement" },
  compositeProductiveFTE:   { color: "#8e44ad", dash: "5 4", name: "Productive FTE (Actual/Predictive)" },
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
    'compositeProductiveFTE',
    'inCenterRequirement',
    'compositeInCenterFTE',
    'grossRequirement',
    'totalHC',
    'expectedFTE',
  ],
  bars = ['attrPercent', 'fcAttrition']
}) => {
  const today = new Date();
  const getWeekStart = w => new Date(w.firstDate);
  const currentWeek = data && data.find(w => {
    const ws = getWeekStart(w);
    const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000);
    return ws <= today && today < we;
  });

  return (
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
        {currentWeek && (
          <ReferenceLine
            x={currentWeek.firstDate}
            stroke="#F44336"
            strokeWidth={2}
            yAxisId={"left"}
            label={{
              value: "Current Week",
              fill: "#F44336",
              fontSize: 13,
              fontWeight: 600,
              dy: 10,
              position: "top"
            }}
            ifOverflow="extendDomain"
            strokeDasharray="4 3"
            isFront
          />
        )}
        <Tooltip
          formatter={(value, name) =>
            typeof value === "number"
              ? [value.toFixed(2), fieldStyles[name]?.name || name]
              : [value, fieldStyles[name]?.name || name]
          }
        />
        {/* BARS */}
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
        {/* LINES */}
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
};

export default TotalPercentageChart;