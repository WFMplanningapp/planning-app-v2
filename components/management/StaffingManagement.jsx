import { useState } from 'react';
import { useAuth } from '../../contexts/authContext';
import useForm from '../../hooks/useForm';
import StructureDropdown from '../selection/StructureDropdown';
import FoundeverLogo from '../foundeverlogo';
import { FaLock } from 'react-icons/fa';
import CSVUploader from '../files/CSVUploader';
import Heatmap from '../staffing/Heatmap';

const selectionFields = [
  { name: 'project', default: null, required: true, type: 'object', level: 1 },
  { name: 'lob', default: null, required: true, type: 'object', level: 2 },
  { name: 'capPlan', default: null, required: true, type: 'object', level: 3 },
  { name: 'channel', default: null, required: false, type: 'array', level: 4 },
];

const formFields = [
  {
    name: 'auxDist',
    default: false,
    required: true,
    type: 'check',
    label: 'Aux Dist',
  },
  {
    name: 'absFromTotal',
    default: true,
    required: false,
    type: 'check',
    label: 'ABS from Total',
  },
  {
    name: 'fteHours',
    default: 40,
    required: false,
    type: 'number',
    label: 'Number of hours for one FTE',
  },
  {
    name: 'interval',
    default: 900,
    required: false,
    type: 'number',
    label: 'Number of seconds on the base interval',
  },
  {
    name: 'blendOcc',
    default: 1,
    required: false,
    type: 'number',
    label: 'Blended Occupancy',
  },
];

const StaffingManagement = ({ data }) => {
  const [distros, setDistros] = useState([]);
  const [channels, setChannels] = useState([]);
  const [copyTo, setCopyTo] = useState([]);

  const auth = useAuth();

  const selection = useForm({
    fields: selectionFields,
  });

  const form = useForm({
    fields: formFields,
  });

  //HANDLERS
  const handleSubmit = async (payload) => {
    await fetch(
      `/api/data/management/capPlan?id=${
        selection.get('capPlan') && selection.get('capPlan')._id
      }`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth.authorization(),
        },
        body: JSON.stringify({ payload }),
      }
    )
      .then((response) => response.json())
      .then((data) => {
        alert(data.message);
      })
      .catch((err) => console.log(err));
    data.refresh();
    selection.resetOne('capPlan');
  };

  const handleCopyStaffing = async () => {
    let staffingToCopy = selection.get('capPlan').staffing;

    copyTo.forEach((entry) => {
      //console.log(entry.capPlan, staffingToCopy);
      fetch(`/api/data/management/capPlan?id=${entry.capPlan}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: auth.authorization(),
        },
        body: JSON.stringify({ payload: { staffing: staffingToCopy } }),
      })
        .then((response) => response.json())
        .then((data) => {
          alert(data.message);
        })
        .catch((err) => console.log(err));
    });
  };

  return (
    <>
      {auth.allowedManager ? (
        data && data.projects ? (
          <div>
            <div id="selection" className="columns">
              <div className="column is-12 field">
                <label className="label">Selection</label>
                <StructureDropdown
                  structureName="project"
                  selection={selection}
                  form={form}
                  data={data && data.projects}
                  disabled={false}
                  reset={['lob', 'capPlan', 'channel']}
                  callback={(f) => {
                    f.resetAll();
                  }}
                />
                <StructureDropdown
                  structureName="lob"
                  selection={selection}
                  form={form}
                  data={
                    data &&
                    selection.get('project') &&
                    data.lobs.filter(
                      (lob) => lob.project === selection.get('project')._id
                    )
                  }
                  disabled={!selection.get('project')}
                  reset={['capPlan', 'channel']}
                  callback={(f) => {
                    f.resetAll();
                  }}
                />
                <StructureDropdown
                  structureName="capPlan"
                  selection={selection}
                  form={form}
                  data={
                    data &&
                    selection.get('lob') &&
                    data.capPlans.filter(
                      (capPlan) => capPlan.lob === selection.get('lob')._id
                    )
                  }
                  reset={['channel']}
                  disabled={!selection.get('lob')}
                  callback={(f, s) => {
                    if (s.staffing) {
                      f.setMany({
                        auxDist: s.staffing.auxDist,
                        absFromTotal: s.staffing.absFromTotal,
                        fteHours: s.staffing.fteHours,
                        interval: s.staffing.interval,
                        blendOcc: s.staffing.blendOcc,
                      });
                    } else {
                      f.resetAll();
                    }
                  }}
                />
              </div>
            </div>

            <div className="columns is-multiline">
              <div className="column is-half ">
                <label className="label">Configuration</label>
                <div className="field is-small is-grouped">
                  <input
                    type="number"
                    className="input is-small mx-1 is-rounded "
                    style={{ maxWidth: '7em' }}
                    value={form.get('fteHours') || ''}
                    onChange={(e) => {
                      form.set('fteHours', e.target.value);
                    }}
                    disabled={!selection.get('capPlan')}
                    placeholder="FTE Hours"
                  ></input>
                  <label>FTE Hours</label>
                </div>

                <div className="field is-small is-grouped">
                  <input
                    type="number"
                    className="input is-small mx-1 is-rounded "
                    style={{ maxWidth: '7em' }}
                    value={form.get('interval') || 900}
                    onChange={(e) => {
                      form.set('interval', e.target.value);
                    }}
                    disabled={!selection.get('capPlan')}
                    placeholder="Interval"
                  ></input>
                  <label>Interval</label>
                </div>

                <div className="field is-small is-grouped">
                  <input
                    type="number"
                    className="input is-small mx-1 is-rounded "
                    style={{ maxWidth: '7em' }}
                    value={form.get('blendOcc') * 100 || 100}
                    onChange={(e) => {
                      form.set('blendOcc', e.target.value / 100);
                    }}
                    disabled={!selection.get('capPlan')}
                    placeholder="Blended Occupancy Target"
                  ></input>
                  <label>Blended Occupancy Target (%)</label>
                </div>
                <div className="control ">
                  <input
                    type="checkbox"
                    className="my-auto mx-3"
                    checked={form.get('auxDist') || false}
                    onChange={() => {
                      form.set('auxDist', !form.get('auxDist'));
                    }}
                    disabled={!selection.get('capPlan')}
                  ></input>
                  <label>Uses Aux Dist?</label>
                </div>
                <div className="control">
                  <input
                    type="checkbox"
                    className="my-auto mx-3"
                    checked={form.get('absFromTotal') || false}
                    onChange={() => {
                      form.set('absFromTotal', !form.get('absFromTotal'));
                    }}
                    disabled={!selection.get('capPlan')}
                  ></input>
                  <label>ABS relative to Total?</label>
                </div>
                <br></br>

                <div id="update-button">
                  <button
                    className="button is-small is-success is-rounded"
                    onClick={() =>
                      handleSubmit({
                        staffing: {
                          ...(selection.get('capPlan')
                            ? selection.get('capPlan').staffing
                            : {}),
                          ...form.getForm(),
                        },
                      })
                    }
                    disabled={!selection.get('capPlan')}
                  >
                    Update Config
                  </button>
                </div>
              </div>

              <div className="column is-half has-text-right">
                <label className="label">Copy Staffing</label>
                <CSVUploader
                  removeHandler={() => setCopyTo([])}
                  loadedHandler={(csv) => setCopyTo(csv)}
                  label={'capPlan'}
                ></CSVUploader>
                <button
                  className="button is-small is-link is-rounded"
                  onClick={() => {
                    handleCopyStaffing();
                  }}
                  disabled={
                    !selection.get('capPlan') ||
                    !copyTo ||
                    !selection.get('capPlan').staffing
                  }
                >
                  Copy Staffing
                </button>
                <br></br>
                <br></br>
                <label className="label">Upload Channels</label>
                <CSVUploader
                  removeHandler={() => setChannels([])}
                  loadedHandler={(csv) => setChannels(csv)}
                  label={
                    'channel - active (boolean) - sl (0-1) - occ (0-1) - tt (s) - conc (1+)'
                  }
                ></CSVUploader>
                <button
                  className="button is-small is-link is-rounded"
                  onClick={() => {
                    handleSubmit({
                      staffing: {
                        ...(selection.get('capPlan')
                          ? selection.get('capPlan').staffing
                          : {}),
                        channels,
                      },
                    });
                  }}
                  disabled={!selection.get('capPlan')}
                >
                  Update Channels
                </button>

                <br></br>
              </div>
              <br></br>
              <br></br>
              {selection.get('capPlan') &&
                selection.get('capPlan').staffing &&
                selection.get('capPlan').staffing.channels && (
                  <>
                    <div className="column is-half">
                      <label className="label">Channel Configuration</label>
                      <StructureDropdown
                        structureName="channel"
                        selection={selection}
                        data={selection.get('capPlan').staffing.channels}
                        disabled={false}
                      />
                      <br></br>
                      <br></br>
                      <ul>
                        {selection.get('channel') &&
                          Object.keys(selection.get('channel'))
                            .filter((key) => key !== 'distros')
                            .map((key) => (
                              <li>
                                {`${key.toLocaleUpperCase()}: ${
                                  selection.get('channel')[key] || 'N/A'
                                }`}
                              </li>
                            ))}
                      </ul>
                    </div>
                    <div className="column is-half has-text-right">
                      <label className="label">Upload Distros</label>
                      <CSVUploader
                        removeHandler={() => setDistros([])}
                        loadedHandler={(csv) => setDistros(csv)}
                        label={'weekday - interval - vDist - ahtDist'}
                      ></CSVUploader>
                      <button
                        className="button is-small is-link is-rounded"
                        onClick={() => {
                          let newChannel = {
                            ...selection.get('channel'),
                            distros: distros,
                          };

                          let newStaffing = {
                            ...selection.get('capPlan').staffing,
                          };

                          newStaffing.channels = newStaffing.channels.map(
                            (channel) =>
                              channel.name === newChannel.name
                                ? newChannel
                                : channel
                          );

                          handleSubmit({
                            staffing: newStaffing,
                          });
                        }}
                        disabled={!selection.get('capPlan') || !channels}
                      >
                        Update Distros
                      </button>

                      <br></br>
                    </div>

                    {selection.get('channel') &&
                      selection.get('channel').distros && (
                        <div className="column is-one-third">
                          <label className="label">Volumes</label>

                          <Heatmap
                            xArray={[
                              { label: 'SUN', value: 1 },
                              { label: 'MON', value: 2 },
                              { label: 'TUE', value: 3 },
                              { label: 'WED', value: 4 },
                              { label: 'THU', value: 5 },
                              { label: 'FRI', value: 6 },
                              { label: 'SAT', value: 7 },
                            ]}
                            xField="weekday"
                            yField="interval"
                            yArray={[
                              ...new Set(
                                selection
                                  .get('channel')
                                  .distros.map((item) => item.interval)
                              ),
                            ]}
                            data={selection.get('channel').distros}
                            value={'vDist'}
                            max={Math.max(
                              ...selection
                                .get('channel')
                                .distros.map((item) =>
                                  item.vDist ? item.vDist : 0
                                )
                            )}
                          />
                        </div>
                      )}
                    {selection.get('channel') &&
                      selection.get('channel').distros && (
                        <div className="column is-one-third">
                          <label className="label">AHT</label>

                          <Heatmap
                            xArray={[
                              { label: 'SUN', value: 1 },
                              { label: 'MON', value: 2 },
                              { label: 'TUE', value: 3 },
                              { label: 'WED', value: 4 },
                              { label: 'THU', value: 5 },
                              { label: 'FRI', value: 6 },
                              { label: 'SAT', value: 7 },
                            ]}
                            xField="weekday"
                            yField="interval"
                            yArray={[
                              ...new Set(
                                selection
                                  .get('channel')
                                  .distros.map((item) => item.interval)
                              ),
                            ]}
                            data={selection.get('channel').distros}
                            value={'ahtDist'}
                            max={Math.max(
                              ...selection
                                .get('channel')
                                .distros.map((item) =>
                                  item.ahtDist ? item.ahtDist : 0
                                )
                            )}
                          />
                        </div>
                      )}
                    {selection.get('channel') &&
                      selection.get('channel').distros && (
                        <div className="column is-one-third">
                          <label className="label">Min Agents</label>

                          <Heatmap
                            xArray={[
                              { label: 'SUN', value: 1 },
                              { label: 'MON', value: 2 },
                              { label: 'TUE', value: 3 },
                              { label: 'WED', value: 4 },
                              { label: 'THU', value: 5 },
                              { label: 'FRI', value: 6 },
                              { label: 'SAT', value: 7 },
                            ]}
                            xField="weekday"
                            yField="interval"
                            yArray={[
                              ...new Set(
                                selection
                                  .get('channel')
                                  .distros.map((item) => item.interval)
                              ),
                            ]}
                            data={selection.get('channel').distros}
                            value={'minAgents'}
                            max={Math.max(
                              ...selection
                                .get('channel')
                                .distros.map((item) =>
                                  item.minAgents ? item.minAgents : 0
                                )
                            )}
                          />
                        </div>
                      )}
                  </>
                )}
            </div>
            <br></br>
            <br></br>
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

export default StaffingManagement;
