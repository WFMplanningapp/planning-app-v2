import Head from "next/head"
import { useState } from "react"
import useData from "../hooks/useData"
import useForm from "../hooks/useForm"
import StructureDropdown from "../components/selection/StructureDropdown"
import useWeeks from "../hooks/useWeeks"
import WeekDropdown from "../components/selection/WeekDropdown"
import Filter from "../components/selection/Filter"
import { CSVDownloader } from "react-papaparse"
import { FaLock } from "react-icons/fa"
import { useAuth } from "../contexts/authContext"

const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level: 1 },
  { name: "lob", default: null, required: true, type: "object", level: 2 },

  {
    name: "fromWeek",
    default: null,
    required: true,
    type: "object",
    level: 1,
  },
  { name: "toWeek", default: null, required: true, type: "object", level: 1 },
]

const Report = () => {
  const [fields, setFields] = useState([])
  const [report, setReport] = useState([])
  const [generated, setGenerated] = useState(false)

  const auth = useAuth()

  const data = useData([
    "countries",
    "projects",
    "lobs",
    "capPlans",
    "languages",
    "fields",
    "weeks",
  ])

  const weeks = useWeeks(
    data.weeks &&
      data.weeks.sort((a, b) =>
        a.firstDate > b.firstDate ? 1 : a.firstDate < b.firstDate ? -1 : 0
      )
  )

  const selection = useForm({
    fields: selectionFields,
  })

  const handleGenerate = async () => {
    let lobs = []

    if (selection.get("lob")._id) {
      lobs = data.lobs.filter((lob) => lob._id === selection.get("lob")._id)
    } else {
      lobs = data.lobs.filter(
        (lob) => lob.project === selection.get("project")._id
      )
    }

    console.log("LOBS:", lobs)

    let capPlans = lobs
      .map((lob) =>
        data.capPlans
          .filter((capPlan) => capPlan.lob === lob._id)
          .map((capPlan) => ({ _id: capPlan._id, name: capPlan.name }))
      )

      .flat()

    console.log("Cap Plans:", capPlans)

    await fetch(
      `/api/capacity/multiple?from=${selection.get("fromWeek").code}&to=${
        selection.get("toWeek").code
      }&selected=${capPlans.map((capPlan) => capPlan._id).join("+")}`
    )
      .then((res) => res.json())
      .then((data) => {
        setReport(
          data.multiple.map((weekly) => {
            let projection = {
              week_code: weekly.week,
              week_start: weekly.firstDate,
              cap_plan_name: weekly.capPlan,
              cap_plan_id: weekly.capPlanId,
            }

            fields.forEach((field) => {
              switch (field.payload.internal) {
                case "plannedAbs":
                case "plannedVac":
                case "actAbs":
                case "actVac":
                  projection[field.payload.internal] =
                    weekly[field.payload.internal] / 100 || null
                  break
                default:
                  projection[field.payload.internal] =
                    weekly[field.payload.internal] || null
              }
            })
            return projection
          })
        )
        setGenerated(true)
      })
      .catch((error) => console.log("ERROR:", error))
  }

  return (
    <>
      <Head>
        <title>Planning App | Capacity</title>
      </Head>
      <div>
        <h1 className="has-text-centered mb-2 is-size-5">REPORT</h1>
        <div className="column">
          {!auth.permission(auth.ROLES.MANAGER) ? (
            <div className="message is-danger is-size-5 px-5 py-5">
              <span className="">
                <FaLock />
              </span>{" "}
              UNAUTHORIZED ACCESS
            </div>
          ) : <div>
        <div className="columns">
          <div className="column field">
            <label className="label">Selection</label>
                     <StructureDropdown
                      structureName="project"
                      selection={selection}
                      data={
                          data &&
                          data.projects
                      }
                      disabled={false}
                      reset={["country", "lob", "capPlan"]}
                      callback={(f) => {
                          f.resetAll()
                      }}
                              />
                      <StructureDropdown
                          structureName="country"
                          selection={selection}
                          data={data &&
                              data.countries &&
                              selection.get("project") &&
                              data.countries.filter((country) => {
                                  const selectedProject = selection.get("project")._id;
                                  const projectLobs = data.lobs.filter((lob) => lob.project === selectedProject);
                                  console.log(projectLobs);
                                  return projectLobs.find(lob => lob.country === country.name);
                              })}
                          disabled={!selection.get("project")}
                          reset={["lob", "capPlan"]}
                          callback={(f) => {
                              f.resetAll()
                          }}
                      />
            <StructureDropdown
              structureName="lob"
              selection={selection}
              reset={["capPlan"]}
              data={
                data &&
                selection.get("country") && [
                  { name: "SELECT ALL" },
                  ...data.lobs.filter(
                      (lob) => lob.country === selection.get("country").name && lob.project === selection.get("project")._id
                  ),
                ]
              }
              callback={(f) => {
                setGenerated(false)
              }}
                          disabled={!selection.get("country") || data.lobs.filter(
                              (lob) => lob.country === selection.get("country").name && lob.project === selection.get("project")._id
                          ).length <= 0}
            />
          </div>
        </div>
        <div className="columns">
          <div className="column field">
            <label className="label">Weeks</label>
            <WeekDropdown
              fieldName="fromWeek"
              label="From-Week"
              form={selection}
              weekRange={weeks && weeks.getWeekRange("2021w1", null)}
              disabled={!selection.get("lob")}
              callback={(f, s) => {
                if (
                  f.get("toWeek") &&
                  s.firstDate > f.get("toWeek").firstDate
                ) {
                  f.setMany({ ...f.getForm(), toWeek: s, fromWeek: s })
                }

                setGenerated(false)
              }}
            />
            <WeekDropdown
              fieldName="toWeek"
              label="To-Week"
              form={selection}
              weekRange={weeks && weeks.getWeekRange("2021w1", null)}
              disabled={!selection.get("lob")}
              callback={(f, s) => {
                if (
                  f.get("fromWeek") &&
                  s.firstDate < f.get("fromWeek").firstDate
                ) {
                  f.setMany({ ...f.getForm(), toWeek: s, fromWeek: s })
                }
                setGenerated(false)
              }}
            />
            <button
              className="button is-small is-rounded is-info"
              onClick={() =>
                selection.setMany({
                  ...selection.getForm(),
                  fromWeek: weeks.getWeekRelative(parseFloat("-8")),
                  toWeek: weeks.getWeekRelative(parseFloat("16")),
                })
              }
            >
              Auto Weeks
            </button>
          </div>
        </div>
        <div className="columns">
          <div className="column field">
            <label className="label">Fields</label>
            <Filter
              items={
                data.fields &&
                data.fields
                  .sort((a, b) =>
                    a.order === b.order
                      ? 0
                      : parseInt(a.order) < parseInt(b.order)
                      ? -1
                      : 1
                  )
                  .map((field) => ({
                    name: field.external,
                    payload: field,
                  }))
              }
              styles={{
                button: "button is-small is-rounded mr-1 mb-1",
                selected: "is-danger",
              }}
              onChange={(selected) => {
                setFields(selected)
                setGenerated(false)
              }}
            />
          </div>
        </div>

        <div className="columns">
          <div className="column field">
            <button
              className="button is-primary is-small is-rounded"
              onClick={handleGenerate}
              disabled={!selection.checkRequired()}
            >
              Generate Report
            </button>
            <br></br>
            <br></br>
            {generated && selection.get("project") && selection.get("lob") && (
              <CSVDownloader
                filename={`Report_${selection
                  .get("project")
                  .name.split(" ")
                  .join("_")}_${
                  selection.get("lob").name === "SELECT ALL"
                    ? "All_LOBs"
                    : selection.get("lob").name.split(" ").join("_")
                }_(${new Date().toISOString()})`}
                data={() => {
                  return report
                }}
              >
                <button
                  className="button is-link is-small is-rounded"
                  disabled={!generated}
                >
                  Download
                </button>
              </CSVDownloader>
            )}
          </div>
        </div>
      </div>    
      }
        </div>
        </div>

      <br></br>
        <br></br>

    </>
  )
}

export default Report
