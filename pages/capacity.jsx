import Head from 'next/head';
import { useState } from 'react';
import useData from '../hooks/useData';
import useForm from '../hooks/useForm';
import StructureDropdown from '../components/selection/StructureDropdown';
import { FaLock } from 'react-icons/fa';
import { useAuth } from '../contexts/authContext';

import { FaExternalLinkAlt } from 'react-icons/fa';
import useWeeks from '../hooks/useWeeks';
import useCapacity from '../hooks/useCapacity';
import WeekDropdown from '../components/selection/WeekDropdown';

import CapacityViewer from '../components/capacity/CapacityViewer';
import TotalPercentageChart from '../components/capacity/TotalPercentageChart';
import CapacityDataGrid from '../components/capacity/CapacityDataGrid';
import EntriesModal from '../components/entries/EntriesModal';

const selectionFields = [
  { name: 'country', default: null, required: true, type: 'object', level: 1 },
  { name: 'project', default: null, required: true, type: 'object', level: 2 },
  { name: 'lob', default: null, required: true, type: 'object', level: 3 },
  { name: 'capPlan', default: null, required: true, type: 'object', level: 4 },
  {
    name: 'fromWeek',
    default: null,
    required: true,
    type: 'object',
    level: 1,
  },
  { name: 'toWeek', default: null, required: true, type: 'object', level: 1 },
];

const entrySelectionFields = [
  {
    name: 'entryWeek',
    default: null,
    required: true,
    type: 'object',
    level: 1,
  },
];

export default function Capacity() {
  const [weekRange, setWeekRange] = useState([]);
  const [active, setActive] = useState(false);
  const [withStaff, setWithStaff] = useState(false);
  const [channelFields, setChannelFields] = useState([]);

  const auth = useAuth();

  const data = useData([
    'countries',
    'projects',
    'lobs',
    'capPlans',
    'languages',
    'fields',
    'weeks',
  ]);

  if (data && data.fields) {
    console.log(
      data.fields.sort((a, b) => parseInt(a.order) - parseInt(b.order))
    );
  } else {
    console.log('no fields yet');
  }

  const weeks = useWeeks(
    data.weeks &&
      data.weeks.sort((a, b) =>
        a.firstDate > b.firstDate ? 1 : a.firstDate < b.firstDate ? -1 : 0
      )
  );

  const capacity = useCapacity();

  const selection = useForm({
    fields: selectionFields,
  });

  const entrySelection = useForm({
    fields: entrySelectionFields,
  });

  const handleGenerate = () => {
    let capPlan = selection.get('capPlan');

    if (capPlan.staffing && capPlan.staffing.channels) {
      setChannelFields(
        capPlan.staffing.channels.map((channel, index) => {
          return [
            {
              internal: channel.name + '.pVolumes',
              external: `P. Volumes (${channel.name})`,
              order: 1007 + index / 10 + 1 / 100,
              type: 'staffing',
            },
            {
              internal: channel.name + '.pAHT',
              external: `P. AHT (${channel.name})`,
              order: 1007 + index / 10 + 2 / 100,
              type: 'staffing',
            },
            {
              internal: channel.name + '.actVolumes',
              external: `Act. Volumes (${channel.name})`,
              order: 1007 + index / 10 + 3 / 100,
              type: 'staffing',
            },
            {
              internal: channel.name + '.actAHT',
              external: `Act. AHT (${channel.name})`,
              order: 1007 + index / 10 + 4 / 100,
              type: 'staffing',
            },
          ];
        })
      );
    }

    capacity.generate(capPlan);
    let from = selection.get('fromWeek');
    let to = selection.get('toWeek');
    setWeekRange(weeks.getWeekRange(from.code, to.code));
  };

  const handleToggle = () => {
    if (active && selection.get('fromWeek') && selection.get('toWeek')) {
      handleGenerate();
    }
    setActive(!active);
  };

  return (
    <>
      <Head>
        <title>Planning App | Capacity</title>
      </Head>
      {entrySelection.get('entryWeek') ? (
        <EntriesModal
          selection={selection}
          week={entrySelection.get('entryWeek')}
          toggle={handleToggle}
          active={active}
          weeks={data.weeks.sort((a, b) =>
            a.firstDate > b.firstDate ? 1 : a.firstDate < b.firstDate ? -1 : 0
          )}
        />
      ) : null}

      <div>
        <h1 className="has-text-centered mb-2 is-size-5">CAPACITY</h1>
        <div className="column">
          {!auth.allowedGuest ? (
            <div className="message is-danger is-size-5 px-5 py-5">
              <span className="">
                <FaLock />
              </span>{' '}
              UNAUTHORIZED ACCESS
            </div>
          ) : (
            <div>
              <div className="columns">
                <div className="column is-two-thirds">
                  <div className="columns">
                    <div className="column field">
                      <label className="label">Selection</label>
                      <StructureDropdown
                        structureName="project"
                        selection={selection}
                        data={
                          data && data.projects
                            ? [...data.projects].sort((a, b) =>
                                a.name.localeCompare(b.name)
                              ) // Sort alphabetically by name
                            : []
                        }
                        // data={data && data.projects}
                        disabled={false}
                        reset={['lob', 'country', 'capPlan']}
                        callback={(f) => {
                          f.resetAll();
                        }}
                      />
                      <StructureDropdown
                        structureName="lob"
                        selection={selection}
                        reset={['capPlan']}
                        data={
                          data &&
                          selection.get('project') &&
                          data.lobs
                            .filter(
                              (lob) =>
                                lob.project === selection.get('project')._id
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                        }
                        disabled={
                          !selection.get('project') ||
                          data.lobs.filter(
                            (lob) =>
                              lob.project === selection.get('project')._id
                          ).length <= 0
                        }
                      />
                      <StructureDropdown
                        structureName="country"
                        selection={selection}
                        data={
                          data &&
                          selection.get('lob') &&
                          data.countries
                            .filter((country) => {
                              const selectedLobs = selection.get('lob')._id;
                              const capPlanLobs = data.capPlans.filter(
                                (capPlan) => capPlan.lob === selectedLobs
                              );

                              console.log(capPlanLobs);

                              return capPlanLobs.find(
                                (capPlan) => capPlan.country === country.name
                              );
                            })
                            .sort((a, b) => a.name.localeCompare(b.name))
                        }
                        disabled={!selection.get('lob')}
                        reset={['capPlan']}
                        callback={(f) => {
                          f.resetAll();
                        }}
                      />

                      <StructureDropdown
                        structureName="capPlan"
                        selection={selection}
                        data={
                          data &&
                          selection.get('lob') &&
                          selection.get('country') &&
                          data.capPlans
                            .filter(
                              (capPlan) =>
                                capPlan.lob === selection.get('lob')._id &&
                                capPlan.country ===
                                  selection.get('country').name
                            )
                            .sort((a, b) => a.name.localeCompare(b.name))
                        }
                        disabled={!selection.get('country')}
                      />
                    </div>
                  </div>
                  <div className="columns">
                    <div className="column field">
                      <label className="label">Weeks</label>
                      <WeekDropdown
                        fieldName="fromWeek"
                        label="From-Week"
                        form={selection}
                        weekRange={
                          weeks &&
                          weeks.getWeekRange(
                            selection.get('capPlan')
                              ? selection.get('capPlan').firstWeek
                              : '2021w1',
                            null
                          )
                        }
                        disabled={!selection.get('capPlan')}
                        callback={(f, s) => {
                          if (
                            f.get('toWeek') &&
                            s.firstDate > f.get('toWeek').firstDate
                          ) {
                            f.setMany({
                              ...f.getForm(),
                              toWeek: s,
                              fromWeek: s,
                            });
                          }
                        }}
                      />
                      <WeekDropdown
                        fieldName="toWeek"
                        label="To-Week"
                        form={selection}
                        weekRange={
                          weeks &&
                          weeks.getWeekRange(
                            selection.get('capPlan')
                              ? selection.get('capPlan').firstWeek
                              : '2021w1',
                            null
                          )
                        }
                        disabled={!selection.get('capPlan')}
                        callback={(f, s) => {
                          if (
                            f.get('fromWeek') &&
                            s.firstDate < f.get('fromWeek').firstDate
                          ) {
                            f.setMany({
                              ...f.getForm(),
                              toWeek: s,
                              fromWeek: s,
                            });
                          }
                        }}
                      />
                      <button
                        className="button is-small is-rounded is-info"
                        onClick={() =>
                          selection.setMany({
                            ...selection.getForm(),
                            fromWeek: weeks.getWeekRelative(parseFloat('-2')),
                            toWeek: weeks.getWeekRelative(
                              data.weeks.length -
                                data.weeks.indexOf(weeks.getCurrentWeek()) <
                                9
                                ? data.weeks.length -
                                    data.weeks.indexOf(weeks.getCurrentWeek()) -
                                    1
                                : parseFloat('9')
                            ),
                          })
                        }
                      >
                        Auto Weeks
                      </button>
                    </div>
                  </div>
                  <div className="columns">
                    <div className="column field">
                      <button
                        className="button is-primary is-small is-rounded"
                        onClick={handleGenerate}
                        disabled={!selection.checkRequired()}
                      >
                        Generate Capacity
                      </button>
                    </div>
                  </div>
                </div>
                <div className="column has-text-right-tablet is-one-third">
                  <div className="columns ">
                    <div className="column field ">
                      <label className="label">Edit Entries</label>
                      <WeekDropdown
                        fieldName="entryWeek"
                        label="Entry-Week"
                        form={entrySelection}
                        weekRange={
                          weeks &&
                          weeks.getWeekRange(
                            selection.get('capPlan')
                              ? selection.get('capPlan').firstWeek
                              : '2021w1',
                            null
                          )
                        }
                        disabled={!selection.get('capPlan')}
                      />
                    </div>
                  </div>
                  <div className="columns">
                    <div className="column field">
                      <button
                        className="button is-info is-small is-rounded"
                        onClick={() =>
                          entrySelection.set(
                            'entryWeek',
                            weeks.getCurrentWeek()
                          )
                        }
                        disabled={!selection.get('capPlan')}
                      >
                        Current Week
                      </button>
                      <button
                        className="button is-primary is-small is-rounded"
                        onClick={handleToggle}
                        disabled={!entrySelection.checkRequired()}
                      >
                        Edit Entry
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {capacity.isGenerated() && (
                <div id={'cap-viewer'}>
                  {capacity.getLastUpdated() && (
                    <>
                      <div className="is-size-6">
                        Last Updated:{' '}
                        <span className="tag mr-3 is-rounded is-light is-success">
                          {capacity.getLastUpdated().lastUpdated}
                        </span>
                        Updated By:{' '}
                        <span className="tag mr-3 is-rounded is-link is-light">
                          {capacity.getLastUpdated().updatedBy}
                        </span>
                        Type:{' '}
                        <span className="tag mr-3 is-rounded is-danger is-light">
                          {capacity.getLastUpdated().updateType}
                        </span>
                      </div>
                    </>
                  )}
                  <br />
                  <div className="is-size-5 is-flex ">
                    <label className="label is-size-5">Capacity Viewer</label>

                    <a className="tag ml-3 is-rounded" href={'#charts'}>
                      charts <FaExternalLinkAlt className="ml-1" />
                    </a>
                    <a className="tag ml-3 is-rounded" href={'#grid'}>
                      grid <FaExternalLinkAlt className="ml-1" />
                    </a>

                    {/* <button
                      className={`button is-small is-rounded ml-auto ${
                        withStaff ? 'is-danger' : 'is-success'
                      }`}
                      onClick={() => setWithStaff(!withStaff)}
                    >
                      Toggle Staffing
                    </button> */}
                  </div>

                  <br />
                  <CapacityViewer
                    capacity={capacity.get(weekRange)}
                    currentWeek={weeks.getWeekRelative('-1')}
                    fields={[...channelFields.flat(), ...data.fields].sort(
                      (a, b) => parseInt(a.order) - parseInt(b.order)
                    )}
                    withStaff={withStaff}
                  />

                  <br />
                </div>
              )}

              {capacity.isGenerated() && (
                <div id={'charts'}>
                  <h2 className="is-size-5">
                    Charts{' '}
                    <a className="tag ml-1 is-rounded" href={'#cap-viewer'}>
                      cap-viewer <FaExternalLinkAlt className="ml-1" />
                    </a>
                    <a className="tag ml-1 is-rounded" href={'#grid'}>
                      grid <FaExternalLinkAlt className="ml-1" />
                    </a>
                  </h2>
                  <h3 className="has-text-centered">OVERALL VISION</h3>
                  <TotalPercentageChart
                    data={capacity.get(weekRange)}
                    lines={[
                      'billableFTE',
                      'budgetFTE',
                      'requiredFTE',
                      'totalHC',
                      'expectedFTE',
                    ]}
                    bars={['attrPercent', 'fcAttrition']}
                  />
                  <br />
                  <h3 className="has-text-centered">InCenter: ACTUALS VS REQUIRED</h3>
                  <TotalPercentageChart
                    data={capacity.get(weekRange)}
                    lines={['requiredFTE', 'expectedFTE']}
                  />
                  <br />
                  <h3 className="has-text-centered">ACTUALS VS FINANCIALS</h3>
                  <TotalPercentageChart
                    data={capacity.get(weekRange)}
                    lines={['budgetFTE', 'fcFTE', 'totalFTE', 'expectedFTE']}
                  />
                  <br />
                  <h3 className="has-text-centered">ATTRITION TREND</h3>
                  <TotalPercentageChart
                    data={capacity.get(weekRange)}
                    lines={['expectedAttrition', 'budgetAtt']}
                    bars={['attrPercent', 'fcAttrition']}
                  />
                  <br />
                  <h3 className="has-text-centered">NH & TRAINING</h3>
                  <TotalPercentageChart
                    data={capacity.get(weekRange)}
                    lines={['trainees', 'nesting']}
                    bars={['trCommit']}
                  />
                  <br />
                </div>
              )}

              {capacity.isGenerated() && (
                <div id={'grid'}>
                  <br />
                  <h2 className="is-size-5">
                    Grid{' '}
                    <a className="tag ml-1 is-rounded" href={'#cap-viewer'}>
                      cap-viewer <FaExternalLinkAlt className="ml-1" />
                    </a>
                    <a className="tag ml-1 is-rounded" href={'#charts'}>
                      charts <FaExternalLinkAlt className="ml-1" />
                    </a>
                  </h2>
                  <br />
                  <CapacityDataGrid
                    data={capacity.get(weekRange)}
                    fields={data.fields}
                  />
                  <br />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
