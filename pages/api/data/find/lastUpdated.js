/**
query: field1=field1value, field2=field1value, ...
*/

import { connectToDatabase } from "../../../../lib/mongodb"

export default async function handler(req, res) {
  const { query, method, body } = req

  //console.log(body)

  //console.log(query)

  let capPlan = query.capPlan

  const { client, db } = await connectToDatabase()

  if (method === "GET") {
    if (capPlan) {
      let entries = await db
        .collection("capEntries")
        .find({ capPlan: capPlan, lastUpdated: { $exists: 1 } })
        .toArray()

      let lastUpdatedEntry = entries.reduce(
        (a, b) => (a.lastUpdated > b.lastUpdated ? a : b),
        {}
      )

      res.status(200).json({
        message: `Retrieved Last Updated!`,
        data: lastUpdatedEntry
          ? {
              lastUpdated: lastUpdatedEntry.lastUpdated,
              updatedBy: lastUpdatedEntry.updatedBy,
              updateType: lastUpdatedEntry.updateType,
            }
          : null,
      })
    } else {
      res.status(200).json({
        message: `No Cap Plan Selected`,
        data: null,
      })
    }
  } else {
    //BAD REQUEST
    res.status(405).json({ message: "Method not Allowed, use GET only" })
  }
}
