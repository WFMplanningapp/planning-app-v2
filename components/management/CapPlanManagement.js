import { useState, useEffect } from "react"
import { useAuth } from "../../contexts/authContext"
import useForm from "../../hooks/useForm"
import StructureDropdown from "../selection/StructureDropdown"
import FormDropdown from "../selection/FormDropdown"
import DatePicker from "react-datepicker"
import { registerLocale, setDefaultLocale } from "react-datepicker"
import { enGB } from "date-fns/locale"
import "react-datepicker/dist/react-datepicker.css"
import { FaLock } from "react-icons/fa"
import moment from "moment"
import { first } from "lodash"
import FoundeverLogo from "../../static/foundeverlogo"

registerLocale("en-GB", enGB);
setDefaultLocale("en-GB");

const selectionFields = [
  { name: "project", default: null, required: true, type: "object", level: 1 },
  { name: "lob", default: null, required: true, type: "object", level: 2 },
  { name: "capPlan", default: null, required: true, type: "object", level: 3 },
  { name: "language", default: "", required: true, type: "object", level: 3 },
  { name: "country", default: "", required: true, type: "object", level: 3 }
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
  {
    name: "operationDays",
    default: [
      { weekDay: "Monday", status: "Closed", start: "", end: "" },
      { weekDay: "Tuesday", status: "Closed", start: "", end: "" },
      { weekDay: "Wednesday", status: "Closed", start: "", end: "" },
      { weekDay: "Thursday", status: "Closed", start: "", end: "" },
      { weekDay: "Friday", status: "Closed", start: "", end: "" },
      { weekDay: "Saturday", status: "Closed", start: "", end: "" },
      { weekDay: "Sunday", status: "Closed", start: "", end: "" },
    ],
    required: false,
    type: "list",
    label: "Operation Days",
    placeholder: null,
  },
  {
    name: "fteHoursWeekly",
    default: 0,
    required: false,
    type: "number",
    label: "FTE Hours Weekly",
  },
  {
    name: "pricingModel",
    default: "",
    required: false,
    type: "text",
    label: "Pricing Model",
  },
  {
    name: "country",
    default: "",
    required: true,
    type: "text",
    label: "Country",
    placeholder: "Country",
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

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]

const editGetDate = (form) => {
  const firstDate = form.get("firstWeek").toUpperCase().split("W");
  return firstDate[1] < 10 && firstDate[1].length == 1 ? moment(`${firstDate[0]}W0${firstDate[1]}`).toDate() : moment(form.get("firstWeek").toUpperCase()).toDate();
}

const generateOperationDays = () => {
  return [
    { weekDay: "Monday", status: "Closed", start: "", end: "" },
    { weekDay: "Tuesday", status: "Closed", start: "", end: "" },
    { weekDay: "Wednesday", status: "Closed", start: "", end: "" },
    { weekDay: "Thursday", status: "Closed", start: "", end: "" },
    { weekDay: "Friday", status: "Closed", start: "", end: "" },
    { weekDay: "Saturday", status: "Closed", start: "", end: "" },
    { weekDay: "Sunday", status: "Closed", start: "", end: "" },
  ]
}

const CapPlanManagement = ({ data }) => {
  const [tab, setTab] = useState(1)

  const auth = useAuth()

  const selection = useForm({
    fields: selectionFields,
  })

  const form = useForm({
    fields: formFields,
  })

  useEffect(() => {
    if (selection.get("capPlan")) {
      const capPlan = selection.get("capPlan")
      selection.set(
        "language",
        data &&
          selection.get("capPlan") &&
          data.languages.find(
            (lang) => lang._id === selection.get("capPlan").language
          )
      )
      selection.set(
        "country",
        data &&
          selection.get("lob") &&
          data.countries.find(
            (country) => country.name === selection.get("lob").country
          )
      )
      form.setMany({
        name: capPlan.name,
        firstWeek: capPlan.firstWeek,
        startingHC: capPlan.startingHC,
        active: capPlan.active,
        fteHoursWeekly: capPlan.fteHoursWeekly,
        operationDays: capPlan.operationDays || generateOperationDays(),
        pricingModel: capPlan.pricingModel || "",
      })
    }
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
            alert(data.message);
            form.resetAll()
            form.set("operationDays", generateOperationDays())
            selection.resetAll()
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
            body: JSON.stringify({
              payload,
              language: selection.get("language"),
            }),
          }
        )
          .then((response) => response.json())
          .then((data) => {
            alert(data.message);
            form.resetAll()
            form.set("operationDays", generateOperationDays())
            selection.resetAll()
          })
          .catch((err) => console.log(err))
        break

      case "REMOVE":
        if (data && selection.get("capPlan") && data.capEntries.find(
          (entry) => entry.capPlan === selection.get("capPlan")._id
        )){
          alert("There are still entries for this capPlan, please clean up entries before removing the capPlan")
        } else {
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
              alert(data.message);
              form.resetAll()
              form.set("operationDays", generateOperationDays())
            })
            .catch((err) => console.log(err))

        }
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
            form.set("operationDays", generateOperationDays())
          })
          .catch((err) => console.log(err))
        break
    }
    selection.resetOne("capPlan")
    data.refresh()
  }
  const [currentValue, setCurrentValue] = useState("")

  function checkValue(e) {
    setCurrentValue(handleDecimalsOnValue(e.target.value))
    form.set("fteHoursWeekly", handleDecimalsOnValue(e.target.value))
  }

  function handleDecimalsOnValue(value) {
    //const regex = /[0-9]*(\.[0-9]{1,2})/s;
    console.log(value.match(/([0-9]*\.{0,1}[0-9]{0,2})/s)[0])
    return value.match(/([0-9]*\.{0,1}[0-9]{0,2})/s)[0]
  }

    let allOperationDaysClosed = form.get("operationDays") ? form.get("operationDays").some(e => e['status'] === 'Open') : "";
  
    const handleOperationDaysChange = (value, key, form, dayIndex) => {
    let operationDays = form.get("operationDays")
    let changedDay = operationDays[dayIndex]
    switch (key) {
      case "status":
        changedDay.status == "Open"
          ? (changedDay.status = "Closed")
          : (changedDay.status = "Open")
        break
      case "start":
        changedDay.start = value
        break
      case "end":
        changedDay.end = value
        form.set("operationDays", operationDays)
        break
      default:
        break
    }

    form.set("operationDays", operationDays)
  }
  const [startDate, setStartDate] = useState("");
  

  return (
    <>
      <div className="tabs">
        <ul>
          <li className={tab === 1 ? "is-active" : ""} key={1}>
            <a
              onClick={() => {
                setTab(1)
                form.resetAll()
                form.set("operationDays", generateOperationDays())
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
                form.set("operationDays", generateOperationDays())
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
                form.set("operationDays", generateOperationDays())
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
        /** ADD */
        data && data.projects ? 
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
                  f.set("operationDays", generateOperationDays())
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
                  f.set("operationDays", generateOperationDays())
                }}
              />
              <StructureDropdown
                structureName="language"
                selection={selection}
                form={form}
                data={
                  data &&
                  data.languages &&
                  data.languages.sort((a, b) =>
                    a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                  )
                }
                disabled={!selection.get("project")}
                callback={(f) => {
                  f.resetAll()
                  f.set("operationDays", generateOperationDays())
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
                          <label className="label">Country</label>
                          <div className="control is-small">
                              <StructureDropdown
                                  structureName="country"
                                  selection={selection}
                                  form={form}
                                  data={data && data.countries}
                                  disabled={false}
                                  callback={(f, s) => {
                                      f.set(
                                          "country", s.name
                                      )
                                  }}
                              />
                          </div>
                      </div>
              <div className="column is-3">
                <label className="label">First Week</label>
                <div className="control">
                <DatePicker
                selected={startDate}
                locale="en-GB"
                dateFormat={"YYYY'w'ww"}
                onChange={(date) => {
                  let year = moment(date).format("YYYY");
                  let week =moment(date).isoWeek();
                  let weekCode = year + "w" + week;
                  setStartDate(date)
                 form.set("firstWeek", weekCode)
                  
                }}
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
                    onChange={(e) => checkValue(e, "change")}
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
                  <FormDropdown
                    fieldName="pricing Model"
                    form={form}
                    data={data && data.pms && data.pms.map((pms) => pms.name)}
                    disabled={false}
                    style={ 'maxWidth: "74px"' }
                  />
                </div>
              </div>
            </div>
            <div className="columns">
              <div className="column is-2">
                <label className="label">Days of Operation</label>
              </div>
              <div className="column is-1">
                <label className="label">Status</label>
              </div>

              <div className="column is-2">
                <label className="label">Hours of Operation</label>
              </div>
              <div className="column is-12 ">
                <div className="control">
                  <label className="label">
                    <input
                      type="checkbox"
                      className="mx-2"
                      checked={form.get("active") || true}
                      onChange={() => {
                        form.set("active", !form.get("active"))
                      }}
                      disabled
                    ></input>
                    Active
                  </label>
                </div>
              </div>
            </div>
            {weekdays.map((w, i) => (
              <div key={w + "-add"}>
                <div className="columns">
                  <div className="column is-2">
                    <div className="control">
                      <input
                        className="input is-small"
                        value={w}
                        type="text"
                        placeholder={w}
                        required
                        disabled
                      />
                    </div>
                  </div>
                  <div className="column is-1" style={{ paddingBottom: "0px" }}>
                    <div className="control">
                      <input
                        type="checkbox"
                        className="mx-2"
                        checked={
                          form.get("operationDays")
                            ? form.get("operationDays")[i].status == "Open"
                            : false
                        }
                        onChange={() => {
                          handleOperationDaysChange(true, "status", form, i)
                        }}
                      ></input>
                    </div>
                  </div>

                  {form.get("operationDays") &&
                  form.get("operationDays")[i].status == "Open" ? (
                    <div className="column is-3">
                      <div className="control">
                        <FormDropdown
                          className={"workHours"}
                          fieldName="operationDays"
                          subFieldName="start"
                          form={form}
                          data={
                            data &&
                            data.hours
                              .sort((a, b) => a.order - b.order)
                              .map((h) => h.name)
                          }
                          callback={(f, j, v) => {
                            handleOperationDaysChange(j, "start", f, i)
                          }}
                          disabled={false}
                          getNestedItem={(opDays) => {
                            return opDays[i]["start"]
                          }}
                        />
                        <FormDropdown
                          fieldName="operationDays"
                          subFieldName="end"
                          form={form}
                          data={
                            data &&
                            data.hours
                              .sort((a, b) => a.order - b.order)
                              .map((h) => h.name)
                          }
                          callback={(f, j, v) => {
                            console.log(j, v)
                            handleOperationDaysChange(j, "end", f, i)
                          }}
                          disabled={false}
                          getNestedItem={(opDays) => {
                            return opDays[i]["end"]
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}

          </div>


          <div id="add-button">
            <div className="columns">
              <div className="column is-3">
                <button
                  className="button is-small is-success is-rounded"
                  onClick={() => handleSubmit("ADD")}
                  disabled={
                    !allOperationDaysClosed ||
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
        :  <div className="loaderContainer">
              <div className="loaderConstrain">
                <FoundeverLogo />
              </div>
            </div>
      ) : tab === 2 ? (
        /** EDIT */
        data && data.projects ? 
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
                  f.set("operationDays", generateOperationDays())
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
                  f.set("operationDays", generateOperationDays())
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
                callback={(f, s) => {}}
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
                              <label className="label">Country</label>
                              <div className="control is-small">
                                  <StructureDropdown
                                      structureName="country"
                                      selection={selection}
                                      form={form}
                                      data={data && data.countries}
                                      disabled={false}
                                      callback={(f, s) => {
                                          f.set(
                                              "country", s.name
                                          )
                                      }}
                                  />
                              </div>
                          </div>
              <div className="column is-3">
                <label className="label">First Week</label>
                <div className="control">
                <DatePicker
                selected={ form.get("firstWeek") ?  editGetDate(form) : '' }
                locale="en-GB"
                dateFormat={"YYYY'w'ww"}
                onChange={(date) => {
                  console.log(`on change ${date}`)
                  let year = moment(date).format("YYYY");
                  let week = moment(date).isoWeek();
                  let weekCode = year + "w" + week;
                  setStartDate(date)
                 form.set("firstWeek", weekCode)
                }}
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
                  data={ data && data.languages ? 
                    data &&
                    data.languages.sort((a, b) =>
                      a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                    ) : ""
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
                    onChange={(e) => checkValue(e, "change")}
                    value={form.get("fteHoursWeekly") || ""}
                    type="number"
                    placeholder="FTE Hours Weekly"
                    required
                  />
                </div>
              </div>
              <div className="column is-3">
                <label className="label">Pricing Model</label>
                <div className="control">
                  <FormDropdown
                    fieldName="pricingModel"
                    form={form}
                    data={data && data.pms.map((pms) => pms.name)}
                  />
                </div>
              </div>
              </div>
              <div className="columns">
                <div className="column is-2">
                  <label className="label">Days of Operation</label>
                </div>
                <div className="column is-1">
                  <label className="label">Status</label>
                </div>

                <div className="column is-2">
                  <label className="label">Hours of Operation</label>
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
              {weekdays.map((w, i) => (
                <div key={w + "-edit"}>
                  <div className="columns">
                    <div className="column is-2">
                      <div className="control">
                        <input
                          className="input is-small"
                          onChange={(e) => form.set("name", e.target.value)}
                          value={w}
                          type="text"
                          placeholder={w}
                          required
                          disabled
                        />
                      </div>
                    </div>
                    <div className="column is-1" style={{ paddingBottom: "0px" }}>
                      <div className="control">
                        <input
                          type="checkbox"
                          className="mx-2"
                          checked={
                            form.get("operationDays") &&
                            form.get("operationDays")[i].status == "Open"
                          }
                          onChange={() => {
                            handleOperationDaysChange(true, "status", form, i)
                          }}
                        ></input>
                      </div>
                    </div>

                    {form.get("operationDays") &&
                      form.get("operationDays")[i].status == "Open" ? (
                      <div className="column is-3">
                        <div className="control">
                          <FormDropdown
                            fieldName="operationDays"
                            subFieldName={"start"}
                            form={form}
                            data={
                              data &&
                              data.hours
                                .sort((a, b) => a.order - b.order)
                                .map((h) => h.name)
                            }
                            callback={(f, j, v) => {
                              handleOperationDaysChange(j, "start", f, i)
                            }}
                            disabled={false}
                            getNestedItem={(opDays) => {
                              return opDays[i]["start"]
                            }}
                          />
                          <FormDropdown
                            fieldName="operationDays"
                            form={form}
                            subFieldName={"end"}
                            data={
                              data &&
                              data.hours
                                .sort((a, b) => a.order - b.order)
                                .map((h) => h.name)
                            }
                            callback={(f, j, v) => {
                              handleOperationDaysChange(j, "end", f, i)
                            }}
                            disabled={false}
                            getNestedItem={(opDays) => {
                              return opDays[i]["end"]
                            }}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
          </div>
          <div className="columns">
            <div className="column is-3">
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
          </div>
        </div>
        : <div className="loaderContainer">
        <div className="loaderConstrain">
          <FoundeverLogo />
        </div>
      </div>
        //remove tab
      ) : tab === 3 && auth.allowedManager ? (
        data && data.projects ?
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
        :  <div class="loaderContainer"><span class="loaderGigi"></span></div>
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
