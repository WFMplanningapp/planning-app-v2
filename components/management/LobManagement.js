import { useState } from "react"
import { useAuth } from "../../contexts/authContext"
import useForm from "../../hooks/useForm"
import StructureDropdown from "../selection/StructureDropdown"

import { FaLock } from "react-icons/fa"

const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level: 1 },
  { name: "lob", default: null, required: true, type: "object", level: 2 },
]

const formFields = [
  {
    name: "name",
    default: "",
    required: true,
    type: "text",
    label: "Lob Name",
    placeholder: "Lob Name",
  },
  {
    name: "trWeeks",
    default: "",
    required: false,
    type: "text",
    label: "Training Weeks",
    placeholder: "Training Weeks",
  },
  {
    name: "ocpWeeks",
    default: "",
    required: false,
    type: "text",
    label: "OCP Weeks",
    placeholder: "OCP Weeks",
  },
]

const LobManagement = ({ data }) => {
  const [tab, setTab] = useState(1)

  //AUTH
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
      project: selection.get("project") ? selection.get("project")._id : null,
    }
    switch (action) {
      case "ADD":
        await fetch(`/api/data/management/lob`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({ payload }),
        })
          .then((response) => response.json())
          .then((data) => {
            alert(data.message)
            form.resetAll()
          })
          .catch((err) => alert(err))
        break

      case "EDIT":
        await fetch(
          `/api/data/management/lob?id=${
            selection.get("lob") && selection.get("lob")._id
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
            alert(data.message)
            form.resetAll()
          })
          .catch((err) => alert(err))
        break

      case "REMOVE":
        await fetch(
          `/api/data/management/lob?id=${
            selection.get("lob") && selection.get("lob")._id
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
            form.resetAll()
          })
          .catch((err) => alert(err))
        break
    }
    selection.resetOne("lob")
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
                reset={["lob"]}
                callback={(f) => {
                  f.resetAll()
                }}
              />
            </div>
          </div>
          <div id="add-form" className="columns">
            <div className="column is-3">
              <label className="label">Lob Name</label>
              <div className="control is-small">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("name", e.target.value)}
                  value={form.get("name") || ""}
                  type="text"
                  placeholder="Lob Name"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">Training Weeks</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("trWeeks", e.target.value)}
                  value={form.get("trWeeks") || ""}
                  type="text"
                  placeholder="Training Weeks"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">OCP Weeks</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("ocpWeeks", e.target.value)}
                  value={form.get("ocpWeeks") || ""}
                  type="text"
                  placeholder="OCP Weeks"
                  required
                />
              </div>
            </div>
          </div>
          <div id="add-button">
            <button
              className="button is-small is-success is-rounded"
              onClick={() => handleSubmit("ADD")}
              disabled={!form.checkRequired() || !selection.get("project")}
            >
              Add LOB
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
                callback={(f, s) => {
                  f.setMany({
                    name: s.name,
                    trWeeks: s.trWeeks,
                    ocpWeeks: s.ocpWeeks,
                  })
                }}
              />
            </div>
          </div>
          <div id="edit-form" className="columns">
            <div className="column is-3">
              <label className="label">Lob Name</label>
              <div className="control is-small">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("name", e.target.value)}
                  value={form.get("name") || ""}
                  type="text"
                  placeholder="Lob Name"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">Training Weeks</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("trWeeks", e.target.value)}
                  value={form.get("trWeeks") || ""}
                  type="text"
                  placeholder="Training Weeks"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">OCP Weeks</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("ocpWeeks", e.target.value)}
                  value={form.get("ocpWeeks") || ""}
                  type="text"
                  placeholder="OCP Weeks"
                  required
                />
              </div>
            </div>
          </div>
          <div id="edit-button">
            <button
              className="button is-small is-warning is-rounded"
              onClick={() => handleSubmit("EDIT")}
              disabled={!form.checkRequired() || !selection.get("lob")}
            >
              Edit LOB
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
                callback={(f, s) => {
                  f.setMany({
                    projectName: s.name,
                    bUnit: s.bUnit,
                  })
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
                callback={(f, s) => {
                  f.setMany({
                    name: s.name,
                    trWeeks: s.trWeeks,
                    ocpWeeks: s.ocpWeeks,
                  })
                }}
              />
            </div>
          </div>
          <div>
            <button
              className="button is-small is-danger is-rounded"
              onClick={() => handleSubmit("REMOVE")}
              disabled={!selection.checkRequired()}
            >
              Remove Project
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

export default LobManagement
