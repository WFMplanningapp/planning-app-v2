import { useState, useEffect } from "react"
import { useAuth } from "../../contexts/authContext"
import useForm from "../../hooks/useForm"
import StructureDropdown from "../selection/StructureDropdown"
import StructureDropdownSmll from "../selection/StructureDropdownSmll"

import { FaLock } from "react-icons/fa"

const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level: 1 },
  { name: "lob", default: null, required: true, type: "object", level: 2 },
  { name: "capPlan", default: null, required: true, type: "object", level: 3 },
  { name: "language", default: null, required: true, type: "object", level: 3 },
  { name: "Status", default: null, required: true, type: "object", level: 1 },
  { name: "hours", default: null, required: false, type: "object", level: 1 },
  { name: "sunFrom", default: null, required: false, type: "object", level: 1 },
  { name: "sunTo", default: null, required: false, type: "object", level: 1 },
  { name: "pricingModel", default: null, required: false, type:"object", level: 3}, 
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
    default:"",
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
  {
    name: "operationDays",
    default: [
      { weekDay: "Monday", status: "", start: "", end: "", },
      { weekDay: "Tuesday", status: "", start: "", end: "", },
      { weekDay: "Wednesday", status: "", start: "", end: "", },
      { weekDay: "Thursday", status: "", start: "", end: "", },
      { weekDay: "Friday", status: "", start: "", end: "", },
      { weekDay: "Saturday", status: "", start: "", end: "", },
      { weekDay: "Sunday", status: "", start: "", end: "", },
    ],
    required: false,
    type: "text",
    label: "Operation Days",
    placeholder: null,
  },
  {
    name: "fteHoursWeekly",
    default: 0,
    required: false,
    type: "number",
    label: "FTE Hours Weekly"
  },
  {
    name: "pricingModel",
    default: "",
    required: false,
    type: "text",
    label: "Pricing Model"
  },
]  


const status = [
  {
    name: "open",
  },
  {
    name: "close",
  },
]

const CapPlanManagement = ({ data }) => {
  const [tab, setTab] = useState(1)

  const [statusOpenMon, setStatusM] = useState(false);
  const [statusOpenTue, setStatusT] = useState(false);
  const [statusOpenWed, setStatusW] = useState(false);
  const [statusOpenThu, setStatusTh] = useState(false);
  const [statusOpenFri, setStatusF] = useState(false);
  const [statusOpenSat, setStatusS] = useState(false);
  const [statusOpenSun, setStatusSu] = useState(false);

  const auth = useAuth()

  const selection = useForm({
    fields: selectionFields,
  })

  const form = useForm({
    fields: formFields,
  })



  useEffect(() => {
    console.log("papaya")
    selection.set("language", data && selection.get("capPlan") && data.languages.find(
      (lang) => lang._id === selection.get("capPlan").language
    )
    )
    console.log(selection.get("language"))
  }, [selection.get("capPlan")])

  useEffect(() => {
    console.log("banana")
    //selection.set("pricingModel", data && selection.get("capPlan") && data.pms.find((pm) => pm.name === selection.get("capPlan").pricingModel))

  }, [selection.get("capPlan")])

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
            selection.resetAll()
          })
          .catch((err) => console.log(err))
        break

      case "EDIT":
        await fetch(
          `/api/data/management/capPlan?id=${selection.get("capPlan") && selection.get("capPlan")._id
          }`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: auth.authorization(),
            },
            body: JSON.stringify({
              payload,
              language: selection.get("language"),
            }),
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
          `/api/data/management/capPlan?id=${selection.get("capPlan") && selection.get("capPlan")._id
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
          `/api/data/entries/cleanup?capPlan=${selection.get("capPlan") && selection.get("capPlan")._id
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
  const [currentValue, setCurrentValue] = useState("");
  function checkValue(e) {
    setCurrentValue(handleDecimalsOnValue(e.target.value));
  }
  function handleDecimalsOnValue(value) {
    //const regex = /[0-9]*(\.[0-9]{1,2})/s;
    console.log(value.match(/([0-9]*\.{0,1}[0-9]{0,2})/s)[0])
    return value.match(/([0-9]*\.{0,1}[0-9]{0,2})/s)[0];
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
          <div id="add-form">
            <div className="columns is-multiline">
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
            </div>
            <div className="columns is-multiline">
              <div className="column is-3">
                <label className="label">FTE Hours Weekly</label>
                <div className="control is-small">
                  <input
                    className="input is-small"
                    onChange={(e) => (checkValue(e, 'change') , form.set("fteHoursWeekly", currentValue))}
                    value={currentValue}
                    type="number"
                    placeholder="FTE Hours Weekly"
                    required
                  />
                </div>
              </div>
              <div className="column is-3">
                <label className="label">Pricing Model</label>
                <div className="control">
                  <StructureDropdown
                    structureName="Princing Models"
                    selection={selection}
                    form={form}
                    data={
                      data &&
                      data.pms
                    }
                    callback={(f, j, v) => { form.set("pricingModel", JSON.parse(v).name) }}
                    disabled={false}
                  />
                </div>
                </div>
            </div>
            <div className="columns">
              <div className="column is-3" style={{ paddingBottom: "0px" }} >
                <label className="label">Days of Operation</label>
                <div className="control">
                  <input
                    className="input is-small"
                    onChange={(e) => form.set("name", e.target.value)}
                    value={"Monday"}
                    type="text"
                    placeholder="Monday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" >
                <label className="label">Status</label>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenMon}
                    onChange={() => {
                      statusOpenMon ? (setStatusM(false), daysOfWeek[0].status = "Closed") : (setStatusM(true), daysOfWeek[0].status = "Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenMon ?
                <div className="column is-3" style={{ paddingBottom: "0px" }}>
                  <label className="label">Hours of Operation</label>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[0].start = JSON.parse(v).name }}
                      disabled={false}

                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[0].end = JSON.parse(v).name }}
                      disabled={false}

                    />
                  </div>
                </div>
                : null
              }
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
            <div className="columns">
              <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                <div className="control">
                  <input
                    className="input is-small"
                    onChange={(e) => form.set("name", e.target.value)}
                    value={"Tuesday"}
                    type="text"
                    placeholder="Tuesday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenTue}
                    onChange={() => {
                      statusOpenTue ? (setStatusT(false), daysOfWeek[1].status = "Closed") : (setStatusT(true), daysOfWeek[1].status = "Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenTue ?
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[1].start = JSON.parse(v).name }}
                      disabled={false}

                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[1].end = JSON.parse(v).name }}
                      disabled={false}

                    />
                  </div>
                </div>
                : null
              }
              
            </div>
            <div className="columns">
              <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                <div className="control">
                  <input
                    className="input is-small"
                    onChange={(e) => form.set("name", e.target.value)}
                    value={"Wednesday"}
                    type="text"
                    placeholder="Wednesday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenWed}
                    onChange={() => {
                      statusOpenWed ? (setStatusW(false), daysOfWeek[2].status = "Closed") : (setStatusW(true), daysOfWeek[2].status = "Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenWed ?
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[2].start = JSON.parse(v).name }}
                      disabled={false}

                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[2].end = JSON.parse(v).name }}
                      disabled={false}

                    />
                  </div>
                </div>
                : null
              }

            </div>
            <div className="columns">
              <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                <div className="control">
                  <input
                    className="input is-small"
                    onChange={(e) => form.set("name", e.target.value)}
                    value={"Thursday"}
                    type="text"
                    placeholder="Thursday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenThu}
                    onChange={() => {
                      statusOpenThu ? (setStatusTh(false), daysOfWeek[3].status = "Closed") : (setStatusTh(true), daysOfWeek[3].status = "Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenThu ?
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[3].start = JSON.parse(v).name }}
                      disabled={false}

                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[3].end = JSON.parse(v).name }}
                      disabled={false}

                    />
                  </div>
                </div>
                : null
              }

            </div>
            <div className="columns">
              <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                <div className="control">
                  <input
                    className="input is-small"
                    onChange={(e) => form.set("name", e.target.value)}
                    value={"Friday"}
                    type="text"
                    placeholder="Friday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenFri}
                    onChange={() => {
                      statusOpenFri ? (setStatusF(false), daysOfWeek[4].status = "Closed") : (setStatusF(true), daysOfWeek[4].status = "Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenFri ?
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[4].start = JSON.parse(v).name }}
                      disabled={false}

                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[4].end = JSON.parse(v).name }}
                      disabled={false}

                    />
                  </div>
                </div>
                : null
              }

            </div>
            <div className="columns">
              <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                <div className="control">
                  <input
                    className="input is-small"
                    onChange={(e) => form.set("name", e.target.value)}
                    value={"Saturday"}
                    type="text"
                    placeholder="Saturday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenSat}
                    onChange={() => {
                      statusOpenSat ? (setStatusS(false), daysOfWeek[5].status = "Closed") : (setStatusS(true), daysOfWeek[5].status = "Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenSat ?
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[5].start = JSON.parse(v).name }}
                      disabled={false}

                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f, j, v) => { daysOfWeek[5].end = JSON.parse(v).name }}
                      disabled={false}

                    />
                  </div>
                </div>
                : null
              }

            </div>
            <div className="columns">
              <div className="column is-3" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    className="input is-small"
                    onLoad={(e) => form.set("Sunday", e.target.value)}
                    value={"Sunday"}
                    type="text"
                    placeholder="Sunday"
                    required
                    disabled
                  />
                </div>
              </div>
              <div className="column is-1" style={{ paddingTop: "0px" }}>
                <div className="control">
                  <input
                    type="checkbox"
                    className="mx-2"
                    checked={statusOpenSun}
                    onChange={() => {
                      statusOpenSun ? (setStatusSu(false), daysOfWeek[6].status="Closed") : (setStatusSu(true),daysOfWeek[6].status="Open")  
                    }}
                  ></input>
                </div>
              </div>
              {statusOpenSun ?
                <div className="column is-3" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <StructureDropdownSmll
                      structureName="From"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f,j,v) => { daysOfWeek[6].start = JSON.parse(v).name }}
                      disabled={false}
                    />
                    <StructureDropdownSmll
                      structureName="To"
                      selection={selection}
                      form={form}
                      data={
                        data &&
                        data.hours.sort((a, b) => a.order - b.order)
                      }
                      callback={(f,j,v) => { daysOfWeek[6].end = JSON.parse(v).name } }
                      disabled={false}
                    />
                  </div>
                </div>
                : null
              }

            </div>
          </div>


          <div id="add-button">
            <div className="columns">
              <div className="column is-3">
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
                    fteHoursWeekly: s.fteHoursWeekly,
                    operationDays: s.operationDays,

                  })
                  console.log(form.get("fteHoursWeekly"))
                }}
              />
            </div>
          </div>
            <div id="edit-form">
              <div className="columns is-multiline">
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
            <div className="column is-3">
              <label className="label">Language</label>
              <StructureDropdown
                structureName="language"
                selection={selection}
                form={selection}
                data={
                  data &&
                  data.languages.sort((a, b) =>
                    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                  )
                }
                disabled={!selection.get("language")}
              />
                </div>
              </div>

              <div className="columns is-multiline">
                <div className="column is-3">
                  <label className="label">FTE Hours Weekly</label>
                  <div className="control is-small">
                    <input
                      className="input is-small"
                      onChange={(e) => (checkValue(e, 'change'), form.set("fteHoursWeekly", currentValue))}
                      value={form.get("fteHoursWeekly") || currentValue}
                      type="number"
                      placeholder="FTE Hours Weekly"
                      required
                    />
                  </div>
                </div>
                <div className="column is-3">
                  <label className="label">Pricing Model</label>
                  <div className="control">
                    <StructureDropdown
                      structureName="pricingModel"
                      selection={selection}
                      form={selection}
                      data={
                        data &&
                        data.pms
                      }
                      disabled={!selection.get("pricingModel")}
                    />
                  </div>
                </div>
              </div>
              <div className="columns">
                <div className="column is-3" style={{ paddingBottom: "0px" }} >
                  <label className="label">Days of Operation</label>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set("name", e.target.value)}
                      value={"Monday"}
                      type="text"
                      placeholder="Monday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" >
                  <label className="label">Status</label>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[0].status === "Open" || false}
                      onChange={() => {
                        statusOpenMon ? (setStatusM(false), form.set("operationDays"[0].status, "Closed")) : (setStatusM(true), form.set("operationDays"[0].status , "Open"))
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenMon ?
                  <div className="column is-3" style={{ paddingBottom: "0px" }}>
                    <label className="label">Hours of Operation</label>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[0].start = JSON.parse(v).name }}
                        disabled={false}

                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[0].end = JSON.parse(v).name }}
                        disabled={false}

                      />
                    </div>
                  </div>
                  : null
                }
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
              <div className="columns">
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set("name", e.target.value)}
                      value={"Tuesday"}
                      type="text"
                      placeholder="Tuesday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[1].status === "Open" || false}
                      onChange={() => {
                        statusOpenTue ? (setStatusT(false), daysOfWeek[1].status = "Closed") : (setStatusT(true), daysOfWeek[1].status = "Open")
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenTue ?
                  <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[1].start = JSON.parse(v).name }}
                        disabled={false}

                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[1].end = JSON.parse(v).name }}
                        disabled={false}

                      />
                    </div>
                  </div>
                  : null
                }

              </div>
              <div className="columns">
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set("name", e.target.value)}
                      value={"Wednesday"}
                      type="text"
                      placeholder="Wednesday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[2].status === "Open" || false}
                      onChange={() => {
                        statusOpenWed ? (setStatusW(false), daysOfWeek[2].status = "Closed") : (setStatusW(true), daysOfWeek[2].status = "Open")
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenWed ?
                  <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[2].start = JSON.parse(v).name }}
                        disabled={false}

                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[2].end = JSON.parse(v).name }}
                        disabled={false}

                      />
                    </div>
                  </div>
                  : null
                }

              </div>
              <div className="columns">
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set("name", e.target.value)}
                      value={"Thursday"}
                      type="text"
                      placeholder="Thursday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[3].status === "Open" || false}
                      onChange={() => {
                        statusOpenThu ? (setStatusTh(false), daysOfWeek[3].status = "Closed") : (setStatusTh(true), daysOfWeek[3].status = "Open")
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenThu ?
                  <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[3].start = JSON.parse(v).name }}
                        disabled={false}

                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[3].end = JSON.parse(v).name }}
                        disabled={false}

                      />
                    </div>
                  </div>
                  : null
                }

              </div>
              <div className="columns">
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set("name", e.target.value)}
                      value={"Friday"}
                      type="text"
                      placeholder="Friday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[4].status === "Open" || false}
                      onChange={() => {
                        statusOpenFri ? (setStatusF(false), daysOfWeek[4].status = "Closed") : (setStatusF(true), daysOfWeek[4].status = "Open")
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenFri ?
                  <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[4].start = JSON.parse(v).name }}
                        disabled={false}

                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[4].end = JSON.parse(v).name }}
                        disabled={false}

                      />
                    </div>
                  </div>
                  : null
                }

              </div>
              <div className="columns">
                <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set("name", e.target.value)}
                      value={"Saturday"}
                      type="text"
                      placeholder="Saturday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[5].status === "Open" || false}
                      onChange={() => {
                        statusOpenSat ? (setStatusS(false), daysOfWeek[5].status = "Closed") : (setStatusS(true), daysOfWeek[5].status = "Open")
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenSat ?
                  <div className="column is-3" style={{ paddingBottom: "0px", paddingTop: "0px" }}>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[5].start = JSON.parse(v).name }}
                        disabled={false}

                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[5].end = JSON.parse(v).name }}
                        disabled={false}

                      />
                    </div>
                  </div>
                  : null
                }

              </div>
              <div className="columns">
                <div className="column is-3" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      className="input is-small"
                      onLoad={(e) => form.set("Sunday", e.target.value)}
                      value={"Sunday"}
                      type="text"
                      placeholder="Sunday"
                      required
                      disabled
                    />
                  </div>
                </div>
                <div className="column is-1" style={{ paddingTop: "0px" }}>
                  <div className="control">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("operationDays")[6].status === "Open" || false}
                      onChange={() => {
                        statusOpenSun ? (setStatusSu(false), daysOfWeek[6].status = "Closed") : (setStatusSu(true), daysOfWeek[6].status = "Open")
                      }}
                    ></input>
                  </div>
                </div>
                {statusOpenSun ?
                  <div className="column is-3" style={{ paddingTop: "0px" }}>
                    <div className="control">
                      <StructureDropdownSmll
                        structureName="From"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[6].start = JSON.parse(v).name }}
                        disabled={false}
                      />
                      <StructureDropdownSmll
                        structureName="To"
                        selection={selection}
                        form={form}
                        data={
                          data &&
                          data.hours.sort((a, b) => a.order - b.order)
                        }
                        callback={(f, j, v) => { daysOfWeek[6].end = JSON.parse(v).name }}
                        disabled={false}
                      />
                    </div>
                  </div>
                  : null
                }

              </div>

          </div>
          <div id="edit-button">
            <button
              className="button is-small is-warning is-rounded"
              onClick={() => handleSubmit("EDIT")}
              disabled={
                !form.checkRequired() ||
                !selection.get("capPlan") ||
                !selection.get("language")
              }
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
                    pricingModel: s.pricingModel,
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
