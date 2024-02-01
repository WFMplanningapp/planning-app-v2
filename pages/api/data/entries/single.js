import { connectToDatabase } from "../../../../lib/mongodb"
import { verifySession } from "../../../../lib/verification"

export default async function handler(req, res) {
	const { query, method, body, headers } = req

	console.log(headers)

	let payload = body.payload

	const { client, db } = await connectToDatabase()

	let verification = await verifySession(db, headers.authorization)

	if (method === "POST") {
		if (verification.verified && verification.permission <= 4) {
			if (payload) {
				delete payload._id

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
	} else {
		//BAD REQUEST
		res.status(405).json({ message: "Method not Allowed, use POST only" })
	}
}
