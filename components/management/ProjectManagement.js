import { useState } from "react"
import { useAuth } from "../../contexts/authContext"
import useForm from "../../hooks/useForm"
import StructureDropdown from "../selection/StructureDropdown"

import { FaLock } from "react-icons/fa"

const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level:1 },
]

const formFields = [
  {
    name: "name",
    default: "",
    required: true,
    type: "text",
    label: "Project Name",
    placeholder: "Project Name",
  },
  {
    name: "bUnit",
    default: "",
    required: true,
    type: "text",
    label: "Business Unit",
    placeholder: "Business Unit",
  },
]

const ProjectManagement = ({ data }) => {
  const [tab, setTab] = useState(1)

  //AUTH
  const auth = useAuth()

  //FORMS
  const selection = useForm({
    fields: selectionFields,
  })

  const form = useForm({
    fields: formFields,
  })

  //HANDLERS

  const handleSubmit = async (action) => {
    let payload = form.getForm()
    switch (action) {
      case "ADD":

        await fetch(`/api/data/management/project`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({ payload }),
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
          `/api/data/management/project?id=${
            selection.get("project") && selection.get("project")._id
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
        if (data && selection.get("project") && data.lobs.find(
          (lob) => lob.project === selection.get("project")._id
        )){
          alert("There are still one or more Lob/s associated with this Project. Please delete them before proceeding")
        } else {
          await fetch(
            `/api/data/management/project?id=${
              selection.get("project") && selection.get("project")._id
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
        }
        
        break
    }
    selection.resetOne("project")
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
          <div className="columns">
            <div className="column is-3">
              <label className="label">Project Name</label>
              <div className="control is-small">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("name", e.target.value)}
                  value={form.get("name") || ""}
                  type="text"
                  placeholder="Project Name"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">Business Unit</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("bUnit", e.target.value)}
                  value={form.get("bUnit") || ""}
                  type="text"
                  placeholder="Business Unit"
                  required
                />
              </div>
            </div>
            
          </div>
          <div>
            <button
              className="button is-small is-success is-rounded"
              onClick={() => handleSubmit("ADD")}
              disabled={!form.checkRequired()}
            >
              Add Project
            </button>
          </div>
        </div>
      ) : tab === 2 ? (
        <div id="edit-tab">
          <div className="columns">
            <div className="column field">
              <label className="label">Selection</label>
              <StructureDropdown
                structureName="project"
                selection={selection}
                form={form}
                data={data && data.projects 
                }
                disabled={false}
                callback={(f, s) => {
                  f.setMany({
                    name: s.name,
                    bUnit: s.bUnit,
                  })
                }}
              />
            </div>
          </div>
          <div className="columns">
            <div className="column is-3">
              <label className="label">Project Name</label>
              <div className="control is-small">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("name", e.target.value)}
                  value={form.get("name") || ""}
                  type="text"
                  placeholder="Project Name"
                  required
                />
              </div>
            </div>
            <div className="column is-3">
              <label className="label">Business Unit</label>
              <div className="control">
                <input
                  className="input is-small"
                  onChange={(e) => form.set("bUnit", e.target.value)}
                  value={form.get("bUnit") || ""}
                  type="text"
                  placeholder="Business Unit"
                  required
                />
              </div>
            </div>
          </div>
          <div>
            <button
              className="button is-small is-warning is-rounded"
              onClick={() => handleSubmit("EDIT")}
              disabled={!form.checkRequired() && !selection.checkRequired()}
            >
              Edit Project
            </button>
          </div>
        </div>
      ) : tab === 3 && auth.allowedAdmin ? (
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
                    name: s.name,
                    bUnit: s.bUnit,
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

export default ProjectManagement
