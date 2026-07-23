import { connectToDatabase } from "../../../../lib/mongodb"
import { verifySession, verifyPermissions, ROLES } from "../../../../lib/verification"
import { ObjectId } from "mongodb"
import { validatePayload } from "../../../../lib/fieldValidation"

export default async function handler(req, res) {
  const { query, method, body, headers } = req

  let payload = body.payload

  const { client, db } = await connectToDatabase()

  let verification = await verifySession(db, headers.authorization)

  if (method === "POST") {

    if (verification.verified && verifyPermissions(ROLES.GUEST, null, db, headers.authorization)) {

      if (payload) {
        delete payload._id

        // ============================
        // SERVER-SIDE VALIDATION
        // ============================
        const validation = validatePayload(payload);

        if (!validation.valid) {
          const errorDetails = validation.errors.map(
            (e) => `${e.field}: "${e.value}" — ${e.error}`
          );

          return res.status(400).json({
            message: `Validation failed: ${validation.errors.length} error(s).`,
            errors: errorDetails,
          });
        }

        const update = {
          $set: {
            ...payload,
            lastUpdated: new Date(),
            updatedBy: verification.user.username,
            updateType: "single",
          },
        }
        const options = { upsert: true }
        let response = await db
          .collection("capEntries")
          .updateOne(
            { capPlan: payload.capPlan, week: payload.week },
            update,
            options
          )
        res.status(200).json({
          message: `Updated Entry in Database!`,
          inserted: payload,
          response: response,
        })
      } else {
        res.status(200).json({
          message: `Nothing to Update!`,
          data: null,
        })
      }
    } else {
      res.status(401).json(verification)
    }
  } else if (method === "PATCH") {
    const { _id, fieldsToDelete, payload } = body;
    console.log("PATCH received:", { _id, fieldsToDelete, payload });

    if (!_id) return res.status(400).json({ message: "Missing _id" });

    // ============================
    // SERVER-SIDE VALIDATION (PATCH)
    // ============================
    if (payload) {
      const validation = validatePayload(payload);

      if (!validation.valid) {
        const errorDetails = validation.errors.map(
          (e) => `${e.field}: "${e.value}" — ${e.error}`
        );

        return res.status(400).json({
          message: `Validation failed: ${validation.errors.length} error(s).`,
          errors: errorDetails,
        });
      }
    }

    let update = {};

    if (fieldsToDelete?.length) {
      let unsetObj = {};
      fieldsToDelete.forEach(field => unsetObj[field] = "");
      update.$unset = unsetObj;
    }
    if (payload && Object.keys(payload).length > 0) {
      if (payload._id) delete payload._id;
      fieldsToDelete?.forEach(field => delete payload[field]);
      update.$set = payload;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update or unset." });
    }

    console.log("Final Mongo update:", update);

    let result = await db.collection("capEntries").updateOne(
      { _id: new ObjectId(_id) },
      update
    );
    console.log("Mongo result:", result);

    return res.status(200).json({ message: "Update completed.", mongo: result });

  } else {
    res.status(405).json({ message: "Method not Allowed, use GET/PATCH only" })
  }
}