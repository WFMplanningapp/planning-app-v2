// ============================================
// CAPACITY ENGINE KPI CARDS
//
// Cards:
// - Weekly FTE
// - Weekly Hours
// - Weekly Shrinkage
// - Occupancy
// - Available to Blend
// ============================================

import {
  useMemo,
} from "react";

// ============================================
// HELPERS
// ============================================

function toFiniteNumber(
  value,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function hasFiniteValue(value) {
  return (
    value !== null &&
    value !== undefined &&
    value !== "" &&
    Number.isFinite(
      Number(value)
    )
  );
}

function formatNumber(
  value,
  decimals = 1
) {
  return toFiniteNumber(
    value,
    0
  ).toFixed(decimals);
}

function formatPercentage(
  value,
  decimals = 1
) {
  return `${formatNumber(
    value,
    decimals
  )}%`;
}

// ============================================
// INDIVIDUAL KPI CARD
// ============================================

function KPICard({
  title,
  mainValue,
  mainUnit,
  subItems,
  color,
  icon,
  tooltip,
  minWidth = "180px",
}) {
  return (
    <div
      className="box p-3"
      style={{
        minWidth: "180px",
        flex: `1 0 ${minWidth}`,
        marginBottom: 0,
      }}
      title={tooltip || undefined}
    >
      <div className="is-size-7 has-text-grey mb-1">
        {icon && (
          <span className="mr-1">
            {icon}
          </span>
        )}

        {title}
      </div>

      <div className="is-flex is-align-items-baseline">
        <span
          className="is-size-3 has-text-weight-bold"
          style={{
            color:
              color ||
              "#4b4bf9",
          }}
        >
          {mainValue}
        </span>

        {mainUnit && (
          <span className="is-size-7 has-text-grey ml-1">
            {mainUnit}
          </span>
        )}
      </div>

      {subItems &&
        subItems.length > 0 && (
          <div className="mt-1">
            {subItems.map(
              (subItem, index) => (
                <div
                  key={`${subItem.label}-${index}`}
                  className="is-flex is-justify-content-space-between is-size-7"
                  style={{
                    gap: "0.75rem",
                    alignItems: "stretch",
                  }}
                >
                  <span className="has-text-grey">
                    {
                      subItem.label
                    }
                  </span>

                  <span className="has-text-weight-semibold">
                    {
                      subItem.value
                    }
                  </span>
                </div>
              )
            )}
          </div>
        )}
    </div>
  );
}

// ============================================
// KPI CARD COLLECTION
// ============================================

export default function KPICards({
  weeklyFTE,
  channelResults,
  channelsConfig,
  shrinkageSummary,
}) {
  const kpis = useMemo(() => {
    if (!weeklyFTE) {
      return null;
    }

    // ========================================
    // WEEKLY FTE
    // ========================================

    const fteCard = {
      title: "Weekly FTE",

      mainValue:
        formatNumber(
          weeklyFTE.grossFTE,
          1
        ),

      mainUnit: "Gross",

      color: "#4b4bf9",

      icon: "👥",

      subItems: [
        {
          label: "InCenter",

          value:
            formatNumber(
              weeklyFTE.inCenterFTE,
              1
            ),
        },
        {
          label: "Productive",

          value:
            formatNumber(
              weeklyFTE.productiveFTE,
              1
            ),
        },
      ],
    };

    // ========================================
    // WEEKLY HOURS
    // ========================================

    const hoursCard = {
      title: "Weekly Hours",

      mainValue:
        formatNumber(
          weeklyFTE.hours_gross,
          0
        ),

      mainUnit: "Gross hrs",

      color: "#4b4bf9",

      icon: "⏱",

      subItems: [
        {
          label: "InCenter",

          value: `${formatNumber(
            weeklyFTE.hours_inCenter,
            0
          )} hrs`,
        },
        {
          label: "Productive",

          value: `${formatNumber(
            weeklyFTE.hours_productive,
            0
          )} hrs`,
        },
      ],
    };

    // ========================================
    // WEEKLY SHRINKAGE
    // ========================================

    const plannedShrinkage =
      shrinkageSummary?.planned;

    const effectiveShrinkage =
      shrinkageSummary?.effective;

    const classificationCoverage =
      plannedShrinkage
        ?.classificationCoverage;

    const compensationDays =
      toFiniteNumber(
        classificationCoverage
          ?.compensationDays,
        0
      );

    const billingDays =
      toFiniteNumber(
        classificationCoverage
          ?.billingDays,
        0
      );

    /* const totalClassificationDays =
      toFiniteNumber(
        classificationCoverage
          ?.totalDays,
        0
      ); */

    const hasCompensation =
      compensationDays > 0 &&
      hasFiniteValue(
        plannedShrinkage?.paid
      ) &&
      hasFiniteValue(
        plannedShrinkage?.unpaid
      );

    const hasBilling =
      billingDays > 0 &&
      hasFiniteValue(
        plannedShrinkage?.billable
      ) &&
      hasFiniteValue(
        plannedShrinkage
          ?.nonBillable
      );

      const hasShrinkageSummary =
      effectiveShrinkage &&
      Number.isFinite(
        Number(
          effectiveShrinkage.combined
        )
      );

    const shrinkageCard = {
      title: "Weekly Shrinkage",

      mainValue:
        hasShrinkageSummary
          ? formatNumber(
              effectiveShrinkage.combined,
              1
            )
          : "—",

      mainUnit:
        hasShrinkageSummary
          ? "% Effective"
          : "Not calculated",

      color: "#4b4bf9",

      icon: "📉",

      tooltip:
        "Effective shrinkage is derived from final engine hours. Paid, non-paid, billable, and non-billable values are planned daily-average item rates. These additive classifications do not equal multiplicatively combined shrinkage.",
      
      minWidth: "300px",
        subItems:
        hasShrinkageSummary
          ? [
              {
                label:
                  "Internal effective",

                value:
                  formatPercentage(
                    effectiveShrinkage
                      .internal,
                    1
                  ),
              },
              {
                label:
                  "External effective",

                value:
                  formatPercentage(
                    effectiveShrinkage
                      .external,
                    1
                  ),
              },
              {
                label:
                  "Combined planned",

                value:
                  formatPercentage(
                    plannedShrinkage
                      ?.combined,
                    1
                  ),
              },
              {
                label:
                  "Paid / Unpaid",

                value:
                  hasCompensation
                    ? `${formatPercentage(
                        plannedShrinkage
                          .paid,
                        1
                      )} / ${formatPercentage(
                        plannedShrinkage
                          .unpaid,
                        1
                      )}`
                    : "—",
              },
              {
                label:
                  "Billable / Non-Billable",

                value:
                  hasBilling
                    ? `${formatPercentage(
                        plannedShrinkage
                          .billable,
                        1
                      )} / ${formatPercentage(
                        plannedShrinkage
                          .nonBillable,
                        1
                      )}`
                    : "—",
              },
              //{
                //label:
                  //"Classification coverage",

                //value:
                  //totalClassificationDays >
                 // 0
                   // ? `${Math.min(
                     //   compensationDays,
                    //    billingDays
                    //  )}/${totalClassificationDays} days`
                   // : "—",
              //},
            ]
          : [],
    };

    // ========================================
    // OCCUPANCY
    //
    // Weighted by productive staffing so that
    // intervals with larger requirements carry
    // proportionally more influence.
    // ========================================

    let totalWeightedOccupancy =
      0;

    let totalProductiveWeight =
      0;

    if (
      channelResults &&
      channelsConfig
    ) {
      Object.values(
        channelResults
      ).forEach(
        (dailyResults) => {
          (
            dailyResults || []
          ).forEach((day) => {
            (
              day.intervals ||
              []
            ).forEach(
              (interval) => {
                const productive =
                  toFiniteNumber(
                    interval.productive,
                    0
                  );

                const occupancy =
                  toFiniteNumber(
                    interval.occupancy,
                    0
                  );

                if (
                  productive > 0 &&
                  occupancy > 0
                ) {
                  totalWeightedOccupancy +=
                    occupancy *
                    productive;

                  totalProductiveWeight +=
                    productive;
                }
              }
            );
          });
        }
      );
    }

    const occupancy =
      totalProductiveWeight > 0
        ? totalWeightedOccupancy /
          totalProductiveWeight
        : 0;

    const occupancyCard = {
      title: "Occupancy",

      mainValue:
        formatNumber(
          occupancy,
          1
        ),

      mainUnit: "%",

      color:
        occupancy > 90
          ? "#ff8d96"
          : occupancy > 75
            ? "#4b4bf9"
            : "#8bf0bb",

      icon: "📊",

      tooltip:
        "Occupancy is weighted by productive staffing across all calculated channel intervals.",

      subItems: [],
    };

    // ========================================
    // AVAILABLE TO BLEND
    // ========================================

    let totalBlendHours = 0;

    if (
      channelResults &&
      channelsConfig
    ) {
      Object.entries(
        channelResults
      ).forEach(
        ([
          channelKey,
          dailyResults,
        ]) => {
          const configuration =
            channelsConfig[
              channelKey
            ];

          const normalizedModel =
            String(
              configuration?.model ||
              ""
            )
              .trim()
              .toLowerCase()
              .replace(
                /[\s_-]+/g,
                ""
              );

          if (
            normalizedModel !==
            "erlangc"
          ) {
            return;
          }

          (
            dailyResults || []
          ).forEach((day) => {
            (
              day.intervals ||
              []
            ).forEach(
              (interval) => {
                totalBlendHours +=
                  toFiniteNumber(
                    interval.blendHours,
                    0
                  );
              }
            );
          });
        }
      );
    }

    const blendCard = {
      title:
        "Available to Blend",

      mainValue:
        formatNumber(
          totalBlendHours,
          1
        ),

      mainUnit: "hrs/week",

      color:
        totalBlendHours > 0
          ? "#bfa1ff"
          : "#888888",

      icon: "🔄",

      subItems: [],
    };

    // Occupancy Gap has intentionally been
    // removed. The occupancy card presents the
    // calculated weighted occupancy directly.

    return [
      fteCard,
      hoursCard,
      shrinkageCard,
      occupancyCard,
      blendCard,
    ];
  }, [
    weeklyFTE,
    channelResults,
    channelsConfig,
    shrinkageSummary,
  ]);

  if (!kpis) {
    return (
      <div className="notification is-light is-size-7">
        Run a calculation to see
        KPI cards.
      </div>
    );
  }

  return (
    <div
      className="is-flex"
      style={{
        gap: "0.75rem",
        overflowX: "auto",
        paddingBottom: "0.5rem",
      }}
    >
      {kpis.map(
        (kpi) => (
          <KPICard
            key={kpi.title}
            {...kpi}
          />
        )
      )}
    </div>
  );
}