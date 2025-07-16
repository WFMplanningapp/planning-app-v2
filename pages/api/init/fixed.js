import fields from "../../../data-init/fields.json"
import languages from "../../../data-init/languages.json"
import weeks from "../../../data-init/weeks.json"
import { connectToDatabase } from "../../../lib/mongodb"
import { ObjectId } from "mongodb"

export default async function handler(req, res) {
	const { client, db } = await connectToDatabase()
	console.log(client)

	if (client) {
		const options = { upsert: true }

		/*await db.collection("fields").insertMany(
			fields.map((item) => ({ ...item, _id: ObjectId(item._id["$oid"]) })),
			{ ordered: false }
		)

		await db.collection("languages").insertMany(
			languages.map((item) => ({ ...item, _id: ObjectId(item._id["$oid"]) })),
			{ ordered: false }
		)*/

		await db.collection("weeks").insertMany(
			weeks.map((item) => ({
				...item,
				_id: ObjectId(item._id["$oid"]),
				firstDate: item.firstDate["$date"],
			})),
			{ ordered: false }
		)

		res.status(200).json({
			message: `Updated Entry in Database!`,
			inserted: "something",
		})
	} else {
		//BAD REQUEST
		res.status(405).json({ message: "Method not Allowed, use POST only" })
	}
}
