import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"
import { connectToDatabase } from "../../../../lib/mongodb"
import { ObjectId } from "mongodb"

/**
METHODS: POST(Add), PUT(Edit) DELETE(Remove)
PARAMS: id
BODY: payload
HEADER: authorization base 64 encoded
*/

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  //console.log(query, method, body, headers)

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  let target = query.id
  let payload = body.payload

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
        payload.project
          ? await db
              .collection("lobs")
              .insertOne({
                ...payload,
                createdAt: new Date(),
                createdBy:
                  verification.user
                    .username,
              })
          : {
              message:
                "Nothing to Insert",
            };

      return res.status(200).json({
        message:
          "Insert Completed!",
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
      const update =
        payload &&
        payload.name &&
        target
          ? await db
              .collection("lobs")
              .updateOne(
                {
                  _id: new ObjectId(
                    target
                  ),
                },
                {
                  $set: {
                    ...payload,
                    lastUpdated:
                      new Date(),
                    updatedBy:
                      verification.user
                        .username,
                  },
                }
              )
          : {
              message:
                "Nothing to Update",
            };

      return res.status(200).json({
        message:
          "Update Completed!",
        verification,
        update,
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
            .collection("lobs")
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
        message:
          "Remove Completed!",
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
