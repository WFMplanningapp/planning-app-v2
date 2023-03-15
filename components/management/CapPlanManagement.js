import { useState } from "react"
import { useAuth } from "../../contexts/authContext"
import useForm from "../../hooks/useForm"
import StructureDropdown from "../selection/StructureDropdown"

import { FaLock } from "react-icons/fa"

const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level: 1 },
  { name: "lob", default: null, required: true, type: "object", level: 2 },
  { name: "capPlan", default: null, required: true, type: "object", level: 3 },
  { name: "language", default: null, required: true, type: "object", level: 3 },
]

const formFields = [
  {
    name: "name",
    default: "",
    required: true,
    type: "text",
    label: "Capacity Plan Name",
    placeholder: "Capacity Plan Name",
  },
  {
    name: "active",
    default: "",
    required: false,
    type: "check",
    label: "Active",
    placeholder: null,
  },
  {
    name: "firstWeek",
    default: "",
    required: true,
    type: "text",
    label: "First Week (code)",
    placeholder: "First Week (YYYYw#)",
  },
  {
    name: "startingHC",
    default: 0,
    required: true,
    type: "number",
    label: "Starting HC",
  },
]

const CapPlanManagement = ({ data }) => {
  const [tab, setTab] = useState(1)

  const auth = useAuth()

  const selection = useForm({
    fields: selectionFields,
  })

  const form = useForm({
    fields: formFields,
  })

  //HANDLERS
  const handleSubmit = async (action) => {
    let payload = {
      ...form.getForm(),
    }

    switch (action) {
      case "ADD":
        await fetch(`/api/data/management/capPlan`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({
            payload,
            lob: selection.get("lob"),
            language: selection.get("language"),
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            console.log(data.message)
            form.resetAll()
          })
          .catch((err) => console.log(err))
        break

      case "EDIT":
        await fetch(
          `/api/data/management/capPlan?id=${
            selection.get("capPlan") && selection.get("capPlan")._id
          }`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth.authorization(),
            },
            body: JSON.stringify({ payload }),
          }
        )
          .then((response) => response.json())
          .then((data) => {
            console.log(data.message)
            form.resetAll()
          })
          .catch((err) => console.log(err))
        break

      case "REMOVE":
        await fetch(
          `/api/data/management/capPlan?id=${
            selection.get("capPlan") && selection.get("capPlan")._id
          }`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth.authorization(),
            },
          }
        )
          .then((response) => response.json())
          .then((data) => {
            console.log(data.message)
            form.resetAll()
          })
          .catch((err) => console.log(err))
        break

      case "CLEANUP":
        await fetch(
          `/api/data/entries/cleanup?capPlan=${
            selection.get("capPlan") && selection.get("capPlan")._id
          }`,
          {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth.authorization(),
            },
          }
        )
          .then((response) => response.json())
          .then((data) => {
            alert(data.message)
            console.log("deleted: " + data.response.deletedCount)
            form.resetAll()
          })
          .catch((err) => console.log(err))
        break
    }
    selection.resetOne("capPlan")
    data.refresh()
  }

  return (
    <>
      <div className="tabs">
        <ul>
          <li className={tab === 1 ? "is-active" : ""} key={1}>
            <a
              onClick={() => {
                setTab(1)
                form.resetAll()
                selection.resetAll()
              }}
            >
              Add
            </a>
          </li>
          <li className={tab === 2 ? "is-active" : ""} key={2}>
            <a
              onClick={() => {
                setTab(2)
                form.resetAll()
                selection.resetAll()
              }}
            >
              Edit
            </a>
          </li>

          <li className={tab === 3 ? "is-active" : ""} key={3}>
            <a
              onClick={() => {
                setTab(3)
                form.resetAll()
                selection.resetAll()
              }}
            >
              Remove
            </a>
          </li>
        </ul>
      </div>
      {/*TABS*/}
      {tab === 1 ? (
        <div id="add-tab">
          <div id="add-selection" className="columns">
            <div className="column field">
              <label className="label">Selection</label>
              <StructureDropdown
                structureName="project"
                selection={selection}
                form={form}
                data={data && data.projects}
                disabled={false}
                reset={["lob", "capPlan"]}
                callback={(f) => {
                  f.resetAll()
                }}
              />
              <StructureDropdown
                structureName="lob"
                selection={selection}
                form={form}
                data={
                  data &&
                  selection.get("project") &&
                  data.lobs.filter(
                    (lob) => lob.project === selection.get("project")._id
                  )
                }
                reset={["capPlan"]}
                disabled={!selection.get("project")}
                callback={(f) => {
                  f.resetAll()
                }}
              />
              <StructureDropdown
                structureName="language"
                selection={selection}
                form={form}
                data={
                  data &&
                  data.languages.sort((a, b) =>
                    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                  )
                }
                disabled={!selection.get("project")}
                callback={(f) => {
                  f.resetAll()
                }}
              />
            </div>
          </div>
          <div id="add-form" className="columns is-multiline">
            <div className="column is-3">
              <label className="label">Plan Name</label>
              <div className="control is-small">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("name", e.target.value)}
                  value={form.get("name") || ""}
                  type="text"
                  placeholder="Plan Name"
                  required
                />
              </div>
            </div>

            <div className="column is-3">
              <label className="label">First Week</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("firstWeek", e.target.value)}
                  value={form.get("firstWeek") || ""}
                  type="text"
                  placeholder="First Week (code)"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">Starting HC</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("startingHC", e.target.value)}
                  value={form.get("startingHC") || ""}
                  type="number"
                  placeholder="Starting HC"
                  required
                />
              </div>
            </div>
            <div className="column is-12 ">
              <div className="control">
                <label className="label">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={form.get("active") || false}
                    onChange={() => {
                      form.set("active", !form.get("active"))
                    }}
                  ></input>
                  Active
                </label>
              </div>
            </div>
          </div>
          <div id="add-button">
            <button
              className="button is-small is-success is-rounded"
              onClick={() => handleSubmit("ADD")}
              disabled={
                !form.checkRequired() ||
                !selection.get("lob") ||
                !selection.get("language")
              }
            >
              Add Cap Plan
            </button>
          </div>
        </div>
      ) : tab === 2 ? (
        <div id="edit-tab">
          <div id="edit-selection" className="columns">
            <div className="column field">
              <label className="label">Selection</label>
              <StructureDropdown
                structureName="project"
                selection={selection}
                form={form}
                data={data && data.projects}
                disabled={false}
                reset={["lob", "capPlan"]}
                callback={(f) => {
                  f.resetAll()
                }}
              />
              <StructureDropdown
                structureName="lob"
                selection={selection}
                form={form}
                reset={["capPlan"]}
                data={
                  data &&
                  selection.get("project") &&
                  data.lobs.filter(
                    (lob) => lob.project === selection.get("project")._id
                  )
                }
                disabled={!selection.get("project")}
                callback={(f) => {
                  f.resetAll()
                }}
              />
              <StructureDropdown
                structureName="capPlan"
                selection={selection}
                                  form={form}
                                  reset={["language"]}
                data={
                  data &&
                  selection.get("lob") &&
                  data.capPlans.filter(
                    (capPlan) => capPlan.lob === selection.get("lob")._id
                  )
                }
                  disabled={!selection.get("lob")}
                  callback={(f) => {
                    f.resetAll()
                  }}
               />
              <StructureDropdown
                structureName="language"
                selection={selection}
                form={form}
                data={
                  data &&
                  data.languages.sort((a, b) =>
                    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                  )
                }
                disabled={!selection.get("capPlan")}
                callback={(f, s) => {
                  f.setMany({
                    name: s.name,
                    firstWeek: s.firstWeek,
                    startingHC: s.startingHC,
                    active: s.active,
                   })
                  }}
                />            
            </div>
          </div>
          <div id="edit-form" className="columns is-multiline">
            <div className="column is-3">
              <label className="label">Plan Name</label>
              <div className="control is-small">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("name", e.target.value)}
                  value={form.get("name") || ""}
                  type="text"
                  placeholder="Plan Name"
                  required
                />
              </div>
            </div>

            <div className="column is-3">
              <label className="label">First Week</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("firstWeek", e.target.value)}
                  value={form.get("firstWeek") || ""}
                  type="text"
                  placeholder="First Week (code)"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">Starting HC</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("startingHC", e.target.value)}
                  value={form.get("startingHC") || ""}
                  type="number"
                  placeholder="Starting HC"
                  required
                />
              </div>
            </div>
            <div className="column is-12 ">
              <div className="control">
                <label className="label">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={form.get("active") || false}
                    onChange={() => {
                      form.set("active", !form.get("active"))
                    }}
                  ></input>
                  Active
                </label>
              </div>
            </div>
          </div>
          <div id="edit-button">
            <button
              className="button is-small is-warning is-rounded"
              onClick={() => handleSubmit("EDIT")}
              disabled={!form.checkRequired() || !selection.get("capPlan")}
            >
              Edit Cap Plan
            </button>
          </div>
        </div>
      ) : tab === 3 && auth.permission(1) ? (
        <div id="remove-tab">
          <div className="columns">
            <div className="column field">
              <label className="label">Selection</label>
              <StructureDropdown
                structureName="project"
                selection={selection}
                form={form}
                data={data && data.projects}
                disabled={false}
                reset={["lob"]}
                callback={(f) => {
                  f.resetAll()
                }}
              />
              <StructureDropdown
                structureName="lob"
                selection={selection}
                form={form}
                data={
                  data &&
                  selection.get("project") &&
                  data.lobs.filter(
                    (lob) => lob.project === selection.get("project")._id
                  )
                }
                disabled={!selection.get("project")}
                callback={(f) => {
                  f.resetAll()
                }}
              />
              <StructureDropdown
                structureName="capPlan"
                selection={selection}
                form={form}
                data={
                  data &&
                  selection.get("lob") &&
                  data.capPlans.filter(
                    (capPlan) => capPlan.lob === selection.get("lob")._id
                  )
                }
                disabled={!selection.get("lob")}
                callback={(f, s) => {
                  f.setMany({
                    name: s.name,
                    firstWeek: s.firstWeek,
                    startingHC: s.startingHC,
                    active: s.active,
                  })
                }}
              />
            </div>
          </div>
          <div>
            <button
              className="button is-small is-danger is-rounded"
              onClick={() => handleSubmit("REMOVE")}
              disabled={!selection.get("capPlan")}
            >
              Remove Cap Plan
            </button>
            <button
              className="button is-small is-danger is-light is-rounded"
              onClick={() => handleSubmit("CLEANUP")}
              disabled={!selection.get("capPlan")}
            >
              Cleanup Entries
            </button>
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

export default CapPlanManagement
