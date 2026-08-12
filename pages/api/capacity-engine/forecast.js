// ============================================
// CAPACITY ENGINE — Forecast Data API
// METHODS: GET, POST, DELETE
//
// Forecast identity:
//   capPlan + channelKey + date
//
// channel and channelNorm are display snapshots.
// Legacy name-based records remain supported.
// ============================================

import { ObjectId } from "mongodb";

import {
  connectToDatabase,
} from "../../../lib/mongodb";

import {
  verifySession,
  verifyPermissions,
  ROLES,
} from "../../../lib/verification";

// ============================================
// HELPERS
// ============================================

function normalizeChannelName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildCapPlanFilter(capPlanId) {
  if (ObjectId.isValid(capPlanId)) {
    return {
      $or: [
        {
          _id:
            new ObjectId(
              capPlanId
            ),
        },
        {
          _id: capPlanId,
        },
      ],
    };
  }

  return {
    _id: capPlanId,
  };
}

function getConfiguredChannel({
  engineChannels,
  channelKey,
  channelName,
}) {
  /*
   * Stable key takes priority.
   */
  if (
    channelKey &&
    engineChannels?.[
      channelKey
    ]
  ) {
    return {
      key: channelKey,
      config:
        engineChannels[
          channelKey
        ],
    };
  }

  /*
   * Compatibility for the current CSV
   * uploader and legacy clients that send
   * only the channel display name.
   */
  const requestedName =
    normalizeChannelName(
      channelName
    );

  if (!requestedName) {
    return null;
  }

  const matches =
    Object.entries(
      engineChannels || {}
    ).filter(
      ([, config]) =>
        normalizeChannelName(
          config?.name
        ) === requestedName
    );

  /*
   * More than one match is ambiguous and
   * must not be selected automatically.
   */
  if (matches.length !== 1) {
    return null;
  }

  const [key, config] =
    matches[0];

  return {
    key,
    config,
  };
}

function isValidDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value
    )
  ) {
    return false;
  }

  const [
    yearText,
    monthText,
    dayText,
  ] = value.split("-");

  const year =
    Number(yearText);

  const month =
    Number(monthText);

  const day =
    Number(dayText);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );

  return (
    date.getUTCFullYear() ===
      year &&
    date.getUTCMonth() ===
      month - 1 &&
    date.getUTCDate() ===
      day
  );
}

function buildChannelQueryFilter({
  queryValue,
  engineChannels,
}) {
  const requested =
    String(queryValue || "")
      .trim();

  if (!requested) {
    return null;
  }

  /*
   * Query value may already be a stable key.
   */
  if (
    engineChannels?.[
      requested
    ]
  ) {
    const config =
      engineChannels[
        requested
      ];

    return {
      $or: [
        {
          channelKey:
            requested,
        },
        {
          channelKey: {
            $exists: false,
          },
          channelNorm:
            normalizeChannelName(
              config?.name
            ),
        },
      ],
    };
  }

  /*
   * Otherwise resolve it as a display name.
   */
  const match =
    getConfiguredChannel({
      engineChannels,
      channelName:
        requested,
    });

  if (match) {
    return {
      $or: [
        {
          channelKey:
            match.key,
        },
        {
          channelKey: {
            $exists: false,
          },
          channelNorm:
            normalizeChannelName(
              match.config?.name
            ),
        },
      ],
    };
  }

  /*
   * Legacy fallback when the channel is no
   * longer part of the configuration.
   */
  return {
    channelNorm:
      normalizeChannelName(
        requested
      ),
  };
}

async function backfillLegacyForecasts({
  db,
  capPlanId,
  engineChannels,
  username,
}) {
  const summary = {
    matched: 0,
    modified: 0,
  };

  for (const [
    channelKey,
    channelConfig,
  ] of Object.entries(
    engineChannels || {}
  )) {
    const channelName =
      String(
        channelConfig?.name ||
          channelKey
      ).trim();

    const channelNorm =
      normalizeChannelName(
        channelName
      );

    const result =
      await db
        .collection(
          "capForecasts"
        )
        .updateMany(
          {
            capPlan:
              capPlanId,

            channelKey: {
              $exists: false,
            },

            channelNorm,
          },
          {
            $set: {
              channelKey,
              channel:
                channelName,
              channelNorm,

              channelIdentityUpdatedAt:
                new Date(),

              channelIdentityUpdatedBy:
                username,
            },
          }
        );

    summary.matched +=
      result.matchedCount;

    summary.modified +=
      result.modifiedCount;
  }

  return summary;
}

// ============================================
// API HANDLER
// ============================================

export default async function handler(
  req,
  res
) {
  const {
    query = {},
    method,
    body = {},
    headers = {},
  } = req;

  const { db } =
    await connectToDatabase();

  const verification =
    headers.authorization
      ? await verifySession(
          db,
          headers.authorization
        )
      : {
          verified: false,
        };

  const capPlanId =
    String(
      query.capPlan || ""
    ).trim();

  if (!capPlanId) {
    return res.status(400).json({
      message:
        "Missing capPlan parameter",
    });
  }

  /*
   * Load the capacity plan for every method so
   * channel keys can be validated and names can
   * be treated only as display values.
   */
  const capPlan =
    await db
      .collection("capPlans")
      .findOne(
        buildCapPlanFilter(
          capPlanId
        )
      );

  if (!capPlan) {
    return res.status(404).json({
      message:
        "Capacity plan not found.",
    });
  }

  const engineChannels =
    capPlan.engineChannels || {};

  switch (method) {
    // ========================================
    // GET
    // ========================================

    case "GET": {
      const filter = {
        capPlan: capPlanId,
      };

      if (
        query.fromDate ||
        query.toDate
      ) {
        filter.date = {};

        if (query.fromDate) {
          filter.date.$gte =
            query.fromDate;
        }

        if (query.toDate) {
          filter.date.$lte =
            query.toDate;
        }
      }

      if (query.channel) {
        const channelFilter =
          buildChannelQueryFilter({
            queryValue:
              query.channel,
            engineChannels,
          });

        if (channelFilter) {
          Object.assign(
            filter,
            channelFilter
          );
        }
      }

      const forecasts =
        await db
          .collection(
            "capForecasts"
          )
          .find(filter)
          .sort({
            date: 1,
            channel: 1,
          })
          .toArray();

      return res
        .status(200)
        .json({
          message: `Found ${forecasts.length} forecast records`,
          data: forecasts,
        });
    }

    // ========================================
    // POST
    // ========================================

    case "POST": {
      const allowed =
        verification.verified &&
        (await verifyPermissions(
          ROLES.MANAGER,
          null,
          db,
          headers.authorization
        ));

      if (!allowed) {
        return res
          .status(
            verification.verified
              ? 403
              : 401
          )
          .json(verification);
      }

      if (
        !Array.isArray(
          body.payload
        ) ||
        body.payload.length ===
          0
      ) {
        return res.status(400).json({
          message:
            "Missing non-empty payload array",
        });
      }

      if (
        !capPlan.engineEnabled ||
        Object.keys(
          engineChannels
        ).length === 0
      ) {
        return res.status(400).json({
          message:
            "The capacity engine does not have configured channels.",
        });
      }

      const errors = [];
      const normalizedRows = [];
      const payloadKeys =
        new Set();

      body.payload.forEach(
        (item, index) => {
          const resolvedChannel =
            getConfiguredChannel({
              engineChannels,

              channelKey:
                String(
                  item?.channelKey ||
                    ""
                ).trim(),

              channelName:
                item?.channel,
            });

          if (!resolvedChannel) {
            errors.push({
              index,
              code:
                "UNKNOWN_CHANNEL",
              message: `Row ${
                index + 1
              } does not match exactly one configured channel.`,
            });

            return;
          }

          const date =
            String(
              item?.date || ""
            ).trim();

          if (!isValidDate(date)) {
            errors.push({
              index,
              code:
                "INVALID_DATE",
              message: `Row ${
                index + 1
              } must contain a valid YYYY-MM-DD date.`,
            });

            return;
          }

          const volume =
            Number(item?.volume);

          if (
            !Number.isFinite(
              volume
            ) ||
            volume < 0
          ) {
            errors.push({
              index,
              code:
                "INVALID_VOLUME",
              message: `Row ${
                index + 1
              } volume must be a numeric value greater than or equal to 0.`,
            });

            return;
          }

          const channelName =
            String(
              resolvedChannel
                .config?.name ||
                resolvedChannel.key
            ).trim();

          const payloadKey =
            `${resolvedChannel.key}|${date}`;

          if (
            payloadKeys.has(
              payloadKey
            )
          ) {
            errors.push({
              index,
              code:
                "DUPLICATE_CHANNEL_DATE",
              message: `The upload contains more than one forecast for ${channelName} on ${date}.`,
            });

            return;
          }

          payloadKeys.add(
            payloadKey
          );

          normalizedRows.push({
            channelKey:
              resolvedChannel.key,

            channel:
              channelName,

            channelNorm:
              normalizeChannelName(
                channelName
              ),

            date,
            week:
              item?.week || null,

            volume,
          });
        }
      );

      if (errors.length > 0) {
        return res.status(422).json({
          message: `Forecast validation failed with ${errors.length} error(s).`,
          validation: {
            valid: false,
            errors:
              errors.slice(0, 100),
          },
        });
      }

      const username =
        verification?.user
          ?.username ||
        "unknown";

      /*
       * Upgrade any old name-based records before
       * performing stable-key upserts.
       */
      const legacyMigration =
        await backfillLegacyForecasts({
          db,
          capPlanId,
          engineChannels,
          username,
        });

      const now = new Date();

      const bulkOps =
        normalizedRows.map(
          (item) => ({
            updateOne: {
              filter: {
                capPlan:
                  capPlanId,

                channelKey:
                  item.channelKey,

                date:
                  item.date,
              },

              update: {
                $set: {
                  capPlan:
                    capPlanId,

                  channelKey:
                    item.channelKey,

                  channel:
                    item.channel,

                  channelNorm:
                    item.channelNorm,

                  date:
                    item.date,

                  week:
                    item.week,

                  volume:
                    item.volume,

                  updatedAt: now,

                  updatedBy:
                    username,
                },

                $setOnInsert: {
                  createdAt: now,

                  createdBy:
                    username,
                },
              },

              upsert: true,
            },
          })
        );

      const result =
        await db
          .collection(
            "capForecasts"
          )
          .bulkWrite(
            bulkOps
          );

      return res
        .status(200)
        .json({
          message: `Processed ${bulkOps.length} forecast records`,

          data: {
            matched:
              result.matchedCount,

            upserted:
              result.upsertedCount,

            modified:
              result.modifiedCount,

            legacyMigration,
          },
        });
    }

    // ========================================
    // DELETE
    // ========================================

    case "DELETE": {
      const allowed =
        verification.verified &&
        (await verifyPermissions(
          ROLES.MANAGER,
          null,
          db,
          headers.authorization
        ));

      if (!allowed) {
        return res
          .status(
            verification.verified
              ? 403
              : 401
          )
          .json(verification);
      }

      const deleteFilter = {
        capPlan: capPlanId,
      };

      if (query.channel) {
        const channelFilter =
          buildChannelQueryFilter({
            queryValue:
              query.channel,
            engineChannels,
          });

        if (channelFilter) {
          Object.assign(
            deleteFilter,
            channelFilter
          );
        }
      }

      if (
        query.fromDate ||
        query.toDate
      ) {
        deleteFilter.date = {};

        if (query.fromDate) {
          deleteFilter.date.$gte =
            query.fromDate;
        }

        if (query.toDate) {
          deleteFilter.date.$lte =
            query.toDate;
        }
      }

      const result =
        await db
          .collection(
            "capForecasts"
          )
          .deleteMany(
            deleteFilter
          );

      return res
        .status(200)
        .json({
          message: `Deleted ${result.deletedCount} forecast records`,
          data: result,
        });
    }

    default: {
      res.setHeader(
        "Allow",
        [
          "GET",
          "POST",
          "DELETE",
        ]
      );

      return res
        .status(405)
        .json({
          message:
            "Method not allowed. Use GET, POST, or DELETE.",
        });
    }
  }
}