import { connectToDatabase } from "../../../lib/mongodb"
import { generateCapacity } from "../../../lib/capacityCalculations"
import { ObjectId } from "mongodb"
import { isObjectLike } from "lodash"

export default async function handler(req, res) {
  const { query, method } = req

  const { client, db } = await connectToDatabase()

  let toWeek = query.to
  let fromWeek = query.from
  let selected = query.selected.split(" ")

  switch (method) {
    case "GET":
      let weeks = await db
        .collection("weeks")
        .find({})
        .sort({ firstDate: 1 })
        .toArray()

      console.log(selected)

      let multiple = []

      for await (let capPlan of selected) {
        console.log(capPlan)

        let found = await db
          .collection("capPlans")
          .findOne({ _id: ObjectId(capPlan) })

        console.log(found)

        if (found) {
          let entries = await db
            .collection("capEntries")
            .find({ capPlan: capPlan })
            .toArray()

          if (weeks && toWeek) {
            weeks = weeks.slice(
              0,
              1 + weeks.indexOf(weeks.find((week) => week.code === toWeek))
            )
          }

          let capacity = await generateCapacity(found, entries, weeks)

          if (capacity && fromWeek) {
            capacity = capacity.slice(
              0 + weeks.indexOf(weeks.find((week) => week.code === fromWeek))
            )
          }

          multiple.push({ capPlan: found, capacity })
        }
      }

      multiple = multiple
        .map(
          (item) =>
            item.capacity &&
            item.capacity.map((weekly) => ({
              ...weekly,
              week: weekly.week.code,
              capPlan: item.capPlan.name,
              capPlanId: item.capPlan._id,
              country: item.capPlan.country,
              Comment: null,
            }))
        )
        .flat()

      res
        .status(200)
        .json({ message: "Capacity Generated", multiple: multiple })

      break
    default:
      res.status(405).json({ message: "Method not Allowed, use GET only" })
  }
}
