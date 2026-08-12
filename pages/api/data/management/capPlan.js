import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"
import { connectToDatabase } from "../../../../lib/mongodb"
import { ObjectId } from "mongodb"

function normalizeChannelName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function buildChannelMigrations(
  currentChannels,
  nextChannels
) {
  const migrations = [];

  Object.entries(
    nextChannels || {}
  ).forEach(([channelKey, nextChannel]) => {
    const currentChannel =
      currentChannels?.[channelKey];

    /*
     * Only an existing channel can have
     * legacy forecast or pattern records.
     */
    if (!currentChannel) {
      return;
    }

    const oldName = String(
      currentChannel?.name || ""
    ).trim();

    const newName = String(
      nextChannel?.name || ""
    ).trim();

    if (!oldName || !newName) {
      return;
    }

    migrations.push({
      channelKey,
      oldName,
      oldNameNorm:
        normalizeChannelName(
          oldName
        ),
      newName,
      newNameNorm:
        normalizeChannelName(
          newName
        ),
      renamed:
        normalizeChannelName(
          oldName
        ) !==
        normalizeChannelName(
          newName
        ),
    });
  });

  return migrations;
}

function buildChannelDataFilter({
  capPlanId,
  channelKey,
  oldName,
  oldNameNorm,
  newName,
  newNameNorm,
}) {
  const names = [
    ...new Set(
      [
        oldName,
        newName,
      ].filter(Boolean)
    ),
  ];

  const normalizedNames = [
    ...new Set(
      [
        oldNameNorm,
        newNameNorm,
      ].filter(Boolean)
    ),
  ];

  return {
    capPlan: capPlanId,

    $or: [
      /*
       * Records already migrated to the
       * stable channel key.
       */
      {
        channelKey,
      },

      /*
       * Legacy records have no channelKey
       * and are identified by normalized name.
       */
      {
        channelKey: {
          $exists: false,
        },

        channelNorm: {
          $in: normalizedNames,
        },
      },

      /*
       * Compatibility for very old records
       * that may not contain channelNorm.
       */
      {
        channelKey: {
          $exists: false,
        },

        channel: {
          $in: names,
        },
      },
    ],
  };
}

async function findChannelDataConflicts({
  db,
  capPlanId,
  migrations,
}) {
  const conflicts = [];

  for (const collectionName of [
    "capForecasts",
    "capPatterns",
  ]) {
    const collection =
      db.collection(
        collectionName
      );

    for (const migration of migrations) {
      const documents =
        await collection
          .find(
            buildChannelDataFilter({
              capPlanId,
              ...migration,
            })
          )
          .project({
            _id: 1,
            date: 1,
            channel: 1,
            channelKey: 1,
          })
          .toArray();

      const documentsByDate =
        new Map();

      documents.forEach((document) => {
        const date = String(
          document.date || ""
        );

        if (!documentsByDate.has(date)) {
          documentsByDate.set(
            date,
            []
          );
        }

        documentsByDate
          .get(date)
          .push(document);
      });

      documentsByDate.forEach(
        (dateDocuments, date) => {
          if (
            dateDocuments.length > 1
          ) {
            conflicts.push({
              collection:
                collectionName,
              channelKey:
                migration.channelKey,
              oldName:
                migration.oldName,
              newName:
                migration.newName,
              date,
              records:
                dateDocuments.length,
            });
          }
        }
      );
    }
  }

  return conflicts;
}

async function migrateChannelData({
  db,
  capPlanId,
  migrations,
  username,
}) {
  const summary = {
    forecastsMatched: 0,
    forecastsModified: 0,
    patternsMatched: 0,
    patternsModified: 0,
    renamedChannels: [],
  };

  for (const migration of migrations) {
    const update = {
      $set: {
        channelKey:
          migration.channelKey,

        /*
         * These remain display snapshots.
         * The stable relationship is channelKey.
         */
        channel:
          migration.newName,

        channelNorm:
          migration.newNameNorm,

        channelIdentityUpdatedAt:
          new Date(),

        channelIdentityUpdatedBy:
          username,
      },
    };

    const forecastResult =
      await db
        .collection(
          "capForecasts"
        )
        .updateMany(
          buildChannelDataFilter({
            capPlanId,
            ...migration,
          }),
          update
        );

    const patternResult =
      await db
        .collection(
          "capPatterns"
        )
        .updateMany(
          buildChannelDataFilter({
            capPlanId,
            ...migration,
          }),
          update
        );

    summary.forecastsMatched +=
      forecastResult.matchedCount;

    summary.forecastsModified +=
      forecastResult.modifiedCount;

    summary.patternsMatched +=
      patternResult.matchedCount;

    summary.patternsModified +=
      patternResult.modifiedCount;

    if (migration.renamed) {
      summary.renamedChannels.push({
        channelKey:
          migration.channelKey,
        from:
          migration.oldName,
        to:
          migration.newName,
      });
    }
  }

  return summary;
}

/**
METHODS: POST(Add), PUT(Edit) DELETE(Remove)
PARAMS: id
BODY: payload, lob
HEADER: authorization base 64 encoded
*/

export default async function handler(req, res) {
  const { query, method, body, headers } = req

 // console.log(query, method, body, headers)

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  let target = query.id
  let payload = body.payload
  let lob = body.lob
  let language = body.language

  switch (method) {
  case "POST": {
    if (
      verification.verified &&
      (await verifyPermissions(
        ROLES.MANAGER,
        null,
        db,
        headers.authorization
      ))
    ) {
      const insert =
        payload &&
        payload.name &&
        lob &&
        language
          ? await db
              .collection("capPlans")
              .insertOne({
                ...payload,
                lob: lob._id,
                language: language._id,
                createdAt: new Date(),
                createdBy:
                  verification.user
                    .username,
              })
          : {
              message:
                "Nothing to Insert",
            };

      if (insert.acknowledged) {
        await db
          .collection("capEntries")
          .insertOne({
            week: payload.firstWeek,

            capPlan:
              insert.insertedId.toString(),

            ocpWeeks:
              lob.ocpWeeks || 0,

            trWeeks:
              lob.trWeeks || 0,

            createdAt: new Date(),

            createdBy:
              verification.user
                .username,
          });
      }

      return res.status(200).json({
        message: "Insert Completed!",
        verification,
        insert,
      });
    }

    return res
      .status(
        verification.verified
          ? 403
          : 401
      )
      .json(verification);
  }

  case "PUT": {
    if (
      verification.verified &&
      (await verifyPermissions(
        ROLES.MANAGER,
        null,
        db,
        headers.authorization
      )) &&
      target
    ) {
      if (
        !ObjectId.isValid(target)
      ) {
        return res.status(400).json({
          message:
            "Invalid capacity plan identifier.",
        });
      }

      if (
        !payload ||
        !language
      ) {
        return res.status(400).json({
          message:
            "Capacity plan payload and language are required.",
        });
      }

      const capPlanObjectId =
        new ObjectId(target);

      const existingCapPlan =
        await db
          .collection("capPlans")
          .findOne({
            _id: capPlanObjectId,
          });

      if (!existingCapPlan) {
        return res.status(404).json({
          message:
            "Capacity plan not found.",
        });
      }

      const nextChannels =
        payload.engineEnabled
          ? payload.engineChannels || {}
          : {};

      const migrations =
        buildChannelMigrations(
          existingCapPlan.engineChannels ||
            {},
          nextChannels
        );

      /*
      * Stop before changing anything if old
      * and new records already exist for the
      * same stable channel and date.
      *
      * This avoids silently choosing one
      * forecast or pattern over another.
      */
      const conflicts =
        await findChannelDataConflicts({
          db,
          capPlanId: target,
          migrations,
        });

      if (conflicts.length > 0) {
        return res.status(409).json({
          message:
            "The channel rename was not saved because duplicate forecast or pattern records exist for the same channel and date. Resolve the conflicts before trying again.",

          conflicts:
            conflicts.slice(0, 50),
        });
      }

      /*
      * Migrate legacy name-based records before
      * saving the renamed channel configuration.
      */
      const channelMigration =
        await migrateChannelData({
          db,
          capPlanId: target,
          migrations,
          username:
            verification.user.username,
        });

      const update =
        await db
          .collection("capPlans")
          .updateOne(
            {
              _id:
                capPlanObjectId,
            },
            {
              $set: {
                ...payload,

                language:
                  language._id,

                lastUpdated:
                  new Date(),

                updatedBy:
                  verification.user
                    .username,
              },
            }
          );

      return res.status(200).json({
        message:
          channelMigration
            .renamedChannels
            .length > 0
            ? `Update completed. ${channelMigration.renamedChannels.length} channel rename(s) were applied to existing forecast and pattern records.`
            : "Update Completed!",

        verification,
        update,
        channelMigration,
      });
    }

    return res
      .status(
        verification.verified
          ? 403
          : 401
      )
      .json(verification);
  }

  case "DELETE": {
    if (
      verification.verified &&
      (await verifyPermissions(
        ROLES.ADMIN,
        null,
        db,
        headers.authorization
      ))
    ) {
      const remove = target
        ? await db
            .collection("capPlans")
            .deleteOne({
              _id: new ObjectId(
                target
              ),
            })
        : {
            message:
              "Nothing to Remove",
          };

      return res.status(200).json({
        message: "Remove Completed!",
        verification,
        remove,
      });
    }

    return res
      .status(
        verification.verified
          ? 403
          : 401
      )
      .json(verification);
  }

  default:
    res.setHeader("Allow", [
      "POST",
      "PUT",
      "DELETE",
    ]);

    return res.status(405).json({
      message:
        "Method not Allowed, use POST, PUT or DELETE only",
    });
  }
}
