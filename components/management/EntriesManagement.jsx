import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/authContext';
import FoundeverLogo from '../foundeverlogo';
import { FaLock } from 'react-icons/fa';
import CSVUploader from '../files/CSVUploader';
import { validateFieldValue } from '../../lib/fieldValidation';

// Utility function to fetch existing entries for a list of (capPlan, week)
async function fetchExistingEntries(keys) {
  const response = await fetch('/api/data/entries/bulkFetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys }),
  });
  if (!response.ok) throw new Error('Failed to fetch existing entries');
  return await response.json();
}

function recalculateRequirements(row) {
  const parseNum = value =>
    value === undefined || value === null || value === "" ? NaN : Number(String(value).replace(",", "."));
  const plannedVac = parseNum(row.plannedVac) / 100 || 0;
  const plannedAbs = parseNum(row.plannedAbs) / 100 || 0;
  const plannedAux = parseNum(row.plannedAux) / 100 || 0;
  let gross = parseNum(row.grossRequirement);
  let inCenter = parseNum(row.inCenterRequirement);
  let productive = parseNum(row.productiveRequirement);

  if (
    (isNaN(gross) || gross === 0) &&
    (isNaN(inCenter) || inCenter === 0) &&
    (isNaN(productive) || productive === 0)
  ) {
    return {
      grossRequirement: '',
      inCenterRequirement: '',
      productiveRequirement: ''
    };
  }

  if (!isNaN(gross) && gross > 0) {
    inCenter = gross * (1 - (plannedVac + plannedAbs));
    productive = inCenter * (1 - plannedAux);
  } else if (!isNaN(inCenter) && inCenter > 0) {
    gross = inCenter / (1 - (plannedVac + plannedAbs));
    productive = inCenter * (1 - plannedAux);
  } else if (!isNaN(productive) && productive > 0) {
    inCenter = productive / (1 - plannedAux);
    gross = inCenter / (1 - (plannedVac + plannedAbs));
  }

  return {
    grossRequirement: !isNaN(gross) && gross !== 0 ? gross.toFixed(2) : '',
    inCenterRequirement: !isNaN(inCenter) && inCenter !== 0 ? inCenter.toFixed(2) : '',
    productiveRequirement: !isNaN(productive) && productive !== 0 ? productive.toFixed(2) : ''
  };
}

// ============================
// BULK VALIDATION
// ============================
const SKIP_VALIDATION_FIELDS = ['capPlan', 'lob', 'project', 'week'];

function validateBulkUpload(rows) {
  const validRows = [];
  const invalidRows = [];
  const errorSummary = [];

  rows.forEach((row, rowIndex) => {
    const rowErrors = [];

    Object.keys(row).forEach((field) => {
      if (SKIP_VALIDATION_FIELDS.includes(field)) return;

      const value = row[field];

      if (value === undefined || value === null || String(value).trim() === '') return;

      const { valid, error } = validateFieldValue(field, String(value).trim());

      if (!valid) {
        rowErrors.push({ field, value, error });
      }
    });

    if (rowErrors.length > 0) {
      invalidRows.push({ rowIndex: rowIndex + 1, row, errors: rowErrors });
      rowErrors.forEach(({ field, value, error }) => {
        errorSummary.push(
          `Row ${rowIndex + 1} → "${field}": value "${value}" — ${error}`
        );
      });
    } else {
      validRows.push(row);
    }
  });

  return { validRows, invalidRows, errorSummary };
}

const EntriesManagement = ({ data }) => {
  const [upload, setUpload] = useState([]);
  const [valid, setValid] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);

  const [staffUpload, setStaffUpload] = useState([]);
  const [staffValid, setStaffValid] = useState(false);

  const auth = useAuth();

  useEffect(() => {
    const isValid = (upload) => {
      let hasInvalidField = false;
      let hasWeek = 0;
      let hasTarget = 0;

      const requirementFields = ['grossRequirement', 'inCenterRequirement', 'productiveRequirement', 'billable', 'required'];
      const fieldMapping = {
        'grossRequirement': 'grossRequirement',
        'inCenterRequirement': 'inCenterRequirement',
        'productiveRequirement': 'productiveRequirement'
      };
      const presentRequirementFields = [];

      Object.keys(upload[0]).forEach((key) => {
        if (['capPlan', 'lob', 'project'].includes(key)) {
          hasTarget++;
        } else if (key === 'week') {
          hasWeek++;
        } else if (requirementFields.includes(key)) {
          presentRequirementFields.push(key);
        } else {
          let found = data.fields.find((field) => field.internal === key);
          if (!found) {
            hasInvalidField = true;
          }
        }
      });

      upload.forEach(row => {
        Object.keys(row).forEach(key => {
          if (fieldMapping[key] && fieldMapping[key] !== key) {
            row[fieldMapping[key]] = row[key];
            delete row[key];
          }
        });
      });

      const mappedRequirementFields = [];
      Object.keys(upload[0]).forEach((key) => {
        if (['grossRequirement', 'inCenterRequirement', 'productiveRequirement'].includes(key)) {
          mappedRequirementFields.push(key);
        }
      });

      let valid = hasTarget === 1 && hasWeek === 1 && !hasInvalidField;

      if (!valid) {
        alert('Invalid Upload File');
      }

      return valid;
    };

    upload[0] ? setValid(isValid(upload)) : setValid(false);
  }, [upload]);

  useEffect(() => {
    const isValid = (staffUpload) => {
      let hasInvalidField = false;
      let hasWeek = 0,
        hasTarget = 0,
        hasName = 0;
      Object.keys(staffUpload[0]).forEach((key) => {
        if (key === 'capPlan') {
          hasTarget++;
        } else if (key === 'week') {
          hasWeek++;
        } else if (key === 'name') {
          hasName++;
        } else {
          let found = ['volumes', 'aht'].includes(key);
          if (!found) {
            hasInvalidField = true;
          }
        }
      });

      let valid =
        hasTarget === 1 && hasWeek === 1 && hasName === 1 && !hasInvalidField;

      if (!valid) {
        alert('Invalid Upload File');
      }

      return valid;
    };

    staffUpload[0] ? setStaffValid(isValid(staffUpload)) : setStaffValid(false);
  }, [staffUpload]);

  // HANDLERS
  const handleSubmit = async (type) => {
    if (type === 'standard') {
      if (upload.length <= 500) {
        await fetch(`/api/data/entries/bulk`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({ payloads: upload }),
        })
          .then((response) => response.json())
          .then((data) => {
            alert(data.message);
          })
          .catch((err) => console.log(err));
      } else {
        let mult = Math.trunc(upload.length / 500);
        for (let i = 0; i <= mult; i++) {
          await fetch(`/api/data/entries/bulk`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: auth.authorization(),
            },
            body: JSON.stringify({
              payloads: upload.slice(i * 500, (i + 1) * 500),
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (i === mult) {
                alert(`Uploaded ${mult + 1} batches!`);
              }
            })
            .catch((err) => console.log(err));
        }
      }
    }
  };

  const handleSubmitStaff = (type) => {
    if (type === 'planned') {
      staffUpload.forEach((row) =>
        fetch(
          `/api/data/entries/planned?week=${row.week}&capPlan=${row.capPlan}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
          .then((data) => {})
          .catch((err) => console.log(err))
      );
    } else if (type === 'actual') {
      staffUpload.forEach((row) =>
        fetch(
          `/api/data/entries/actual?week=${row.week}&capPlan=${row.capPlan}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
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
            console.log(data.message);
          })
          .catch((err) => console.log(err))
      );
    }
    alert('Submitted bulk import, check console for logs');
  };

  return (
    <>
      {auth.allowedAdmin ? (
        data && data.projects ? (
          <div>
            {/*////////////////////////////////////////////////////// BULK UPLOAD ////////////////////////////////////////////////*/}
            <div className="columns is-multiline">
              <div className="column">
                <label className="label">Bulk Upload</label>
                <CSVUploader
                  removeHandler={() => {
                    setUpload([]);
                    setValidationErrors([]);
                  }}
                  loadedHandler={async (csv) => {
                    const missing = v =>
                      v === undefined || v === null || (typeof v === "string" && v.trim() === "");

                    // ============================
                    // STEP 1: VALIDATE RAW CSV FIRST
                    // ============================
                    const { validRows: _, invalidRows, errorSummary } = validateBulkUpload(csv);

                    if (invalidRows.length > 0) {
                      const maxDisplay = 20;
                      const displayErrors = errorSummary.slice(0, maxDisplay);
                      const remaining = errorSummary.length - maxDisplay;

                      let alertMsg =
                        `⚠️ Validation Failed — ${invalidRows.length} row(s) contain invalid data.\n\n` +
                        `The following issues were found:\n\n` +
                        displayErrors.join('\n');

                      if (remaining > 0) {
                        alertMsg += `\n\n...and ${remaining} more error(s). Please fix your CSV and re-upload.`;
                      }

                      alertMsg += `\n\n❌ Upload blocked. Please fix your CSV and re-upload.`;

                      alert(alertMsg);
                      setValidationErrors(errorSummary);
                      setUpload([]);
                      return;
                    }

                    // ============================
                    // STEP 2: FETCH DB ENTRIES
                    // ============================
                    const keys = csv.map(row => ({ capPlan: row.capPlan, week: row.week }));

                    let dbEntries = [];
                    try {
                      dbEntries = await fetchExistingEntries(keys);
                    } catch (e) {
                      alert("Error fetching existing planned values from DB.");
                      setUpload([]);
                      return;
                    }

                    const findDbEntry = (row) =>
                      dbEntries.find(
                        dbRow => dbRow.capPlan === row.capPlan && dbRow.week === row.week
                      ) || {};

                    const warnings = [];

                    // ============================
                    // STEP 3: ENRICH & RECALCULATE
                    // ============================
                    const processed = csv.map(row => {
                      const dbRow = findDbEntry(row);

                      const pVac = !missing(row.plannedVac) ? row.plannedVac : dbRow.plannedVac;
                      const pAbs = !missing(row.plannedAbs) ? row.plannedAbs : dbRow.plannedAbs;
                      const pAux = !missing(row.plannedAux) ? row.plannedAux : dbRow.plannedAux;

                      let missingFields = [];
                      if (missing(pVac)) missingFields.push('plannedVac');
                      if (missing(pAbs)) missingFields.push('plannedAbs');
                      if (missing(pAux)) missingFields.push('plannedAux');
                      if (missingFields.length) {
                        warnings.push(`capPlan: ${row.capPlan}, week: ${row.week} (Missing: ${missingFields.join(', ')})`);
                      }

                      const enriched = {
                        ...row,
                        plannedVac: pVac ?? 0,
                        plannedAbs: pAbs ?? 0,
                        plannedAux: pAux ?? 0,
                      };

                      const hasGross = !missing(row.grossRequirement);
                      const hasInCenter = !missing(row.inCenterRequirement);
                      const hasProd = !missing(row.productiveRequirement);

                      if (hasGross || hasInCenter || hasProd) {
                        const calc = recalculateRequirements(enriched);
                        return {
                          ...enriched,
                          grossRequirement: calc.grossRequirement,
                          inCenterRequirement: calc.inCenterRequirement,
                          productiveRequirement: calc.productiveRequirement
                        };
                      } else {
                        return enriched;
                      }
                    });

                    if (warnings.length) {
                      alert(
                        `Warning: The following entries are missing planned shrinkage data (will be treated as zero for calculation):\n\n`
                        + warnings.join('\n')
                      );
                    }

                    // ============================
                    // STEP 4: SANITIZE & SET
                    // ============================
                    const sanitized = processed.map(row => {
                      const { totalHC, totalFTE, ...rest } = row;
                      return rest;
                    });

                    setValidationErrors([]);
                    setUpload(sanitized);
                  }}
                  label={'capPlan (ObjId) - week (####w#) - [fields...]'}
                />
                <button
                  className="button is-small m-1 is-primary is-rounded"
                  onClick={() => {
                    handleSubmit('standard');
                  }}
                  disabled={
                    !(
                      valid &&
                      upload &&
                      Object.keys(upload[0]).includes('capPlan')
                    )
                  }
                >
                  Upload
                </button>

                {/* VALIDATION ERROR DISPLAY */}
                {validationErrors.length > 0 && (
                  <div
                    className="notification is-danger is-light mt-3"
                    style={{
                      maxHeight: '250px',
                      overflowY: 'auto',
                      fontSize: '0.8em',
                    }}
                  >
                    <button
                      className="delete"
                      onClick={() => setValidationErrors([])}
                    ></button>
                    <p className="has-text-weight-bold mb-2">
                      ⚠️ {validationErrors.length} validation error(s) found in CSV:
                    </p>
                    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                      {validationErrors.map((err, idx) => (
                        <li key={`val-err-${idx}`} className="mb-1">
                          ❌ {err}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <br></br>
                <br></br>
              </div>
              <div className="column is-narrow has-text-right">
                <label className="label">Field Check</label>

                {upload.length ? (
                  <div>
                    {Object.keys(upload[0]).map((header) => (
                      <div key={'uploadField-' + header}>
                        {header}
                        {data.fields.find(
                          (field) => field.internal === header
                        ) ? (
                          <span className="tag is-success ml-2">Valid</span>
                        ) : ['capPlan', 'lob', 'project', 'week'].includes(
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
                      Entries{' '}
                      <span className="tag is-info ml-2">
                        {upload.length || 0}
                      </span>
                    </div>
                    <div>
                      Fields{' '}
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
                    handleSubmitStaff('planned');
                  }}
                  disabled={
                    !(
                      staffValid &&
                      staffUpload &&
                      Object.keys(staffUpload[0]).includes('capPlan')
                    )
                  }
                >
                  Upload Planned
                </button>
                <button
                  className="button is-small m-1 is-primary is-rounded"
                  onClick={() => {
                    handleSubmitStaff('actual');
                  }}
                  disabled={
                    !(
                      staffValid &&
                      staffUpload &&
                      Object.keys(staffUpload[0]).includes('capPlan')
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
                      <div key={'uploadField-' + header}>
                        {header}
                        {['volumes', 'aht'].find(
                          (field) => field === header
                        ) ? (
                          <span className="tag is-success ml-2">Valid</span>
                        ) : ['capPlan', 'week', 'name'].includes(header) ? (
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
                      Entries{' '}
                      <span className="tag is-info ml-2">
                        {staffUpload.length || 0}
                      </span>
                    </div>
                    <div>
                      Fields{' '}
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
          <div className="loaderContainer">
            <div className="loaderConstrain">
              <FoundeverLogo />
            </div>
          </div>
        )
      ) : (
        <div className="message is-danger is-size-5 px-5 py-5">
          <span className="">
            <FaLock />
          </span>{' '}
          UNAUTHORIZED ACCESS
        </div>
      )}
    </>
  );
};

export default EntriesManagement;