import { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/authContext';
import FoundeverLogo from '../foundeverlogo';
import { FaLock } from 'react-icons/fa';
import CSVUploader from '../files/CSVUploader';

// Utility function to fetch existing entries for a list of (capPlan, week)
async function fetchExistingEntries(keys) {
  // keys = array of { capPlan, week }
  // You'll need to create the /api/data/entries/bulkFetch endpoint (see below)
  const response = await fetch('/api/data/entries/bulkFetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }, // Add auth if required
    body: JSON.stringify({ keys }),
  });
  if (!response.ok) throw new Error('Failed to fetch existing entries');
  return await response.json(); // Should be an array of objects (same structure as MongoDB docs)
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

  // If all are blank/NaN, return all empty
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

  // Otherwise, proceed as normal
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

const EntriesManagement = ({ data }) => {
  const [upload, setUpload] = useState([]);
  const [valid, setValid] = useState(false);

  const [staffUpload, setStaffUpload] = useState([]);
  const [staffValid, setStaffValid] = useState(false);

  const auth = useAuth();

  useEffect(() => {
    const isValid = (upload) => {
      let hasInvalidField = false;
      let hasWeek = 0;
      let hasTarget = 0;
      
      // Check for conflicting requirement fields (including legacy field names)
      const requirementFields = ['grossRequirement', 'inCenterRequirement', 'productiveRequirement', 'billable', 'required'];
      const fieldMapping = {
        //'productiveRequirement': 'productiveRequirement',
        //'inCenterRequirement': 'inCenterRequirement',
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

      // Map legacy field names to new field names
      upload.forEach(row => {
        Object.keys(row).forEach(key => {
          if (fieldMapping[key] && fieldMapping[key] !== key) {
            row[fieldMapping[key]] = row[key];
            delete row[key];
          }
        });
      });

      // After mapping, check for conflicts again
      const mappedRequirementFields = [];
      Object.keys(upload[0]).forEach((key) => {
        if (['grossRequirement', 'inCenterRequirement', 'productiveRequirement'].includes(key)) {
          mappedRequirementFields.push(key);
        }
      });

      // If multiple requirement fields are present, prioritize and remove others
      
      /*
      // ...this block can be removed if you're filling fields automatically

      if (mappedRequirementFields.length > 1) {
        // Priority order: grossRequirement > inCenterRequirement > productiveRequirement
        const priority = ['grossRequirement', 'inCenterRequirement', 'productiveRequirement'];
        const selectedField = mappedRequirementFields.find(field => priority.includes(field)) || mappedRequirementFields[0];
        
        // Remove conflicting fields from all upload rows
        upload.forEach(row => {
          mappedRequirementFields.forEach(field => {
            if (field !== selectedField) {
              delete row[field];
            }
          });
        });
        
        alert(`Multiple requirement fields detected. Using ${selectedField} and ignoring others to prevent calculation conflicts.`);
      }
      
      */

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

      // console.log(hasTarget, hasWeek, hasName, hasInvalidField)

      let valid =
        hasTarget === 1 && hasWeek === 1 && hasName === 1 && !hasInvalidField;

      if (!valid) {
        alert('Invalid Upload File');
      }

      return valid;
    };

    staffUpload[0] ? setStaffValid(isValid(staffUpload)) : setStaffValid(false);
  }, [staffUpload]);

  //HANDLERS
  const handleSubmit = async (type) => {
    //console.log('UPLOAD LENGTH', upload.length);
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
           // console.log(data.message);
            alert(data.message);
          })
          .catch((err) => console.log(err));
      } else {
        let mult = Math.trunc(upload.length / 500);
        //console.log('MULT', upload.length);
        for (let i = 0; i <= mult; i++) {
          //console.log('FETCH #', i);
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
              //console.log(data.message);
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
          .then((data) => {
            //console.log(data.message);
          })
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
                  removeHandler={() => setUpload([])}
                  loadedHandler={async (csv) => {
                    const missing = v =>
                      v === undefined || v === null || (typeof v === "string" && v.trim() === "");

                    // 1. Prepare keys for bulk fetch
                    const keys = csv.map(row => ({ capPlan: row.capPlan, week: row.week }));

                    // 2. Fetch existing entries
                    let dbEntries = [];
                    try {
                      dbEntries = await fetchExistingEntries(keys); // Your helper
                    } catch(e) {
                      alert("Error fetching existing planned values from DB.");
                      setUpload([]);
                      return;
                    }

                    const findDbEntry = (row) =>
                      dbEntries.find(
                        dbRow => dbRow.capPlan === row.capPlan && dbRow.week === row.week
                      ) || {};

                    // 3. Track warnings
                    const warnings = [];

                    // 4. Process each row
                    const processed = csv.map(row => {
                      const dbRow = findDbEntry(row);

                      const pVac = !missing(row.plannedVac) ? row.plannedVac : dbRow.plannedVac;
                      const pAbs = !missing(row.plannedAbs) ? row.plannedAbs : dbRow.plannedAbs;
                      const pAux = !missing(row.plannedAux) ? row.plannedAux : dbRow.plannedAux;

                      // Warn if any planned shrinkage is missing from both CSV and DB
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

                      const hasGross = !missing(enriched.grossRequirement);
                      const hasInCenter = !missing(enriched.inCenterRequirement);
                      const hasProd = !missing(enriched.productiveRequirement);

                      if (!hasGross || !hasInCenter || !hasProd) {
                        const calc = recalculateRequirements(enriched);
                        return {
                          ...enriched,
                          grossRequirement: hasGross ? enriched.grossRequirement : calc.grossRequirement,
                          inCenterRequirement: hasInCenter ? enriched.inCenterRequirement : calc.inCenterRequirement,
                          productiveRequirement: hasProd ? enriched.productiveRequirement : calc.productiveRequirement,
                        };
                      }
                      return enriched;
                    });

                    // 5. Show alert if there are any warnings
                    if (warnings.length) {
                      alert(
                        `Warning: The following entries are missing planned shrinkage data (will be treated as zero for calculation):\n\n`
                        + warnings.join('\n')
                      );
                    }

                    setUpload(processed);
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
                      upload[0] &&
                      Object.keys(upload[0]).includes('capPlan')
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
                      staffUpload[0] &&
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
                      staffUpload[0] &&
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
