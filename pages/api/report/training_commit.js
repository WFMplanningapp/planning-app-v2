import { connectToDatabase } from "../../../lib/mongodb"

export default async function handler(req, res) {
	const { query, method, body } = req

	const { client, db } = await connectToDatabase()

	if (method === "GET") {
		let output = await db
			.collection("capEntries")
			.aggregate([
				{
					$match: {
						trCommit: { $exists: 1 },
					},
				},
				{ $addFields: { capPlanId: { $toObjectId: "$capPlan" } } },
				{
					$lookup: {
						from: "weeks",
						localField: "week",
						foreignField: "code",
						as: "weeks",
					},
				},
				{
					$lookup: {
						from: "capPlans",
						localField: "capPlanId",
						foreignField: "_id",
						as: "capPlans",
					},
				},
				{
					$project: {
						trCommit: 1,
						week: 1,
						weekDoc: { $arrayElemAt: ["$weeks", 0] },
						capPlanDoc: { $arrayElemAt: ["$capPlans", 0] },
					},
				},
				{ $addFields: { lobObjId: { $toObjectId: "$capPlanDoc.lob" } } },
				{
					$lookup: {
						from: "lobs",
						localField: "lobObjId",
						foreignField: "_id",
						as: "lobs",
					},
				},
				{
					$addFields: {
						languageObjId: { $toObjectId: "$capPlanDoc.language" },
					},
				},
				{
					$lookup: {
						from: "languages",
						localField: "languageObjId",
						foreignField: "_id",
						as: "langs",
					},
				},
				{
					$project: {
						trCommit: 1,
						week: 1,
						weekDoc: 1,
						capPlanDoc: 1,
						lobDoc: { $arrayElemAt: ["$lobs", 0] },
						langDoc: { $arrayElemAt: ["$langs", 0] },
					},
				},
				{ $addFields: { projectObjId: { $toObjectId: "$lobDoc.project" } } },
				{
					$lookup: {
						from: "projects",
						localField: "projectObjId",
						foreignField: "_id",
						as: "projDoc",
					},
				},
				{
					$project: {
						Project_Name: { $arrayElemAt: ["$projDoc.name", 0] },
						Lob_Name: "$lobDoc.name",
						CapPlan_Name: "$capPlanDoc.name",
						Language: "$langDoc.set",
						Start_Date: {
							$dateToString: { format: "%Y-%m-%d", date: "$weekDoc.firstDate" },
						},
						trCommit: 1,
					},
				},
			])
			.toArray()

		res.status(200).json({
			message: `Retrieved Selected Structures!`,
			data: output,
		})
	} else {
		//BAD REQUEST
		res.status(405).json({ message: "Method not Allowed, use GET only" })
	}
}
