import { useState, useEffect } from "react"
import { FaLock } from "react-icons/fa"
import { useAuth } from "../../contexts/authContext"

const headcountFields = [
  "attrition",
  "moveIN",
  "moveOUT",
  "loaIN",
  "loaOUT",
  "rwsIN",
  "rwsOUT",
  "rampDown",
]

const trainingFields = [
  "trCommit",
  "trGap",
  "trAttrition",
  "ocpAttrition",
  "trWeeks",
  "ocpWeeks",
]

const targetFields = ["billable", "forecasted", "budget", "required"]

/*const staffingFields = [
	"pAHT",
	"pVolumes",
	"pSL",
	"pTT",
	"pOccupancy",
	"pASA",
	"pEmVolumes",
	"pEmAHT",
]*/

const actualFields = ["actOff", "actAbs", "actAux"]

const EntryForm = ({ selection, week }) => {
  const [entry, setEntry] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [formInfo, setFormInfo] = useState({})

  const auth = useAuth()

  useEffect(() => {
    const fetchEntry = async () => {
      let fetched = await fetch(
        `api/data/find/capEntries?capPlan=${
          selection.get("capPlan")._id
        }&week=${week.code}`
      )
        .then((res) => res.json())
        .catch()

      console.log(fetched)
      let entries = fetched.data

      if (entries.length === 1) {
        setEntry(entries[0])
        setFormInfo({ Comment: entries[0]["Comment"] })
      } else if (entries.length > 1) {
        console.log(
          "Multiple Entries!",
          entries.map((entry) => entry.id)
        )
      } else if (entries.length === 0) {
        setFormInfo({})
        setEntry(null)
        console.log("No entry found")
      }
      setLoaded(true)
    }

    fetchEntry()
  }, [selection, week])

  const handleChange = (e, field, changeConfig) => {
    if (!changeConfig) {
      setFormInfo({ ...formInfo, [field]: e.target.value })
    } else {
      setFormInfo({
        ...formInfo,
        config: { ...formInfo.config, [field]: e.target.value },
      })
    }
  }

  const handleSubmit = () => {
    let newEntry = {}

    if (entry) {
      newEntry = entry
    } else {
      newEntry.capPlan = selection.get("capPlan")._id
      newEntry.week = week.code
    }

    newEntry = { ...newEntry, ...formInfo }

    Object.keys(newEntry).forEach((key) => {
      if (newEntry[key] === "delete") {
        newEntry[key] = ""
      }
    })

    fetch("/api/data/entries/single", {
      method: "POST",
      headers: {
        Authorization: auth.authorization(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        payload: newEntry,
      }),
    })
      .then((res) => res.json())
      .then((fetched) => {
        console.log(fetched.message)
        setEntry(newEntry)
        setFormInfo({ Comment: newEntry["Comment"] })
      })
      .catch()

    return
  }

  return (
    <>
      <div>
        <form className="is-size-7">
          <label>HEADCOUNT</label>
          <div className="columns is-multiline is-mobile pt-2">
            {headcountFields.map((field) => (
              <div
                key={`Col-${field}`}
                className="column is-6-mobile is-2 py-0"
              >
                <label>{field}</label>
                <div className="field has-addons">
                  <p className="control">
                    <input
                      readOnly={true}
                      className={`input is-rounded is-small has-text-light ${
                        entry && entry[field]
                          ? "has-background-info"
                          : "has-background-grey-lighter"
                      }`}
                      aria-label={field}
                      value={(entry && entry[field]) || "none"}
                    />
                  </p>
                  <p className="control">
                    <input
                      className={
                        "input is-rounded is-small " +
                        (formInfo[field] ? "is-danger" : "")
                      }
                      aria-label={field}
                      value={formInfo[field] || ""}
                      disabled={!week}
                      onChange={(e) => handleChange(e, field)}
                    />
                  </p>
                </div>
              </div>
            ))}
          </div>
          <label>TRAINING</label>
          <div className="columns is-multiline is-mobile pt-2">
            {trainingFields.map((field) => (
              <div
                key={`Col-${field}`}
                className="column is-6-mobile is-2 py-0"
              >
                <label>{field}</label>
                <div className="field has-addons">
                  <p className="control">
                    <input
                      readOnly={true}
                      className={`input is-rounded is-small has-text-light ${
                        entry && entry[field]
                          ? "has-background-info"
                          : "has-background-grey-lighter"
                      }`}
                      aria-label={field}
                      value={(entry && entry[field]) || "none"}
                    />
                  </p>
                  <p className="control">
                    <input
                      className={
                        "input is-rounded is-small " +
                        (formInfo[field] ? "is-danger" : "")
                      }
                      aria-label={field}
                      value={formInfo[field] || ""}
                      disabled={!week}
                      onChange={(e) => handleChange(e, field)}
                    />
                  </p>
                </div>
              </div>
            ))}
          </div>
          <label>TARGETS</label>
          <div className="columns is-multiline is-mobile pt-2">
            {targetFields.map((field) => (
              <div
                key={`Col-${field}`}
                className="column is-6-mobile is-2 py-0"
              >
                <label>{field}</label>
                <div className="field has-addons">
                  <p className="control">
                    <input
                      readOnly={true}
                      className={`input is-rounded is-small has-text-light ${
                        entry && entry[field]
                          ? "has-background-info"
                          : "has-background-grey-lighter"
                      }`}
                      aria-label={field}
                      value={(entry && entry[field]) || "none"}
                    />
                  </p>
                  <p className="control">
                    <input
                      className={
                        "input is-rounded is-small " +
                        (formInfo[field] ? "is-danger" : "")
                      }
                      aria-label={field}
                      value={formInfo[field] || ""}
                      disabled={!week}
                      onChange={(e) => handleChange(e, field)}
                    />
                  </p>
                </div>
              </div>
            ))}
          </div>

          <label>ACTUALS</label>
          <div className="columns is-multiline is-mobile pt-2">
            {actualFields.map((field) => (
              <div
                key={`Col-${field}`}
                className="column is-6-mobile is-2 py-0"
              >
                <label>{field}</label>
                <div className="field has-addons">
                  <p className="control">
                    <input
                      readOnly={true}
                      className={`input is-rounded is-small has-text-light ${
                        entry && entry[field]
                          ? "has-background-info"
                          : "has-background-grey-lighter"
                      }`}
                      aria-label={field}
                      value={(entry && entry[field]) || "none"}
                    />
                  </p>
                  <p className="control">
                    <input
                      className={
                        "input is-rounded is-small " +
                        (formInfo[field] ? "is-danger" : "")
                      }
                      aria-label={field}
                      value={formInfo[field] || ""}
                      disabled={!week}
                      onChange={(e) => handleChange(e, field)}
                    />
                  </p>
                </div>
              </div>
            ))}
          </div>

          <label>COMMENT</label>
          <div className="columns mb-0">
            <div key={`Col-Comment`} className="column is-12 pb-0">
              <div className="columns is-gapless is-fullwidth">
                <div className="column">
                  <textarea
                    readOnly={true}
                    className="textarea is-fullwidth has-background-grey-lighter has-text-light"
                    aria-label={"commeent-locked"}
                    value={(entry && entry["Comment"]) || "none"}
                  />
                </div>
                <div className="column">
                  <textarea
                    className={
                      "textarea is-fullwidth" +
                      (formInfo["Comment"] ? "is-danger" : "")
                    }
                    aria-label={"comment-change"}
                    value={formInfo["Comment"] || ""}
                    disabled={!week}
                    onChange={(e) => handleChange(e, "Comment")}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="columns has-text-right my-0">
            <div key={`Col-Button`} className="column is-12 py-0">
              <button
                type="button"
                className={`button is-fullwidth ${
                  auth.permission(3) ? "is-primary" : "is-danger"
                }`}
                onClick={handleSubmit}
                disabled={!auth.permission(3) || !loaded}
              >
                {auth.permission(3) ? (
                  "SUBMIT"
                ) : (
                  <span>
                    <FaLock className="mx-1" /> Unauthorized Access
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>

        <br></br>
      </div>
    </>
  )
}

export default EntryForm
