import { connectToDatabase } from "../../../lib/mongodb"
export default async function handler(req, res) {
	const { query, method, body } = req

	const { client, db } = await connectToDatabase()

	if (method === "GET") {
		if (query) {
			let output = await db
				.collection("capPlans")
				.aggregate([
					{ $addFields: { lobObjId: { $toObjectId: "$lob" } } },
					{
						$lookup: {
							from: "lobs",
							localField: "lobObjId",
							foreignField: "_id",
							as: "lobDoc",
						},
					},
					{ $addFields: { languageObjId: { $toObjectId: "$language" } } },
					{
						$lookup: {
							from: "languages",
							localField: "languageObjId",
							foreignField: "_id",
							as: "langDoc",
						},
					},
					{
						$project: {
							name: 1,
							lobDoc: { $arrayElemAt: ["$lobDoc", 0] },
							langDoc: { $arrayElemAt: ["$langDoc", 0] },
							operationDays: 1,
							fteHoursWeekly: 1,
							pricingModel: 1,
							active: 1,

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
							Project_BU: { $arrayElemAt: ["$projDoc.bUnit", 0] },
							Lob_Name: "$lobDoc.name",
							CapPlan_Name: "$name",
							Language: "$langDoc.set",
							Country: "$lobDoc.country",
							Operation_Days: "$operationDays",
							FTEHours_Weekly: "$fteHoursWeekly",
							Pricing_Model: "$pricingModel",
							Active: "$active",
						},
					},
				])
				.toArray()

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
