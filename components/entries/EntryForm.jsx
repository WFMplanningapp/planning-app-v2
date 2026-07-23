import { useState, useEffect } from "react"
import { FaLock } from "react-icons/fa"
import { useAuth } from "../../contexts/authContext"
import { validateFieldValue } from "../../lib/fieldValidation"

// ============================
// FIELD ARRAYS & LABELS
// ============================

const headcountFields = [
  "attrition", "fcAttrition", "moveIN", "moveOUT", "loaIN", "loaOUT",
  "rwsIN", "rwsOUT", "rampDown", "overtimeFTE",
]

const customLabels = {
  fcAttrition: "Forecasted Attrition (%)",
  overtimeFTE: "Overtime in FTEs",
  ocpProductivityPercent: "OCP Productivity (%)",
}

const trainingFields = [
  "trCommit", "trGap", "trAttrition", "ocpAttrition", "trWeeks", "ocpWeeks",
]

const targetFields = ["grossRequirement", "inCenterRequirement", "productiveRequirement", "budget"]

const actualFields = ["actVac", "actAbs", "actAux"]

const plannedFields = ["plannedVac", "plannedAbs", "plannedAux"]

// ============================
// COMPONENT
// ============================

const EntryForm = ({ selection, week }) => {
  const [entry, setEntry] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [formInfo, setFormInfo] = useState({})
  const [lockedRequirementField, setLockedRequirementField] = useState(null)
  const [fieldErrors, setFieldErrors] = useState({})

  const auth = useAuth()

  // ============================
  // FETCH ENTRY
  // ============================

  const fetchEntry = async () => {
    let fetched = await fetch(
      `api/data/find/capEntries?capPlan=${selection.get("capPlan")._id}&week=${week.code}`
    )
      .then((res) => res.json())
      .catch()

    let entries = fetched.data

    if (entries.length === 1) {
      setEntry(entries[0])
      setFormInfo({})
    } else if (entries.length > 1) {
      console.log("Multiple Entries!", entries.map((e) => e.id))
    } else if (entries.length === 0) {
      setFormInfo({})
      setEntry(null)
      console.log("No entry found")
    }
    setLoaded(true)
  }

  useEffect(() => {
    const fetchEntryEffect = async () => {
      let fetched = await fetch(
        `api/data/find/capEntries?capPlan=${selection.get("capPlan")._id}&week=${week.code}`
      )
        .then((res) => res.json())
        .catch()

      let entries = fetched.data

      if (entries.length === 1) {
        setEntry(entries[0])
        setFormInfo({})
      } else if (entries.length > 1) {
        console.log("Multiple Entries!", entries.map((e) => e.id))
      } else if (entries.length === 0) {
        setFormInfo({})
        setEntry(null)
        console.log("No entry found")
      }
      setLoaded(true)
    }

    fetchEntryEffect()
  }, [selection, week])

  // ============================
  // REQUIREMENT RECALCULATION
  // ============================

  const getPlannedValues = (source) => ({
    plannedVac: parseFloat(source.plannedVac || (entry && entry.plannedVac) || 0) / 100,
    plannedAbs: parseFloat(source.plannedAbs || (entry && entry.plannedAbs) || 0) / 100,
    plannedAux: parseFloat(source.plannedAux || (entry && entry.plannedAux) || 0) / 100,
  })

  const calcFromGross = (grossReq, planned) => {
    const inCenterReq = grossReq * (1 - (planned.plannedVac + planned.plannedAbs))
    const productiveReq = inCenterReq * (1 - planned.plannedAux)
    return {
      inCenterRequirement: inCenterReq.toFixed(2),
      productiveRequirement: productiveReq.toFixed(2),
    }
  }

  const calcFromInCenter = (inCenterReq, planned) => {
    const grossReq = inCenterReq / (1 - (planned.plannedAbs + planned.plannedVac))
    const productiveReq = inCenterReq * (1 - planned.plannedAux)
    return {
      grossRequirement: grossReq.toFixed(2),
      productiveRequirement: productiveReq.toFixed(2),
    }
  }

  const calcFromProductive = (productiveReq, planned) => {
    const inCenterReq = productiveReq / (1 - planned.plannedAux)
    const grossReq = inCenterReq / (1 - (planned.plannedAbs + planned.plannedVac))
    return {
      grossRequirement: grossReq.toFixed(2),
      inCenterRequirement: inCenterReq.toFixed(2),
    }
  }

  // ============================
  // HANDLE CHANGE WITH VALIDATION
  // ============================

  const handleChange = (e, field, changeConfig) => {
    const requirementFields = ['productiveRequirement', 'inCenterRequirement', 'grossRequirement']

    if (!changeConfig) {
      const rawValue = e.target.value

      // --- VALIDATION GATE ---
      const { valid, error } = validateFieldValue(field, rawValue)

      if (!valid) {
        setFieldErrors((prev) => ({ ...prev, [field]: error }))
        return
      }

      // Clear error for this field
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })

      let newFormInfo = {
        ...entry,
        ...formInfo,
        [field]: rawValue,
      }

      const planned = getPlannedValues(newFormInfo)

      // --- Requirement recalculation based on which field changed ---
      if (field === 'grossRequirement' && rawValue.trim() !== '') {
        const grossReq = parseFloat(rawValue)
        if (!isNaN(grossReq) && grossReq > 0) {
          Object.assign(newFormInfo, calcFromGross(grossReq, planned))
        }
        setLockedRequirementField(field)
      } else if (field === 'inCenterRequirement' && rawValue.trim() !== '') {
        const inCenterReq = parseFloat(rawValue)
        if (!isNaN(inCenterReq) && inCenterReq > 0) {
          Object.assign(newFormInfo, calcFromInCenter(inCenterReq, planned))
        }
        setLockedRequirementField(field)
      } else if (field === 'productiveRequirement' && rawValue.trim() !== '') {
        const productiveReq = parseFloat(rawValue)
        if (!isNaN(productiveReq) && productiveReq > 0) {
          Object.assign(newFormInfo, calcFromProductive(productiveReq, planned))
        }
        setLockedRequirementField(field)
      } else if (['plannedVac', 'plannedAbs', 'plannedAux'].includes(field)) {
        // Recalculate requirements when planned values change
        const grossReq = parseFloat(formInfo.grossRequirement || (entry && entry.grossRequirement) || 0)
        const inCenterReq = parseFloat(formInfo.inCenterRequirement || (entry && entry.inCenterRequirement) || 0)
        const productiveReq = parseFloat(formInfo.productiveRequirement || (entry && entry.productiveRequirement) || 0)
        const updatedPlanned = getPlannedValues(newFormInfo)

        if (grossReq > 0) {
          Object.assign(newFormInfo, calcFromGross(grossReq, updatedPlanned))
        } else if (inCenterReq > 0 && !formInfo.productiveRequirement) {
          Object.assign(newFormInfo, calcFromInCenter(inCenterReq, updatedPlanned))
        } else if (productiveReq > 0) {
          Object.assign(newFormInfo, calcFromProductive(productiveReq, updatedPlanned))
        }
      } else if (requirementFields.includes(field) && rawValue.trim() !== '') {
        setLockedRequirementField(field)
      } else if (requirementFields.includes(field) && rawValue.trim() === '') {
        setLockedRequirementField(null)
        newFormInfo.grossRequirement = ''
        newFormInfo.inCenterRequirement = ''
        newFormInfo.productiveRequirement = ''
      }

      setFormInfo(newFormInfo)
    } else {
      setFormInfo({
        ...formInfo,
        config: { ...formInfo.config, [field]: e.target.value },
      })
    }
  }

  // ============================
  // HANDLE SUBMIT WITH FINAL VALIDATION
  // ============================

  const handleSubmit = () => {
    const errors = {}
    let hasErrors = false

    Object.keys(formInfo).forEach((field) => {
      if (field === 'config') return
      const value = formInfo[field]
      if (value === "" || value === undefined || value === null) return

      const { valid, error } = validateFieldValue(field, value)
      if (!valid) {
        errors[field] = error
        hasErrors = true
      }
    })

    if (hasErrors) {
      setFieldErrors(errors)
      alert("Some fields contain invalid values. Please correct them before submitting.")
      return
    }

    let newEntry = {}

    if (entry) {
      newEntry = entry
    } else {
      newEntry.capPlan = selection.get("capPlan")._id
      newEntry.week = week.code
    }

    newEntry = { ...newEntry, ...formInfo }

    const fieldsToDelete = []
    Object.keys(newEntry).forEach((key) => {
      if (newEntry[key] === "delete") {
        fieldsToDelete.push(key)
        delete newEntry[key]
      }
    })

    if (entry && entry._id) {
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
          fetchEntry()
        })
        .catch()
    } else {
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
          setFormInfo({})
          setLockedRequirementField(null)
          fetchEntry()
        })
        .catch()
    }
  }

  // ============================
  // RENDER HELPERS
  // ============================

  const renderReadOnlyInput = (field, showPercent = false) => (
    <p className="control">
      <input
        readOnly={true}
        className={`input is-rounded is-small has-text-light ${
          entry && entry[field] ? "has-background-info" : "has-background-grey-lighter"
        }`}
        aria-label={field}
        value={
          entry && entry[field]
            ? showPercent ? `${entry[field]}%` : entry[field]
            : "none"
        }
      />
    </p>
  )

  const renderEditableInput = (field, { showPercent = false, extraClass = "", disabled = false } = {}) => (
    <p className="control" style={{ position: "relative" }}>
      <input
        className={
          "input is-rounded is-small " +
          (formInfo[field] ? "is-danger" : "") +
          (fieldErrors[field] ? " is-danger" : "") +
          (extraClass ? ` ${extraClass}` : "")
        }
        aria-label={field}
        value={formInfo[field] || ""}
        disabled={!week || disabled}
        onChange={(e) => handleChange(e, field)}
        inputMode="decimal"
      />
      {showPercent && <span className="input-fake-placeholder">%</span>}
      {fieldErrors[field] && (
        <span
          style={{
            color: "#ff3860",
            fontSize: "0.65rem",
            position: "absolute",
            bottom: "-14px",
            left: "8px",
            whiteSpace: "nowrap",
          }}
        >
          {fieldErrors[field]}
        </span>
      )}
    </p>
  )

  // ============================
  // RENDER
  // ============================

  return (
    <>
      <div>
        <form className="is-size-7">

          {/* HEADCOUNT */}
          <label>HEADCOUNT</label>
          <div className="columns is-multiline is-mobile pt-2">
            {headcountFields.map((field) => (
              <div key={`Col-${field}`} className="column is-6-mobile is-2 py-0">
                <label>{customLabels[field] || field}</label>
                <div className="field has-addons" style={{ marginBottom: fieldErrors[field] ? "18px" : undefined }}>
                  {renderReadOnlyInput(field)}
                  {renderEditableInput(field)}
                </div>
              </div>
            ))}
          </div>

          {/* TRAINING */}
          <label>TRAINING</label>
          <div className="columns is-multiline is-mobile pt-2">
            {trainingFields.map((field) => {
              if (field === "ocpWeeks") {
                return (
                  <div key={`Col-${field}`} className="column is-6-mobile is-2 py-0">
                    <label>{customLabels[field] || field}</label>
                    <div className="field has-addons" style={{ marginBottom: fieldErrors[field] ? "18px" : undefined }}>
                      {renderReadOnlyInput(field)}
                      {renderEditableInput(field)}
                    </div>
                    {/* OCP Productivity Percent below ocpWeeks */}
                    <div className="mt-2">
                      <label>{customLabels.ocpProductivityPercent || "OCP Productivity (%)"}</label>
                      <div className="field has-addons" style={{ marginBottom: fieldErrors["ocpProductivityPercent"] ? "18px" : undefined }}>
                        {renderReadOnlyInput("ocpProductivityPercent")}
                        {renderEditableInput("ocpProductivityPercent")}
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={`Col-${field}`} className="column is-6-mobile is-2 py-0">
                  <label>{customLabels[field] || field}</label>
                  <div className="field has-addons" style={{ marginBottom: fieldErrors[field] ? "18px" : undefined }}>
                    {renderReadOnlyInput(field)}
                    {renderEditableInput(field)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* TARGETS */}
          <label>TARGETS</label>
          <div className="columns is-multiline is-mobile pt-2">
            {targetFields.map((field) => {
              const fieldLabels = {
                productiveRequirement: "Productive Requirement",
                budget: "budget",
                inCenterRequirement: "InCenter Requirement",
                grossRequirement: "Gross Requirement",
              }
              const reqFields = ['productiveRequirement', 'inCenterRequirement', 'grossRequirement']
              const isRequirementField = reqFields.includes(field)
              const isLocked = lockedRequirementField && lockedRequirementField !== field && isRequirementField

              return (
                <div key={`Col-${field}`} className="column is-6-mobile is-2 py-0">
                  <label>{fieldLabels[field] || field}</label>
                  <div className="field has-addons" style={{ marginBottom: fieldErrors[field] ? "18px" : undefined }}>
                    {renderReadOnlyInput(field)}
                    {renderEditableInput(field, {
                      disabled: isLocked,
                      extraClass: isLocked ? "has-background-grey-lighter" : "",
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ACTUALS */}
          <label>ACTUALS</label>
          <div className="columns is-multiline is-mobile pt-2">
            {actualFields.map((field) => (
              <div key={`Col-${field}`} className="column is-6-mobile is-2 py-0">
                <label>{field}</label>
                <div className="field has-addons" style={{ marginBottom: fieldErrors[field] ? "18px" : undefined }}>
                  {renderReadOnlyInput(field, true)}
                  {renderEditableInput(field, { showPercent: true })}
                </div>
              </div>
            ))}
          </div>

          {/* PLANNED */}
          <label>PLANNED</label>
          <div className="columns is-multiline is-mobile pt-2">
            {plannedFields.map((field) => (
              <div key={`Col-${field}`} className="column is-6-mobile is-2 py-0">
                <label>{field}</label>
                <div className="field has-addons" style={{ marginBottom: fieldErrors[field] ? "18px" : undefined }}>
                  {renderReadOnlyInput(field, true)}
                  {renderEditableInput(field, { showPercent: true })}
                </div>
              </div>
            ))}
          </div>

          {/* COMMENT — fully disabled */}
          <label>COMMENT</label>
          <div className="columns mb-0">
            <div key={`Col-Comment`} className="column is-12 pb-0">
              <div className="columns is-gapless is-fullwidth">
                <div className="column">
                  <textarea
                    style={{ cursor: "not-allowed" }}
                    readOnly={true}
                    className="textarea is-fullwidth has-background-grey-lighter has-text-light"
                    aria-label="comment-locked"
                    value={(entry && entry["Comment"]) || "none"}
                  />
                </div>
                <div className="column">
                  <textarea
                    style={{ cursor: "not-allowed" }}
                    readOnly={true}
                    disabled={true}
                    className="textarea is-fullwidth has-background-grey-lighter"
                    aria-label="comment-disabled"
                    value=""
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SUBMIT */}
          <div className="columns has-text-right my-0">
            <div key={`Col-Button`} className="column is-12 py-0">
              <button
                type="button"
                className={`button is-fullwidth ${auth.allowedGuest ? "is-primary" : "is-danger"}`}
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
        <br />
      </div>
    </>
  )
}

export default EntryForm