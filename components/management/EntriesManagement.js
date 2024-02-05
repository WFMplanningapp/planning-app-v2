import { useEffect, useState } from "react"
import { useAuth } from "../../contexts/authContext"

import { FaLock } from "react-icons/fa"
import CSVUploader from "../files/CSVUploader"

const EntriesManagement = ({ data }) => {
  const [upload, setUpload] = useState([])
  const [valid, setValid] = useState(false)

  const [staffUpload, setStaffUpload] = useState([])
  const [staffValid, setStaffValid] = useState(false)

  const auth = useAuth()

  useEffect(() => {
    const isValid = (upload) => {
      let hasInvalidField = false
      let hasWeek = 0
      let hasTarget = 0
      Object.keys(upload[0]).forEach((key) => {
        if (["capPlan", "lob", "project"].includes(key)) {
          hasTarget++
        } else if (key === "week") {
          hasWeek++
        } else {
          let found = data.fields.find((field) => field.internal === key)
          if (!found) {
            hasInvalidField = true
          }
        }
      })

      let valid = hasTarget === 1 && hasWeek === 1 && !hasInvalidField

      if (!valid) {
        alert("Invalid Upload File")
      }

      return valid
    }

    upload[0] ? setValid(isValid(upload)) : setValid(false)
  }, [upload])

  useEffect(() => {
    const isValid = (staffUpload) => {
      let hasInvalidField = false
      let hasWeek = 0,
        hasTarget = 0,
        hasName = 0
      Object.keys(staffUpload[0]).forEach((key) => {
        if (key === "capPlan") {
          hasTarget++
        } else if (key === "week") {
          hasWeek++
        } else if (key === "name") {
          hasName++
        } else {
          let found = ["volumes", "aht"].includes(key)
          if (!found) {
            hasInvalidField = true
          }
        }
      })

      console.log(hasTarget, hasWeek, hasName, hasInvalidField)

      let valid =
        hasTarget === 1 && hasWeek === 1 && hasName === 1 && !hasInvalidField

      if (!valid) {
        alert("Invalid Upload File")
      }

      return valid
    }

    staffUpload[0] ? setStaffValid(isValid(staffUpload)) : setStaffValid(false)
  }, [staffUpload])

  //HANDLERS
  const handleSubmit = async (type) => {
    console.log("UPLOAD LENGTH", upload.length)
    if (type === "standard") {
      if(upload.length <= 500){
        await fetch(`/api/data/entries/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({ payloads: upload }),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log(data.message)
            alert(data.message)
          })
          .catch((err) => console.log(err))
      }
     else {
      let mult = Math.trunc(upload.length/500)
      console.log("MULT", upload.length)
      for(let i = 0; i <= mult ; i++){
        console.log("FETCH #", i)
        await fetch(`/api/data/entries/bulk`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({ payloads: upload.slice(i * 500, (i+1)*500) }),
        }).then((response) => response.json())
        .then((data) => {
          console.log(data.message)
          if(i === mult){
            alert(`Uploaded ${mult + 1} batches!`)
          }
        })
        .catch((err) => console.log(err))
      }}
    }
  
  }

  const handleSubmitStaff = (type) => {
    if (type === "planned") {
      staffUpload.forEach((row) =>
        fetch(
          `/api/data/entries/planned?week=${row.week}&capPlan=${row.capPlan}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth.authorization(),
            },
            body: JSON.stringify({
              payload: {
                name: row.name,
                aht: row.aht,
                volumes: row.volumes,
              },
            }),
          }
        )
          .then((response) => response.json())
          .then((data) => {
            console.log(data.message)
          })
          .catch((err) => console.log(err))
      )
    } else if (type === "actual") {
      staffUpload.forEach((row) =>
        fetch(
          `/api/data/entries/actual?week=${row.week}&capPlan=${row.capPlan}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth.authorization(),
            },
            body: JSON.stringify({
              payload: {
                name: row.name,
                aht: row.aht,
                volumes: row.volumes,
              },
            }),
          }
        )
          .then((response) => response.json())
          .then((data) => {
            console.log(data.message)
          })
          .catch((err) => console.log(err))
      )
    }
    alert("Submitted bulk import, check console for logs")
  }

  return (
    <>
      {auth.allowedAdmin ? (
        <div>
          {/*////////////////////////////////////////////////////// BULK UPLOAD ////////////////////////////////////////////////*/}
          <div className="columns is-multiline">
            <div className="column">
              <label className="label">Bulk Upload</label>
              <CSVUploader
                removeHandler={() => setUpload([])}
                loadedHandler={(csv) => setUpload(csv)}
                label={"capPlan (ObjId) - week (####w#) - [fields...]"}
              ></CSVUploader>
              <button
                className="button is-small m-1 is-primary is-rounded"
                onClick={() => {
                  handleSubmit("standard")
                }}
                disabled={
                  !(
                    valid &&
                    upload[0] &&
                    Object.keys(upload[0]).includes("capPlan")
                  )
                }
              >
                Upload
              </button>

              <br></br>
              <br></br>
            </div>
            <div className="column is-narrow has-text-right">
              <label className="label">Field Check</label>

              {upload.length ? (
                <div>
                  {Object.keys(upload[0]).map((header) => (
                    <div key={"uploadField-" + header}>
                      {header}
                      {data.fields.find(
                        (field) => field.internal === header
                      ) ? (
                        <span className="tag is-success ml-2">Valid</span>
                      ) : ["capPlan", "lob", "project", "week"].includes(
                          header
                        ) ? (
                        <span className="tag is-success ml-2">Valid</span>
                      ) : (
                        <span className="tag is-danger ml-2">Invalid</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tag m-auto has-text-right">No upload</p>
              )}
            </div>
            <div className="column is-narrow has-text-right">
              <label className="label">Upload Stats</label>

              {upload.length ? (
                <div>
                  <div>
                    Entries{" "}
                    <span className="tag is-info ml-2">
                      {upload.length || 0}
                    </span>
                  </div>
                  <div>
                    Fields{" "}
                    <span className="tag is-info ml-2">
                      {Object.keys(upload[0]).length || 0}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="tag m-auto has-text-right">No upload</p>
              )}
            </div>
          </div>
          {/*////////////////////////////////////////////////////// PLANNED UPLOAD ////////////////////////////////////////////////*/}
          <div className="columns is-multiline">
            <div className="column">
              <label className="label">Volumes & AHT Upload</label>
              <CSVUploader
                removeHandler={() => setStaffUpload([])}
                loadedHandler={(csv) => setStaffUpload(csv)}
                label={
                  'capPlan (ObjId) - week (YYYYw#) - name (channel name) - volumes (#) - aht (#")'
                }
              ></CSVUploader>
              <button
                className="button is-small m-1 is-primary is-rounded"
                onClick={() => {
                  handleSubmitStaff("planned")
                }}
                disabled={
                  !(
                    staffValid &&
                    staffUpload[0] &&
                    Object.keys(staffUpload[0]).includes("capPlan")
                  )
                }
              >
                Upload Planned
              </button>
              <button
                className="button is-small m-1 is-primary is-rounded"
                onClick={() => {
                  handleSubmitStaff("actual")
                }}
                disabled={
                  !(
                    staffValid &&
                    staffUpload[0] &&
                    Object.keys(staffUpload[0]).includes("capPlan")
                  )
                }
              >
                Upload Actual
              </button>

              <br></br>
              <br></br>
            </div>
            <div className="column is-narrow has-text-right">
              <label className="label">Field Check</label>

              {staffUpload.length ? (
                <div>
                  {Object.keys(staffUpload[0]).map((header) => (
                    <div key={"uploadField-" + header}>
                      {header}
                      {["volumes", "aht"].find((field) => field === header) ? (
                        <span className="tag is-success ml-2">Valid</span>
                      ) : ["capPlan", "week", "name"].includes(header) ? (
                        <span className="tag is-success ml-2">Valid</span>
                      ) : (
                        <span className="tag is-danger ml-2">Invalid</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="tag m-auto has-text-right">No upload</p>
              )}
            </div>
            <div className="column is-narrow has-text-right">
              <label className="label">Upload Stats</label>

              {staffUpload.length ? (
                <div>
                  <div>
                    Entries{" "}
                    <span className="tag is-info ml-2">
                      {staffUpload.length || 0}
                    </span>
                  </div>
                  <div>
                    Fields{" "}
                    <span className="tag is-info ml-2">
                      {Object.keys(staffUpload[0]).length || 0}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="tag m-auto has-text-right">No upload</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="message is-danger is-size-5 px-5 py-5">
          <span className="">
            <FaLock />
          </span>{" "}
          UNAUTHORIZED ACCESS
        </div>
      )}
    </>
  )
}

export default EntriesManagement
