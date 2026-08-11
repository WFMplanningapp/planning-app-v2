// ============================================
// BLENDING PANEL
// Redistribute underutilized Erlang C capacity
// to other channels
// ============================================

import {
  useEffect,
  useMemo,
  useState,
} from "react";

function normalizeAllocations(
  allocations
) {
  if (
    !allocations ||
    typeof allocations !== "object" ||
    Array.isArray(allocations)
  ) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(allocations)
      .map(([key, value]) => [
        key,
        Math.max(
          0,
          Number(value) || 0
        ),
      ])
      .filter(([, value]) => value > 0)
  );
}

function allocationsAreEqual(
  first,
  second
) {
  const normalizedFirst =
    normalizeAllocations(first);

  const normalizedSecond =
    normalizeAllocations(second);

  const firstKeys = Object.keys(
    normalizedFirst
  ).sort();

  const secondKeys = Object.keys(
    normalizedSecond
  ).sort();

  if (
    firstKeys.length !==
    secondKeys.length
  ) {
    return false;
  }

  return firstKeys.every(
    (key, index) =>
      key === secondKeys[index] &&
      Math.abs(
        normalizedFirst[key] -
          normalizedSecond[key]
      ) < 0.000001
  );
}

export default function BlendingPanel({
  channelResults,
  channelsConfig,
  channelWeeklyFTE,
  blendingPlan,
  blendingSummary,
  isApplying = false,
  onBlendApplied,
  onBlendReset,
  onDirtyChange,
}) {
  const persistedOccupancyTarget =
    Number(
      blendingPlan?.occupancyTarget
    ) || 90;

  const persistedAllocations =
    useMemo(
      () =>
        normalizeAllocations(
          blendingPlan?.allocations
        ),
      [blendingPlan]
    );

  const [allocations, setAllocations] =
    useState(
      persistedAllocations
    );

  const [
    blendOccTarget,
    setBlendOccTarget,
  ] = useState(
    persistedOccupancyTarget
  );

  // Reset the draft when a new week or newly
  // calculated result is loaded.
  useEffect(() => {
    setAllocations(
      persistedAllocations
    );

    setBlendOccTarget(
      persistedOccupancyTarget
    );
  }, [
    persistedAllocations,
    persistedOccupancyTarget,
  ]);

  const isDirty =
    Number(blendOccTarget) !==
      Number(
        persistedOccupancyTarget
      ) ||
    !allocationsAreEqual(
      allocations,
      persistedAllocations
    );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Calculate baseline blend availability.
  //
  // If the loaded result is already blended,
  // reconstruct the original occupancy before
  // calculating availability for the draft target.
  const blendSources = useMemo(() => {
    if (
      !channelResults ||
      !channelsConfig
    ) {
      return [];
    }

    return Object.entries(
      channelsConfig
    )
      .filter(
        ([, config]) =>
          String(config.model || "")
            .trim()
            .toLowerCase()
            .replace(
              /[\s_-]+/g,
              ""
            ) === "erlangc"
      )
      .map(([key, config]) => {
        const dailyResults =
          channelResults[key] || [];

        let totalAvailable = 0;

        dailyResults.forEach(
          (day) => {
            (
              day.intervals || []
            ).forEach((interval) => {
              const productive =
                Number(
                  interval.productive
                ) || 0;

              const productiveHours =
                Number(
                  interval
                    .hours_productive
                ) || 0;

              if (
                productive <= 0 ||
                productiveHours <= 0
              ) {
                return;
              }

              const currentOccupancy =
                Number(
                  interval.occupancy
                ) || 0;

              const appliedBlendHours =
                Number(
                  interval.blendHours
                ) || 0;

              // This reverses the occupancy
              // adjustment made by the engine.
              const occupancyAddedByBlend =
                (
                  appliedBlendHours /
                  productiveHours
                ) *
                persistedOccupancyTarget;

              const baselineOccupancy =
                Math.max(
                  0,
                  currentOccupancy -
                    occupancyAddedByBlend
                );

              if (
                baselineOccupancy >=
                blendOccTarget
              ) {
                return;
              }

              const blendHours =
                productiveHours *
                (
                  (
                    blendOccTarget -
                    baselineOccupancy
                  ) /
                  blendOccTarget
                );

              totalAvailable +=
                Math.max(
                  0,
                  blendHours
                );
            });
          }
        );

        return {
          key,
          name:
            config.name || key,
          icon: config.icon,
          available:
            Math.round(
              totalAvailable * 100
            ) / 100,
          weeklyFTE:
            channelWeeklyFTE?.[
              key
            ] || {},
        };
      })
      .filter(
        (source) =>
          source.available > 0 ||
          Object.keys(
            persistedAllocations
          ).some((allocationKey) =>
            allocationKey.startsWith(
              `${source.key}→`
            )
          )
      );
  }, [
    channelResults,
    channelsConfig,
    channelWeeklyFTE,
    blendOccTarget,
    persistedOccupancyTarget,
    persistedAllocations,
  ]);

  const blendDestinations =
    useMemo(() => {
      if (!channelsConfig) {
        return [];
      }

      return Object.entries(
        channelsConfig
      ).map(([key, config]) => ({
        key,
        name:
          config.name || key,
        icon: config.icon,
        grossHours:
          channelWeeklyFTE?.[key]
            ?.hours_gross || 0,
      }));
    }, [
      channelsConfig,
      channelWeeklyFTE,
    ]);

  const getTotalAllocated = (
    sourceKey,
    values = allocations
  ) =>
    Object.entries(values)
      .filter(([key]) =>
        key.startsWith(
          `${sourceKey}→`
        )
      )
      .reduce(
        (total, [, value]) =>
          total +
          (Number(value) || 0),
        0
      );

  const getTotalReceived = (
    destinationKey
  ) =>
    Object.entries(allocations)
      .filter(([key]) =>
        key.endsWith(
          `→${destinationKey}`
        )
      )
      .reduce(
        (total, [, value]) =>
          total +
          (Number(value) || 0),
        0
      );

  const updateAllocation = (
    source,
    destinationKey,
    rawHours
  ) => {
    const allocationKey =
      `${source.key}→${destinationKey}`;

    const requestedHours =
      Math.max(
        0,
        Number(rawHours) || 0
      );

    setAllocations(
      (previous) => {
        const allocatedElsewhere =
          Object.entries(previous)
            .filter(
              ([key]) =>
                key.startsWith(
                  `${source.key}→`
                ) &&
                key !== allocationKey
            )
            .reduce(
              (total, [, value]) =>
                total +
                (Number(value) ||
                  0),
              0
            );

        const maximumForDestination =
          Math.max(
            0,
            source.available -
              allocatedElsewhere
          );

        const nextHours =
          Math.min(
            requestedHours,
            maximumForDestination
          );

        const next = {
          ...previous,
        };

        if (nextHours > 0) {
          next[allocationKey] =
            Math.round(
              nextHours * 100
            ) / 100;
        } else {
          delete next[
            allocationKey
          ];
        }

        return next;
      }
    );
  };

  const totalBlendHours =
    Object.values(
      allocations
    ).reduce(
      (total, value) =>
        total +
        (Number(value) || 0),
      0
    );

    const handleTargetChange = (
      rawValue
    ) => {
      // Keep the temporary text value while typing.
      setBlendOccTarget(rawValue);
    };

    const handleTargetBlur = () => {
    const parsed =
      Number(blendOccTarget);

    const nextTarget =
      Number.isFinite(parsed)
        ? Math.min(
            100,
            Math.max(70, parsed)
          )
        : persistedOccupancyTarget;

    setBlendOccTarget(nextTarget);

    // Availability changes with the target.
    if (
      nextTarget !==
      persistedOccupancyTarget
    ) {
      setAllocations({});
    }
  };

  const handleApply = async () => {
    if (!onBlendApplied) {
      return;
    }

    const normalizedTarget =
    Math.min(
      100,
      Math.max(
        70,
        Number(blendOccTarget) ||
          persistedOccupancyTarget
      )
    );

  setBlendOccTarget(
    normalizedTarget
  );

    await onBlendApplied({
      occupancyTarget:
        blendOccTarget,
      allocations:
        normalizeAllocations(
          allocations
        ),
    });
  };

  const handleReset = async () => {
    if (!onBlendReset) {
      return;
    }

    await onBlendReset();
  };

  const hasPersistedPlan =
    Object.keys(
      persistedAllocations
    ).length > 0;

  return (
    <div className="box">
      <div className="is-flex is-align-items-center is-justify-content-space-between mb-3">
        <div>
          <h4 className="title is-6 mb-1">
            Blending Allocation
          </h4>

          <p className="is-size-7 has-text-grey">
            Allocations are applied to the selected week and saved after recalculation.
          </p>
        </div>

        <div
          className="is-flex is-align-items-center"
          style={{
            gap: "0.5rem",
          }}
        >
          <span className="is-size-7">
            Blend Occ Target:
          </span>

          <input
            className="input is-small"
            type="number"
            min="70"
            max="100"
            step="1"
            value={blendOccTarget}
            disabled={isApplying}
            onChange={(event) =>
              handleTargetChange(
                event.target.value
              )
            }
            style={{
              width: "65px",
            }}
          />

          <span className="is-size-7">
            %
          </span>
        </div>
      </div>

      {blendSources.length ===
      0 ? (
        <div className="notification is-light is-size-7">
          No blend capacity is available at the selected occupancy target.
        </div>
      ) : (
        <div className="table-container">
          <table className="table is-narrow is-fullwidth is-size-7">
            <thead>
              <tr>
                <th>
                  Source Channel
                </th>

                <th className="has-text-centered">
                  Available (hrs)
                </th>

                <th className="has-text-centered">
                  Allocated (hrs)
                </th>

                <th className="has-text-centered">
                  Remaining (hrs)
                </th>

                {blendDestinations.map(
                  (destination) => (
                    <th
                      key={
                        destination.key
                      }
                      className="has-text-centered"
                      style={{
                        minWidth:
                          "90px",
                      }}
                    >
                      {destination.icon}{" "}
                      {destination.name}
                    </th>
                  )
                )}
              </tr>
            </thead>

            <tbody>
              {blendSources.map(
                (source) => {
                  const totalAllocated =
                    getTotalAllocated(
                      source.key
                    );

                  const remaining =
                    Math.max(
                      0,
                      source.available -
                        totalAllocated
                    );

                  return (
                    <tr
                      key={source.key}
                    >
                      <td>
                        <strong>
                          {source.icon}{" "}
                          {source.name}
                        </strong>
                      </td>

                      <td className="has-text-centered has-text-info">
                        {source.available.toFixed(
                          1
                        )}
                      </td>

                      <td className="has-text-centered">
                        {totalAllocated.toFixed(
                          1
                        )}
                      </td>

                      <td
                        className={`has-text-centered ${
                          remaining >
                          0
                            ? "has-text-success"
                            : "has-text-grey"
                        }`}
                      >
                        {remaining.toFixed(
                          1
                        )}
                      </td>

                      {blendDestinations.map(
                        (
                          destination
                        ) => {
                          const allocationKey =
                            `${source.key}→${destination.key}`;

                          const allocatedElsewhere =
                            totalAllocated -
                            (
                              Number(
                                allocations[
                                  allocationKey
                                ]
                              ) || 0
                            );

                          const maximum =
                            Math.max(
                              0,
                              source.available -
                                allocatedElsewhere
                            );

                          return (
                            <td
                              key={
                                destination.key
                              }
                              className="has-text-centered"
                            >
                              {source.key ===
                              destination.key ? (
                                <span className="has-text-grey-light">
                                  —
                                </span>
                              ) : (
                                <input
                                  className="input is-small has-text-centered"
                                  type="number"
                                  min="0"
                                  max={
                                    maximum
                                  }
                                  step="0.1"
                                  disabled={
                                    isApplying
                                  }
                                  value={
                                    allocations[
                                      allocationKey
                                    ] || ""
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateAllocation(
                                      source,
                                      destination.key,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  style={{
                                    width:
                                      "70px",
                                  }}
                                  placeholder="0"
                                />
                              )}
                            </td>
                          );
                        }
                      )}
                    </tr>
                  );
                }
              )}
            </tbody>

            <tfoot>
              <tr className="has-text-weight-bold">
                <td>
                  Total Received
                </td>
                <td />
                <td />
                <td />

                {blendDestinations.map(
                  (destination) => {
                    const received =
                      getTotalReceived(
                        destination.key
                      );

                    return (
                      <td
                        key={
                          destination.key
                        }
                        className="has-text-centered"
                      >
                        {received > 0
                          ? `${received.toFixed(
                              1
                            )} hrs`
                          : "—"}
                      </td>
                    );
                  }
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {totalBlendHours > 0 && (
        <div className="notification is-success is-light is-size-7 mt-2">
          <strong>
            Draft Summary:
          </strong>{" "}
          {totalBlendHours.toFixed(
            1
          )}{" "}
          hours requested. Equivalent to{" "}
          <strong>
            {(
              totalBlendHours / 40
            ).toFixed(2)}{" "}
            FTE
          </strong>{" "}
          at 40 hours per week.
        </div>
      )}

      {blendingSummary &&
        Number(
          blendingSummary.requestedHours
        ) > 0 && (
          <div className="notification is-info is-light is-size-7 mt-2">
            <strong>
              Last Applied:
            </strong>{" "}
            {Number(
              blendingSummary.allocatedHours ||
                0
            ).toFixed(1)}{" "}
            of{" "}
            {Number(
              blendingSummary.requestedHours ||
                0
            ).toFixed(1)}{" "}
            requested hours were allocated.

            {Number(
              blendingSummary.unallocatedHours ||
                0
            ) > 0 && (
              <>
                {" "}
                <strong>
                  {Number(
                    blendingSummary.unallocatedHours
                  ).toFixed(1)}{" "}
                  hours
                </strong>{" "}
                could not be matched to eligible intervals.
              </>
            )}
          </div>
        )}

      {isDirty && (
        <div className="notification is-warning is-light is-size-7 mt-2 mb-2">
          You have unapplied blending changes.
        </div>
      )}

      <div
        className="is-flex is-justify-content-flex-end mt-3"
        style={{
          gap: "0.5rem",
        }}
      >
        <button
          type="button"
          className="button is-small is-light"
          disabled={
            isApplying ||
            (
              !isDirty &&
              !hasPersistedPlan
            )
          }
          onClick={handleReset}
        >
          Reset
        </button>

        <button
          type="button"
          className={`button is-small is-success ${
            isApplying
              ? "is-loading"
              : ""
          }`}
          disabled={
            isApplying || !isDirty
          }
          onClick={handleApply}
        >
          Apply Blending
        </button>
      </div>
    </div>
  );
}