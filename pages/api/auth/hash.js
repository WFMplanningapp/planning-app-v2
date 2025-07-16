import { hashSync, compareSync } from "bcrypt"

export default async function handler(req, res) {
  const { query } = req

  let hashed = hashSync(query.string, 10)

  let compare = compareSync(
    query.string,
    "$2b$10$ERrEWVvCUo8WBhQ3OGCAzudkbUKdFfM7fOQxIE7dnkPetq.vL3yha"
  )

  res.status(200).json({ message: "String Hashed!", data: hashed, compare })
}
