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
  // "inVac",
  "overtimeFTE",
]

const trainingFields = [
  "trCommit",
  "trGap",
  "trAttrition",
  "ocpAttrition",
  "trWeeks",
  "ocpWeeks",
]

const targetFields = ["grossRequirement","inCenterRequirement","productiveRequirement", "budget"]

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

const actualFields = ["actVac", "actAbs", "actAux"]

const plannedFields = ["plannedVac", "plannedAbs", "plannedAux"]

const EntryForm = ({ selection, week }) => {
  const [entry, setEntry] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [formInfo, setFormInfo] = useState({})
  const [lockedRequirementField, setLockedRequirementField] = useState(null)

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

      // console.log(fetched)
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
    const requirementFields = ['productiveRequirement', 'inCenterRequirement', 'grossRequirement'];
    
    if (!changeConfig) {
		
      let newFormInfo = {
			...entry,     // ensure fallback data from entry
			...formInfo,  // preserve previously typed values
			[field]: e.target.value // apply new change
		};
      
      // Function to recalculate requirements based on gross requirement and planned percentages
      const recalculateRequirements = (currentFormInfo) => {
        const grossReq = parseFloat(currentFormInfo.grossRequirement || 0);
        if (grossReq > 0) {
          // Get planned percentages from current form state
          const plannedVac = parseFloat(currentFormInfo.plannedVac || (entry && entry.plannedVac) || 0) / 100;
          const plannedAbs = parseFloat(currentFormInfo.plannedAbs || (entry && entry.plannedAbs) || 0) / 100;
          const plannedAux = parseFloat(currentFormInfo.plannedAux || (entry && entry.plannedAux) || 0) / 100;
          
          // Formula 1: InCenter Requirement = (Gross Req * (1 - PlannedVac)) * (1 - PlannedAbs)
          const inCenterReq = grossReq * (1 - (plannedVac+plannedAbs));
          currentFormInfo.inCenterRequirement = inCenterReq.toFixed(2);
          
		  
          // Formula 2: Productive Requirement = InCenter Requirement * (1 - PlannedAux)
          const productiveReq = inCenterReq * (1 - plannedAux);
          currentFormInfo.productiveRequirement = productiveReq.toFixed(2);
        }
        return currentFormInfo;
      };

      // If editing gross requirement, calculate InCenter Requirement and Productive Requirement
      if (field === 'grossRequirement' && e.target.value.trim() !== '') {
        const grossReq = parseFloat(e.target.value);
        if (!isNaN(grossReq)) {
          newFormInfo = recalculateRequirements(newFormInfo);
        }
        setLockedRequirementField(field);
      }
      // If editing InCenter requirement, calculate Gross Requirement and Productive Requirement
      else if (field === 'inCenterRequirement' && e.target.value.trim() !== '') {
        const inCenterReq = parseFloat(e.target.value);
        if (!isNaN(inCenterReq)) {
          // Get planned percentages from current form state
          const plannedVac = parseFloat(newFormInfo.plannedVac || (entry && entry.plannedVac) || 0) / 100;
          const plannedAbs = parseFloat(newFormInfo.plannedAbs || (entry && entry.plannedAbs) || 0) / 100;
          const plannedAux = parseFloat(newFormInfo.plannedAux || (entry && entry.plannedAux) || 0) / 100;
          
          // Formula to get Gross Requirement: (InCenter Req / (1 - PlannedAbs)) / (1 - PlannedVac)
          const grossReq = inCenterReq / (1 - (plannedAbs+plannedVac));
          newFormInfo.grossRequirement = grossReq.toFixed(2);
          
          // Formula to get Productive Requirement: InCenter Req * (1 - PlannedAux)
          const productiveReq = inCenterReq * (1 - plannedAux);
          newFormInfo.productiveRequirement = productiveReq.toFixed(2);
        }
        setLockedRequirementField(field);
      }
      // If editing Productive requirement, calculate InCenter Requirement and Gross Requirement
      else if (field === 'productiveRequirement' && e.target.value.trim() !== '') {
        const productiveReq = parseFloat(e.target.value);
        if (!isNaN(productiveReq)) {
          // Get planned percentages from current form state
          const plannedVac = parseFloat(newFormInfo.plannedVac || (entry && entry.plannedVac) || 0) / 100;
          const plannedAbs = parseFloat(newFormInfo.plannedAbs || (entry && entry.plannedAbs) || 0) / 100;
          const plannedAux = parseFloat(newFormInfo.plannedAux || (entry && entry.plannedAux) || 0) / 100;
          
          // Formula to get InCenter Requirement: Productive Req / (1 - PlannedAux)
          const inCenterReq = productiveReq / (1 - plannedAux);
          newFormInfo.inCenterRequirement = inCenterReq.toFixed(2);
          
          // Formula to get Gross Requirement: (InCenter Req / (1 - PlannedAbs)) / (1 - PlannedVac)
          const grossReq = inCenterReq / (1 - (plannedAbs+plannedVac));
          newFormInfo.grossRequirement = grossReq.toFixed(2);
        }
        setLockedRequirementField(field);
      }
      // If editing planned fields, recalculate based on existing requirement values (form or entry)
      else if (['plannedVac', 'plannedAbs', 'plannedAux'].includes(field)) {
        // Check for existing requirement values in form or entry (priority order)
        const grossReq = parseFloat(formInfo.grossRequirement || (entry && entry.grossRequirement) || 0);
        const inCenterReq = parseFloat(formInfo.inCenterRequirement || (entry && entry.inCenterRequirement) || 0);
        const productiveReq = parseFloat(formInfo.productiveRequirement || (entry && entry.productiveRequirement) || 0);
        
        // Recalculate based on priority: Gross > InCenter > Productive
        if (grossReq > 0) {
          newFormInfo = recalculateRequirements(newFormInfo);
        } else if (inCenterReq > 0 && !formInfo.productiveRequirement) {
          // Get planned percentages from current form state
          const plannedVac = parseFloat(newFormInfo.plannedVac || (entry && entry.plannedVac) || 0) / 100;
          const plannedAbs = parseFloat(newFormInfo.plannedAbs || (entry && entry.plannedAbs) || 0) / 100;
          const plannedAux = parseFloat(newFormInfo.plannedAux || (entry && entry.plannedAux) || 0) / 100;
          
          // Recalculate Gross and Productive from InCenter
          const grossReq = inCenterReq / (1 - (plannedAbs+plannedVac));
          newFormInfo.grossRequirement = grossReq.toFixed(2);
          
          const productiveReq = inCenterReq * (1 - plannedAux);
          newFormInfo.productiveRequirement = productiveReq.toFixed(2);
        } else if (productiveReq > 0) {
          // Get planned percentages from current form state
          const plannedVac = parseFloat(newFormInfo.plannedVac || (entry && entry.plannedVac) || 0) / 100;
          const plannedAbs = parseFloat(newFormInfo.plannedAbs || (entry && entry.plannedAbs) || 0) / 100;
          const plannedAux = parseFloat(newFormInfo.plannedAux || (entry && entry.plannedAux) || 0) / 100;
          
          // Recalculate InCenter and Gross from Productive
          const inCenterReq = productiveReq / (1 - plannedAux);
          newFormInfo.inCenterRequirement = inCenterReq.toFixed(2);
          
          const grossReq = inCenterReq / (1 - (plannedAbs+plannedVac));
          newFormInfo.grossRequirement = grossReq.toFixed(2);
        }
      }
      // If editing a requirement field and it has a value, lock the other requirement fields
      else if (requirementFields.includes(field) && e.target.value.trim() !== '') {
        setLockedRequirementField(field);
      }
      // If clearing a requirement field, clear all requirement fields and unlock all fields
      else if (requirementFields.includes(field) && e.target.value.trim() === '') {
        setLockedRequirementField(null);
        // Clear all requirement fields when one is cleared
        newFormInfo.grossRequirement = '';
        newFormInfo.inCenterRequirement = '';
        newFormInfo.productiveRequirement = '';
      }
      
      setFormInfo(newFormInfo);
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

    // Remove old field names when new ones are present to avoid duplication
    if (newEntry.productiveRequirement !== undefined) {
       newEntry.productiveRequirement = newEntry.productiveRequirement;
    }
    if (newEntry.inCenterRequirement !== undefined) {
      newEntry.inCenterRequirement = newEntry.inCenterRequirement;
    }
    

    const fieldsToDelete = [];
Object.keys(newEntry).forEach((key) => {
  if (newEntry[key] === "delete") {
    fieldsToDelete.push(key);
    delete newEntry[key]; // Optionally remove from the update payload
  }
});

if (entry && entry._id) {
    // Only PATCH if existing entry
    fetch("/api/data/entries/single", {
      method: "PATCH",
      headers: {
        Authorization: auth.authorization(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        _id: entry._id,
        fieldsToDelete,
        payload: newEntry,
      }),
    })
      .then((res) => res.json())
      .then((fetched) => {
        console.log(fetched.message)
      })
      .catch()
  } else {
    // POST for new entries
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
        setFormInfo({ Comment: newEntry["Comment"] || "" })
        setLockedRequirementField(null)
      })
      .catch()
  }
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
            {targetFields.map((field) => {
              const fieldLabels = {
                productiveRequirement: "Productive Requirement",
                forecasted: "forecasted",
                budget: "budget",
                inCenterRequirement: "InCenter Requirement",
                grossRequirement: "Gross Requirement"
              };
              const requirementFields = ['productiveRequirement', 'inCenterRequirement', 'grossRequirement'];
              const isRequirementField = requirementFields.includes(field);
              const isLocked = lockedRequirementField && lockedRequirementField !== field && isRequirementField;
              
              return (
              <div
                key={`Col-${field}`}
                className="column is-6-mobile is-2 py-0"
              >
                <label>{fieldLabels[field] || field}</label>
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
                        (formInfo[field] ? "is-danger" : "") +
                        (isLocked ? " has-background-grey-lighter" : "")
                      }
                      aria-label={field}
                      value={formInfo[field] || ""}
                      disabled={!week || isLocked}
                      onChange={(e) => handleChange(e, field)}
                    />
                  </p>
                </div>
              </div>
            )
            })}
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
                      value={(entry && entry[field] && `${entry[field]}%`) || "none"}
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
                    <span className="input-fake-placeholder">%</span>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <label>PLANNED</label>
          <div className="columns is-multiline is-mobile pt-2">
            {plannedFields.map((field) => (
              <div
                key={`Col-${field}`}
                className="column is-6-mobile is-2 py-0"
              >
                <label>{field}</label>
                <div className="field has-addons">
                  <p className="control">
                    <input
                      readOnly={true}
                      className={`input is-rounded is-small has-text-light ${entry && entry[field]
                          ? "has-background-info"
                          : "has-background-grey-lighter"
                        }`}
                      aria-label={field}
                      value={(entry && entry[field] && `${entry[field]}%`) || "none"}
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
                    <span className="input-fake-placeholder">%</span>
                  </p>
                </div>
              </div>
            ))}
          </div>


          <label>COMMENT</label>
          <div className="columns mb-0" >
            <div key={`Col-Comment`} className="column is-12 pb-0">
              <div className="columns is-gapless is-fullwidth">
                <div className="column">
                  <textarea style={{ cursor: "not-allowed" }}
                    readOnly={true}
                    className="textarea is-fullwidth has-background-grey-lighter has-text-light"
                    aria-label={"commeent-locked"}
                    value={(entry && entry["Comment"]) || "none"}
                  />
                </div>
                <div className="column">
                  <textarea style={{ cursor: "not-allowed" }}
                    readOnly={true}
                    className={
                      "textarea is-fullwidth has-background-grey-lighter" +
                      (formInfo["Comment"] ? "is-danger" : "")
                    }

                    label={"comment-change"}
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
                  auth.allowedGuest ? "is-primary" : "is-danger"
                }`}
                onClick={handleSubmit}
                disabled={!auth.allowedGuest || !loaded}
              >
                {auth.allowedGuest ? (
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
