import { connectToDatabase } from "../../../lib/mongodb"

/**
query: selected (structureName1+structureName2+....)
*/

export default async function handler(req, res) {
	const { query, method, body } = req

	console.log(body)

	console.log(query)

	const { client, db } = await connectToDatabase()

	if (method === "GET") {
		let selected = query.selected ? query.selected.split(" ") : null
		if (selected) {
			let output = {}
			for (let i in selected) {
				output[selected[i]] = await db
					.collection(selected[i])
					.find({})
					.sort({ name: 1 })
					.toArray()
			}
			res.status(200).json({
				message: `Retrieved Selected Structures!`,
				data: JSON.parse(JSON.stringify(output)),
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
