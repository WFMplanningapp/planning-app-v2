// ============================================
// COMBINED VIEW
// Multi-channel summary: stacked totals + per-channel breakdown
// ============================================

import { useMemo } from "react";

export default function CombinedView({
  channelResults,
  channelsConfig,
  channelWeeklyFTE,
  combinedWeeklyFTE,
}) {
  const channelSummary = useMemo(() => {
    if (!channelsConfig || !channelWeeklyFTE) return [];

    return Object.entries(channelsConfig).map(([key, config]) => {
      const weekly = channelWeeklyFTE[key] || {};
      const dailyResults = channelResults?.[key] || [];

      // Calculate weighted occupancy
      let totalWeightedOcc = 0;
      let totalWeight = 0;
      dailyResults.forEach((day) => {
        (day.intervals || []).forEach((iv) => {
          if (iv.productive > 0 && iv.occupancy > 0) {
            totalWeightedOcc += iv.occupancy * iv.productive;
            totalWeight += iv.productive;
          }
        });
      });
      const avgOcc = totalWeight > 0 ? totalWeightedOcc / totalWeight : 0;

      // Count operating days
      const opDays = dailyResults.filter(
        (d) => d.intervals && d.intervals.length > 0
      ).length;

      return {
        key,
        name: config.name,
        icon: config.icon,
        model: config.model,
        productiveFTE: weekly.productiveFTE || 0,
        inCenterFTE: weekly.inCenterFTE || 0,
        grossFTE: weekly.grossFTE || 0,
        hours_productive: weekly.hours_productive || 0,
        hours_inCenter: weekly.hours_inCenter || 0,
        hours_gross: weekly.hours_gross || 0,
        avgOcc,
        opDays,
      };
    });
  }, [channelsConfig, channelWeeklyFTE, channelResults]);

  if (!combinedWeeklyFTE || channelSummary.length === 0) {
    return (
      <div className="notification is-light is-size-7">
        No results to display.
      </div>
    );
  }

  // Stacked bar data
  const maxGross = Math.max(...channelSummary.map((c) => c.grossFTE), 1);

  return (
    <div className="box">
      <h4 className="title is-6 mb-3">Combined View — All Channels</h4>

      {/* Stacked Visual */}
      <div className="mb-4">
        <div className="is-flex" style={{ gap: "2px", height: "40px" }}>
          {channelSummary.map((ch) => {
            const widthPct = (ch.grossFTE / (combinedWeeklyFTE.grossFTE || 1)) * 100;
            return (
              <div
                key={ch.key}
                style={{
                  width: `${widthPct}%`,
                  background: ch.model === "erlangC" ? "#4b4bf9" : "#bfa1ff",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: "0.65rem",
                  fontWeight: 600,
                  minWidth: widthPct > 5 ? "auto" : "0",
                  overflow: "hidden",
                }}
                title={`${ch.name}: ${ch.grossFTE.toFixed(1)} FTE`}
              >
                {widthPct > 10 && `${ch.icon} ${ch.grossFTE.toFixed(1)}`}
              </div>
            );
          })}
        </div>
        <div className="is-flex is-justify-content-space-between is-size-7 has-text-grey mt-1">
          <span>0 FTE</span>
          <span>
            Total: <strong>{combinedWeeklyFTE.grossFTE.toFixed(1)} FTE (Gross)</strong>
          </span>
        </div>
      </div>

      {/* Channel Breakdown Table */}
      <table className="table is-narrow is-fullwidth is-striped is-size-7">
        <thead>
          <tr>
            <th>Channel</th>
            <th className="has-text-centered">Model</th>
            <th className="has-text-centered">Op Days</th>
            <th className="has-text-centered">Productive FTE</th>
            <th className="has-text-centered">InCenter FTE</th>
            <th className="has-text-centered">Gross FTE</th>
            <th className="has-text-centered">Prod Hours</th>
            <th className="has-text-centered">Gross Hours</th>
            <th className="has-text-centered">Avg Occ</th>
          </tr>
        </thead>
        <tbody>
          {channelSummary.map((ch) => (
            <tr key={ch.key}>
              <td>
                <strong>
                  {ch.icon} {ch.name}
                </strong>
              </td>
              <td className="has-text-centered">
                <span
                  className={`tag is-small ${
                    ch.model === "erlangC" ? "is-info" : "is-warning"
                  } is-light`}
                >
                  {ch.model === "erlangC" ? "Erlang C" : "Workload"}
                </span>
              </td>
              <td className="has-text-centered">{ch.opDays}</td>
              <td className="has-text-centered">{ch.productiveFTE.toFixed(2)}</td>
              <td className="has-text-centered">{ch.inCenterFTE.toFixed(2)}</td>
              <td className="has-text-centered has-text-weight-bold">
                {ch.grossFTE.toFixed(2)}
              </td>
              <td className="has-text-centered">{ch.hours_productive.toFixed(0)}</td>
              <td className="has-text-centered">{ch.hours_gross.toFixed(0)}</td>
              <td className="has-text-centered">
                {ch.avgOcc > 0 ? `${ch.avgOcc.toFixed(1)}%` : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="has-text-weight-bold" style={{ background: "#f3f3f7" }}>
            <td>TOTAL</td>
            <td></td>
            <td></td>
            <td className="has-text-centered">
              {combinedWeeklyFTE.productiveFTE.toFixed(2)}
            </td>
            <td className="has-text-centered">
              {combinedWeeklyFTE.inCenterFTE.toFixed(2)}
            </td>
            <td className="has-text-centered">
              {combinedWeeklyFTE.grossFTE.toFixed(2)}
            </td>
            <td className="has-text-centered">
              {combinedWeeklyFTE.hours_productive.toFixed(0)}
            </td>
            <td className="has-text-centered">
              {combinedWeeklyFTE.hours_gross.toFixed(0)}
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}