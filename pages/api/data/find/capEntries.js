/**
query: field1=field1value, field2=field1value, ...
*/

import { connectToDatabase } from "../../../../lib/mongodb"

export default async function handler(req, res) {
  const { query, method, body } = req

  console.log(body)

  console.log(query)

  const { client, db } = await connectToDatabase()

  if (method === "GET") {
    if (query) {
      let output = await db.collection("capEntries").find(query).toArray()

      res.status(200).json({
        message: `Retrieved Selected Structures!`,
        data: output,
      })
    } else {
      res.status(200).json({
        message: `No Structures Selected`,
        data: null,
      })
    }
  } else {
    //BAD REQUEST
    res.status(405).json({ message: "Method not Allowed, use GET only" })
  }
}
