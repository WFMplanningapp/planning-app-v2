import { connectToDatabase } from "../../../../lib/mongodb";
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
  const { keys } = req.body; // [{capPlan, week}]
  if (!keys || !Array.isArray(keys)) return res.status(400).json({ message: "Invalid keys" });

  const { db } = await connectToDatabase();
  const orCondition = keys.map(({ capPlan, week }) => ({ capPlan, week }));

  const entries = await db.collection("capEntries").find({ $or: orCondition }).toArray();

  res.status(200).json(entries);
}