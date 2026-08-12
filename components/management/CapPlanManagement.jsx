import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/authContext';
import useForm from '../../hooks/useForm';
import StructureDropdown from '../selection/StructureDropdown';
import FormDropdown from '../selection/FormDropdown';
import DatePicker from 'react-datepicker';
import { registerLocale, setDefaultLocale } from 'react-datepicker';
import { enGB } from 'date-fns/locale';
import moment from 'moment';
import { FaLock, FaPlus, FaTrash, FaChevronDown, FaChevronUp } from 'react-icons/fa';
import FoundeverLogo from '../foundeverlogo';
import 'react-datepicker/dist/react-datepicker.css';

registerLocale('en-GB', enGB);
setDefaultLocale('en-GB');

const selectionFields = [
  { name: 'project', default: null, required: true, type: 'object', level: 1 },
  { name: 'lob', default: null, required: true, type: 'object', level: 2 },
  { name: 'capPlan', default: null, required: true, type: 'object', level: 3 },
  { name: 'language', default: '', required: true, type: 'object', level: 3 },
  { name: 'country', default: '', required: true, type: 'object', level: 3 },
];

const formFields = [
  {
    name: 'hourlycost',
    level4Only: true,
    default: 0,
    required: false,
    type: 'number',
    label: 'Hourly Cost',
  },
  {
    name: 'hourlyrate',
    level4Only: true,
    default: 0,
    required: false,
    type: 'number',
    label: 'Hourly Rate',
  },
  {
    name: 'name',
    default: '',
    required: true,
    type: 'text',
    label: 'Capacity Plan Name',
    placeholder: 'Capacity Plan Name',
  },
  {
    name: 'active',
    default: '',
    required: false,
    type: 'check',
    label: 'Active',
    placeholder: null,
  },
  {
    name: 'firstWeek',
    default: '',
    required: true,
    type: 'text',
    label: 'First Week (code)',
    placeholder: 'First Week (YYYYw#)',
  },
  {
    name: 'startingHC',
    default: 0,
    required: true,
    type: 'number',
    label: 'Starting HC',
  },
  {
    name: 'operationDays',
    default: [
      { weekDay: 'Monday', status: 'Closed', start: '', end: '' },
      { weekDay: 'Tuesday', status: 'Closed', start: '', end: '' },
      { weekDay: 'Wednesday', status: 'Closed', start: '', end: '' },
      { weekDay: 'Thursday', status: 'Closed', start: '', end: '' },
      { weekDay: 'Friday', status: 'Closed', start: '', end: '' },
      { weekDay: 'Saturday', status: 'Closed', start: '', end: '' },
      { weekDay: 'Sunday', status: 'Closed', start: '', end: '' },
    ],
    required: false,
    type: 'list',
    label: 'Operation Days',
    placeholder: null,
  },
  {
    name: 'fteHoursWeekly',
    default: 0,
    required: false,
    type: 'number',
    label: 'FTE Hours Weekly',
  },
  {
    name: 'pricingModel',
    default: '',
    required: false,
    type: 'text',
    label: 'Pricing Model',
  },
  {
    name: 'country',
    default: '',
    required: true,
    type: 'text',
    label: 'country',
  },
  // ── ENGINE INTEGRATION ──
  {
    name: 'engineEnabled',
    default: false,
    required: false,
    type: 'check',
    label: 'Enable Capacity Engine',
  },
  {
    name: 'engineInterval',
    default: 30,
    required: false,
    type: 'number',
    label: 'Engine Interval',
  },
  {
    name: 'engineChannels',
    default: {},
    required: false,
    type: 'object',
    label: 'Engine Channels',
  },
  // ── END ENGINE INTEGRATION ──
];

const weekdays = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

// ── ENGINE INTEGRATION: Constants ──
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_MAP = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const MODEL_OPTIONS = [
  { value: 'erlangC', label: 'Erlang C (Real-time: Phone, Chat)' },
  { value: 'workload', label: 'Workload (Back-office: Email, Tickets)' },
  { value: 'hours', label: 'Hours' },
];

const HOURS_BASES = {
  GROSS: 'gross',
  IN_CENTER: 'inCenter',
  PRODUCTIVE: 'productive',
};

const ICON_OPTIONS = ['📞', '📧', '💬', '🎧'];

const DEFAULT_KPI = {
  slPct: 80,
  ast: 30,
  maxOcc: 85,
  maxAbandon: 5,
  apt: 120,

  // Percentage of forecast volume expected
  // to be processed by a Workload channel.
  answerRate: 100,
};

const padTime = (t) => {
  if (!t) return '';
  const parts = t.split(':');
  if (parts.length !== 2) return t;
  return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
};

const buildDefaultHOOP = (operationDays) => {
  const hoop = {};
  DAYS_SHORT.forEach((dayShort) => {
    hoop[dayShort] = { open: false, start: '08:00', end: '18:00', fullDay: false };
  });

  if (operationDays && Array.isArray(operationDays)) {
    operationDays.forEach((opDay) => {
      const short = DAY_MAP[opDay.weekDay];
      if (short && opDay.status === 'Open') {
        hoop[short] = {
          open: true,
          start: opDay.fullDay ? '00:00' : padTime(opDay.start) || '08:00',
          end: opDay.fullDay ? '24:00' : padTime(opDay.end) || '18:00',
          fullDay: opDay.fullDay || false,
        };
      }
    });
  }

  return hoop;
};

const DEFAULT_CHANNEL = (operationDays) => ({
  name: '',
  icon: '📞',
  model: 'erlangC',
  hoursBasis: HOURS_BASES.GROSS,
  baseAHT: 300,
  concurrency: 1,
  subServices: 1,
  networkPct: 100,
  minRequired: 1,
  maxShiftHours: 8,
  kpi: { ...DEFAULT_KPI },
  hoop: buildDefaultHOOP(operationDays),
});
// ── END ENGINE INTEGRATION ──

const editGetDate = (form) => {
  const firstDate = form.get('firstWeek').toUpperCase().split('W');
  return firstDate[1] < 10 && firstDate[1].length == 1
    ? moment(`${firstDate[0]}W0${firstDate[1]}`).toDate()
    : moment(form.get('firstWeek').toUpperCase()).toDate();
};

const generateOperationDays = () => {
  return [
    { weekDay: 'Monday', status: 'Closed', start: '', end: '', fullDay: false },
    { weekDay: 'Tuesday', status: 'Closed', start: '', end: '', fullDay: false },
    { weekDay: 'Wednesday', status: 'Closed', start: '', end: '', fullDay: false },
    { weekDay: 'Thursday', status: 'Closed', start: '', end: '', fullDay: false },
    { weekDay: 'Friday', status: 'Closed', start: '', end: '', fullDay: false },
    { weekDay: 'Saturday', status: 'Closed', start: '', end: '', fullDay: false },
    { weekDay: 'Sunday', status: 'Closed', start: '', end: '', fullDay: false },
  ];
};

// ============================================
// CHANNEL CONFIGURATOR (INLINE)
// Embedded version for the Management form
// ============================================
const ChannelConfiguratorInline = ({ form }) => {
  const [expandedChannel, setExpandedChannel] = useState(null);

  const channels = form.get('engineChannels') || {};
  const operationDays = form.get('operationDays');

  const generateKey = (name) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || `channel_${Date.now()}`;

  const addChannel = () => {
    const key = `channel_${Date.now()}`;
    const newChannels = {
      ...channels,
      [key]: { ...DEFAULT_CHANNEL(operationDays) },
    };
    form.set('engineChannels', newChannels);
    setExpandedChannel(key);
  };

  const removeChannel = (key) => {
    const next = { ...channels };
    delete next[key];
    form.set('engineChannels', next);
    if (expandedChannel === key) setExpandedChannel(null);
  };

  const updateChannel = (key, field, value) => {
    const updated = {
      ...channels,
      [key]: { ...channels[key], [field]: value },
    };
    form.set('engineChannels', updated);
  };

  const updateKPI = (key, field, value) => {
    const updated = {
      ...channels,
      [key]: {
        ...channels[key],
        kpi: { ...channels[key].kpi, [field]: parseFloat(value) || 0 },
      },
    };
    form.set('engineChannels', updated);
  };

  const updateHOOP = (channelKey, day, field, value) => {
    const updated = {
      ...channels,
      [channelKey]: {
        ...channels[channelKey],
        hoop: {
          ...channels[channelKey].hoop,
          [day]: { ...channels[channelKey].hoop[day], [field]: value },
        },
      },
    };
    form.set('engineChannels', updated);
  };

  const syncHOOPFromOperationDays = (channelKey) => {
    const hoop = buildDefaultHOOP(operationDays);
    updateChannel(channelKey, 'hoop', hoop);
  };

  return (
    <div>
      {/* Channel List */}
      {Object.entries(channels).map(([key, channel]) => (
        <div
          key={key}
          className="box mb-3"
          style={{ padding: '0.75rem', background: '#fafaff' }}
        >
          {/* Channel Header */}
          <div
            className="is-flex is-align-items-center is-clickable"
            onClick={() =>
              setExpandedChannel(expandedChannel === key ? null : key)
            }
            style={{ cursor: 'pointer' }}
          >
            <span className="mr-2" style={{ fontSize: '1.1rem' }}>
              {channel.icon}
            </span>
            <strong className="mr-2 is-size-7">
              {channel.name || '(Unnamed Channel)'}
            </strong>
            <span className="tag is-light is-small mr-2">{channel.model}</span>
            <span className="tag is-info is-light is-small mr-2">
              {channel.model === 'hours'
                ? `${
                    channel.hoursBasis === HOURS_BASES.IN_CENTER
                      ? 'In-center'
                      : channel.hoursBasis === HOURS_BASES.PRODUCTIVE
                        ? 'Productive'
                        : 'Gross'
                  } hours`
                : `AHT: ${channel.baseAHT}s`}
            </span>
            <span className="ml-auto mr-2">
              {expandedChannel === key ? (
                <FaChevronUp size={10} />
              ) : (
                <FaChevronDown size={10} />
              )}
            </span>
            <button
              className="button is-small is-danger is-light"
              onClick={(e) => {
                e.stopPropagation();
                removeChannel(key);
              }}
            >
              <FaTrash size={10} />
            </button>
          </div>

          {/* Expanded Config */}
          {expandedChannel === key && (
            <div className="mt-3">
              {/* Basic Settings */}
              <div className="columns is-multiline">
                <div className="column is-3">
                  <label className="label is-small">Channel Name</label>
                  <input
                    className="input is-small"
                    type="text"
                    value={channel.name}
                    onChange={(e) => updateChannel(key, 'name', e.target.value)}
                    placeholder="e.g., Phone Main"
                  />
                </div>
                <div className="column is-2">
                  <label className="label is-small">Icon</label>
                  <div className="select is-small is-fullwidth">
                    <select
                      value={channel.icon}
                      onChange={(e) =>
                        updateChannel(key, 'icon', e.target.value)
                      }
                    >
                      {ICON_OPTIONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="column is-3">
                  <label className="label is-small">Model</label>
                  <div className="select is-small is-fullwidth">
                    <select
                      value={channel.model}
                      onChange={(e) =>
                        updateChannel(key, 'model', e.target.value)
                      }
                    >
                      {MODEL_OPTIONS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {channel.model === 'hours' ? (
                  <div className="column is-2">
                    <label className="label is-small">
                      Forecast hours represent
                    </label>

                    <div className="select is-small is-fullwidth">
                      <select
                        value={
                          channel.hoursBasis ||
                          HOURS_BASES.GROSS
                        }
                        onChange={(e) =>
                          updateChannel(
                            key,
                            'hoursBasis',
                            e.target.value
                          )
                        }
                      >
                        <option value={HOURS_BASES.GROSS}>
                          Gross hours
                        </option>
                        <option value={HOURS_BASES.IN_CENTER}>
                          In-center hours
                        </option>
                        <option value={HOURS_BASES.PRODUCTIVE}>
                          Productive hours
                        </option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div className="column is-2">
                    <label className="label is-small">
                      Base AHT (sec)
                    </label>

                    <input
                      className="input is-small"
                      type="number"
                      value={channel.baseAHT}
                      onChange={(e) =>
                        updateChannel(
                          key,
                          'baseAHT',
                          e.target.value
                        )
                      }
                    />
                  </div>
                )}
                {channel.model === 'erlangC' && (
                  <div className="column is-2">
                    <label className="label is-small">
                      Concurrency
                    </label>

                    <input
                      className="input is-small"
                      type="number"
                      min="1"
                      max="5"
                      value={channel.concurrency ?? 1}
                      onChange={(e) =>
                        updateChannel(
                          key,
                          'concurrency',
                          e.target.value
                        )
                      }
                    />
                  </div>
                )}
              </div>

              <div className="columns is-multiline">
                {channel.model === 'erlangC' && (
                  <>
                    <div className="column is-2">
                      <label className="label is-small">
                        Network %
                      </label>

                      <input
                        className="input is-small"
                        type="number"
                        min="1"
                        max="100"
                        step="0.1"
                        value={channel.networkPct ?? 100}
                        onChange={(e) =>
                          updateChannel(
                            key,
                            'networkPct',
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="column is-2">
                      <label className="label is-small">
                        Min Required
                      </label>

                      <input
                        className="input is-small"
                        type="number"
                        min="0"
                        step="0.1"
                        value={channel.minRequired ?? 1}
                        onChange={(e) =>
                          updateChannel(
                            key,
                            'minRequired',
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <div className="column is-2">
                      <label className="label is-small">
                        Sub-Services
                      </label>

                      <input
                        className="input is-small"
                        type="number"
                        min="1"
                        step="1"
                        value={channel.subServices ?? 1}
                        onChange={(e) =>
                          updateChannel(
                            key,
                            'subServices',
                            e.target.value
                          )
                        }
                      />
                    </div>
                  </>
                )}

                  <div className="column is-2">
                    <label
                      className="label is-small"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      Shift Hours / Day
                    </label>

                    <input
                      className="input is-small"
                      type="number"
                      min="0.1"
                      max="24"
                      step="0.1"
                      value={channel.maxShiftHours ?? 8}
                      onChange={(e) =>
                        updateChannel(
                          key,
                          'maxShiftHours',
                          e.target.value
                        )
                      }
                    />

                    <p
                      className="help"
                      style={{ fontSize: '0.6rem' }}
                    >
                      For daily FTE calc
                    </p>
                  </div>
              </div>

              {/* KPI — Erlang C */}
              {channel.model === 'erlangC' && (
                <div>
                  <label className="label is-small has-text-info">
                    KPI Targets
                  </label>
                  <div className="columns is-multiline">
                    <div className="column is-2">
                      <label className="label is-small">SL Target %</label>
                      <input
                        className="input is-small"
                        type="number"
                        value={channel.kpi.slPct}
                        onChange={(e) => updateKPI(key, 'slPct', e.target.value)}
                      />
                    </div>
                    <div className="column is-2">
                      <label className="label is-small">AST (sec)</label>
                      <input
                        className="input is-small"
                        type="number"
                        value={channel.kpi.ast}
                        onChange={(e) => updateKPI(key, 'ast', e.target.value)}
                      />
                    </div>
                    <div className="column is-2">
                      <label className="label is-small">Max Occ %</label>
                      <input
                        className="input is-small"
                        type="number"
                        value={channel.kpi.maxOcc}
                        onChange={(e) =>
                          updateKPI(key, 'maxOcc', e.target.value)
                        }
                      />
                    </div>
                    <div className="column is-2">
                      <label className="label is-small">Max Abandon %</label>
                      <input
                        className="input is-small"
                        type="number"
                        value={channel.kpi.maxAbandon}
                        onChange={(e) =>
                          updateKPI(key, 'maxAbandon', e.target.value)
                        }
                      />
                    </div>
                    <div className="column is-2">
                      <label className="label is-small">
                        Avg Patience (sec)
                      </label>
                      <input
                        className="input is-small"
                        type="number"
                        value={channel.kpi.apt}
                        onChange={(e) => updateKPI(key, 'apt', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* KPI — Workload */}
                {channel.model === 'workload' && (
                  <div>
                    <label className="label is-small has-text-info">
                      KPI Targets
                    </label>

                    <div className="columns is-multiline">
                      <div className="column is-2">
                        <label className="label is-small">
                          Max Occupancy %
                        </label>

                        <input
                          className="input is-small"
                          type="number"
                          min="0.1"
                          max="100"
                          step="0.1"
                          value={channel.kpi?.maxOcc ?? 85}
                          onChange={(e) =>
                            updateKPI(
                              key,
                              'maxOcc',
                              e.target.value
                            )
                          }
                        />

                        <p
                          className="help"
                          style={{ fontSize: '0.6rem' }}
                        >
                          Maximum productive utilization
                        </p>
                      </div>

                      <div className="column is-2">
                        <label className="label is-small">
                          Answer Rate %
                        </label>

                        <input
                          className="input is-small"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={
                            channel.kpi?.answerRate ?? 100
                          }
                          onChange={(e) =>
                            updateKPI(
                              key,
                              'answerRate',
                              e.target.value
                            )
                          }
                        />

                        <p
                          className="help"
                          style={{ fontSize: '0.6rem' }}
                        >
                          Percentage of forecast volume to process
                        </p>
                      </div>
                    </div>
                  </div>
                )}

              {/* HOOP — Compact Table */}
              <div className="is-flex is-align-items-center mb-2 mt-2">
                <label className="label is-small has-text-info mb-0 mr-3">
                  Channel Hours of Operation
                </label>
                <button
                  className="button is-small is-light is-rounded"
                  onClick={() => syncHOOPFromOperationDays(key)}
                  title="Copy from capPlan's Days of Operation above"
                >
                  Sync from CapPlan HOOP
                </button>
              </div>
              <table className="table is-narrow is-bordered is-size-7 mb-2" style={{ width: 'auto' }}>
                <thead>
                  <tr>
                    {DAYS_SHORT.map((day) => (
                      <th key={day} className="has-text-centered" style={{ padding: '4px 8px', minWidth: '80px' }}>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={channel.hoop?.[day]?.open || false}
                            onChange={(e) =>
                              updateHOOP(key, day, 'open', e.target.checked)
                            }
                          />{' '}
                          {day}
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Full Day toggle */}
                  <tr>
                    {DAYS_SHORT.map((day) => (
                      <td
                        key={day + '-fd'}
                        className="has-text-centered"
                        style={{
                          padding: '2px 4px',
                          opacity: channel.hoop?.[day]?.open ? 1 : 0.3,
                        }}
                      >
                        {channel.hoop?.[day]?.open ? (
                          <label className="checkbox is-size-7">
                            <input
                              type="checkbox"
                              checked={channel.hoop[day]?.fullDay || false}
                              onChange={(e) =>
                                updateHOOP(key, day, 'fullDay', e.target.checked)
                              }
                            />{' '}
                            24h
                          </label>
                        ) : (
                          <span className="has-text-grey-light">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Times */}
                  <tr>
                    {DAYS_SHORT.map((day) => (
                      <td
                        key={day + '-t'}
                        className="has-text-centered"
                        style={{
                          padding: '4px 6px',
                          opacity: channel.hoop?.[day]?.open ? 1 : 0.3,
                        }}
                      >
                        {channel.hoop?.[day]?.open ? (
                          channel.hoop[day]?.fullDay ? (
                            <span className="has-text-success is-size-7" style={{ fontWeight: 600 }}>
                              00:00–23:59
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <input
                                className="input is-small"
                                type="time"
                                value={channel.hoop[day]?.start || '08:00'}
                                onChange={(e) =>
                                  updateHOOP(key, day, 'start', e.target.value)
                                }
                                style={{ fontSize: '0.7rem', padding: '2px 4px', height: '24px' }}
                              />
                              <input
                                className="input is-small"
                                type="time"
                                value={channel.hoop[day]?.end || '18:00'}
                                onChange={(e) =>
                                  updateHOOP(key, day, 'end', e.target.value)
                                }
                                style={{ fontSize: '0.7rem', padding: '2px 4px', height: '24px' }}
                              />
                            </div>
                          )
                        ) : (
                          <span className="has-text-grey-light">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}

      {/* Add Channel Button */}
      <button
        className="button is-small is-info is-light is-rounded"
        onClick={addChannel}
      >
        <span className="icon is-small">
          <FaPlus size={10} />
        </span>
        <span>Add Channel</span>
      </button>

      <span className="ml-3 is-size-7 has-text-grey">
        {Object.keys(channels).length} channel(s) configured
      </span>
    </div>
  );
};

// ============================================
// ENGINE SECTION COMPONENT
// Renders the Enable toggle + interval + channels
// ============================================
const EngineSection = ({ form }) => {
  const engineEnabled = form.get('engineEnabled') || false;

  return (
    <div className="mt-4">
      <hr />
      <div className="columns is-vcentered">
        <div className="column is-narrow">
          <label className="label">
            <input
              type="checkbox"
              className="mr-2"
              checked={engineEnabled}
              onChange={() => form.set('engineEnabled', !engineEnabled)}
            />
            Enable Capacity Engine
          </label>
        </div>
        {engineEnabled && (
          <div className="column is-2">
            <label className="label is-small">Interval (minutes)</label>
            <div className="select is-small is-fullwidth">
              <select
                value={form.get('engineInterval') || 30}
                onChange={(e) =>
                  form.set('engineInterval', parseInt(e.target.value))
                }
              >
                <option value={15}>15 min</option>
                <option value={30}>30 min</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {engineEnabled && (
        <div className="mt-2">
          <label className="label is-small has-text-info">
            Channel Configuration
          </label>
          <p className="is-size-7 has-text-grey mb-3">
            Configure the channels for this capacity plan. Each channel can use
            Erlang C (real-time), Workload (back-office), or Hours model. Hours of
            operation can be synced from the capPlan's Days of Operation or set
            independently per channel.
          </p>
          <ChannelConfiguratorInline form={form} />
        </div>
      )}

      {!engineEnabled && (
        <p className="is-size-7 has-text-grey">
          Enable the capacity engine to configure channels and use automated
          FTE calculations on the Capacity Planner page.
        </p>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================
const CapPlanManagement = ({ data }) => {
  const [tab, setTab] = useState(1);
  const [currentValue, setCurrentValue] = useState('');
  const [startDate, setStartDate] = useState('');

  const auth = useAuth();
  const isLevel4 = auth.user?.permission === 4;

  const selection = useForm({
    fields: selectionFields,
  });

  const form = useForm({
    fields: formFields,
  });

  useEffect(() => {
    if (selection.get('capPlan')) {
      const capPlan = selection.get('capPlan');
      selection.set(
        'language',
        data &&
          selection.get('capPlan') &&
          data.languages.find(
            (lang) => lang._id === selection.get('capPlan').language
          )
      );
      selection.set(
        'country',
        data &&
          selection.get('capPlan') &&
          data.countries.find(
            (country) => country.name === selection.get('capPlan').country
          )
      );

      form.setMany({
        name: capPlan.name,
        firstWeek: capPlan.firstWeek,
        startingHC: capPlan.startingHC,
        active: capPlan.active,
        country: capPlan.country,
        fteHoursWeekly: capPlan.fteHoursWeekly,
        operationDays: capPlan.operationDays || generateOperationDays(),
        pricingModel: capPlan.pricingModel || '',
        hourlycost: capPlan.hourlycost,
        hourlyrate: capPlan.hourlyrate,
        // ── ENGINE INTEGRATION ──
        engineEnabled: capPlan.engineEnabled || false,
        engineInterval: capPlan.engineInterval || 30,
        engineChannels: capPlan.engineChannels || {},
        // ── END ENGINE INTEGRATION ──
      });
    }
  }, [selection.get('capPlan')]);

  //HANDLERS
  const handleSubmit = async (action) => {
    // ── ENGINE INTEGRATION: Clean channel keys before saving ──
    let engineChannels = form.get('engineChannels') || {};
    const cleanChannels = {};
      if (form.get('engineEnabled')) {
        const usedChannelNames = new Set();

        for (const [key, channel] of Object.entries(
          engineChannels
        )) {
          const channelName = String(
            channel?.name || ''
          ).trim();

          if (!channelName) {
            window.alert(
              `Channel "${key}" requires a name.`
            );

            return;
          }

          const normalizedName =
            channelName.toLowerCase();

          if (
            usedChannelNames.has(
              normalizedName
            )
          ) {
            window.alert(
              `Channel name "${channelName}" is duplicated. Channel names must be unique within a capacity plan.`
            );

            return;
          }

          usedChannelNames.add(
            normalizedName
          );
        }
      }

      Object.entries(engineChannels).forEach(([key, ch]) => {
        // The channel key is its permanent identity.
        // Changing the display name must not change this key.
        const newKey = key;

      const normalizedModel = String(ch.model || "")
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, "");

      const defaultMaxOcc =
        normalizedModel === "erlangc"
          ? 100
          : 85;

      const rawMaxOccValue =
        ch.kpi?.maxOcc;

      const parsedMaxOcc =
        rawMaxOccValue === "" ||
        rawMaxOccValue === null ||
        rawMaxOccValue === undefined
          ? defaultMaxOcc
          : Number(rawMaxOccValue);

      if (
        !Number.isFinite(parsedMaxOcc) ||
        parsedMaxOcc <= 0 ||
        parsedMaxOcc > 100
      ) {
        window.alert(
          `Max Occupancy for "${
            ch.name || "Unknown channel"
          }" must be greater than 0 and no more than 100.`
        );

        throw new Error(
          `Invalid maxOcc for channel "${
            ch.name || "Unknown"
          }": ${String(rawMaxOccValue)}`
        );
      }

      const maxOcc = parsedMaxOcc;

      const rawAnswerRateValue =
        ch.kpi?.answerRate;

      const parsedAnswerRate =
        rawAnswerRateValue === "" ||
        rawAnswerRateValue === null ||
        rawAnswerRateValue === undefined
          ? 100
          : Number(rawAnswerRateValue);

      if (
        !Number.isFinite(parsedAnswerRate) ||
        parsedAnswerRate < 0 ||
        parsedAnswerRate > 100
      ) {
        window.alert(
          `Answer Rate for "${
            ch.name || "Unknown channel"
          }" must be between 0 and 100.`
        );

        throw new Error(
          `Invalid answerRate for channel "${
            ch.name || "Unknown"
          }": ${String(rawAnswerRateValue)}`
        );
      }

      const answerRate =
        parsedAnswerRate;

      cleanChannels[newKey] = {
        ...ch,
        name: String(
          ch.name || ''
        ).trim(),

        baseAHT:
          parseFloat(ch.baseAHT) || 300,

        concurrency:
          parseInt(ch.concurrency, 10) || 1,

        subServices:
          parseInt(ch.subServices, 10) || 1,

        networkPct:
          parseFloat(ch.networkPct) || 100,

        minRequired:
          Math.max(
            0,
            Number(ch.minRequired) || 0
          ),

        maxShiftHours:
          parseFloat(ch.maxShiftHours) || 8,

        kpi: {
          ...DEFAULT_KPI,
          ...(ch.kpi || {}),
          maxOcc,
          answerRate,
        },
      };
    });
    // ── END ENGINE INTEGRATION ──

    let payload = {
      ...form.getForm(),
      // ── ENGINE INTEGRATION: Override with cleaned channels ──
      engineChannels: form.get('engineEnabled') ? cleanChannels : {},
      // ── END ENGINE INTEGRATION ──
    };

    switch (action) {
      case 'ADD':
        await fetch(`/api/data/management/capPlan`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: auth.authorization(),
          },
          body: JSON.stringify({
            payload,
            lob: selection.get('lob'),
            language: selection.get('language'),
            country: selection.get('country'),
          }),
        })
          .then((response) => response.json())
          .then((data) => {
            alert(data.message);
            form.resetAll();
            form.set('operationDays', generateOperationDays());
            selection.resetAll();
          })
          .catch((err) => console.log(err));
        break;

      case 'EDIT':
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
            body: JSON.stringify({
              payload,
              language: selection.get('language'),
              country: selection.get('country'),
            }),
          }
        )
          .then((response) => response.json())
          .then((data) => {
            alert(data.message);
            form.resetAll();
            form.set('operationDays', generateOperationDays());
            selection.resetAll();
          })
          .catch((err) => console.log(err));
        break;

      case 'REMOVE':
        if (
          data?.capEntries &&
          selection.get('capPlan') &&
          data.capEntries.find(
            (entry) => entry.capPlan === selection.get('capPlan')._id
          )
        ) {
          alert(
            'There are still entries for this capPlan, please clean up entries before removing the capPlan'
          );
        } else {
          await fetch(
            `/api/data/management/capPlan?id=${
              selection.get('capPlan') && selection.get('capPlan')._id
            }`,
            {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
                Authorization: auth.authorization(),
              },
            }
          )
            .then((response) => response.json())
            .then((data) => {
              alert(data.message);
              form.resetAll();
              form.set('operationDays', generateOperationDays());
            })
            .catch((err) => console.log(err));
        }
        break;

      case 'CLEANUP':
        await fetch(
          `/api/data/entries/cleanup?capPlan=${
            selection.get('capPlan') && selection.get('capPlan')._id
          }`,
          {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
              Authorization: auth.authorization(),
            },
          }
        )
          .then((response) => response.json())
          .then((data) => {
            alert(data.message);
            console.log('deleted: ' + data.response.deletedCount);
            form.resetAll();
            form.set('operationDays', generateOperationDays());
          })
          .catch((err) => console.log(err));
        break;
    }
    selection.resetOne('capPlan');
    data.refresh();
  };

  function checkValue(e) {
    setCurrentValue(handleDecimalsOnValue(e.target.value));
    form.set('fteHoursWeekly', handleDecimalsOnValue(e.target.value));
  }

  function handleDecimalsOnValue(value) {
    try {
      const regex = /([0-9]*\.{0,1}[0-9]{0,2})/s;
      const match = value.match(regex);
      return match ? match[0] : '';
    } catch (error) {
      console.error('Error formatting decimal value:', error);
      return '';
    }
  }

  let allOperationDaysClosed = form.get('operationDays')
    ? form.get('operationDays').some((e) => e['status'] === 'Open')
    : '';

  const handleOperationDaysChange = (value, key, form, dayIndex) => {
    try {
      let operationDays = [...form.get('operationDays')];
      let changedDay = { ...operationDays[dayIndex] };

      switch (key) {
        case 'status':
          changedDay.status = changedDay.status === 'Open' ? 'Closed' : 'Open';
          if (changedDay.status === 'Closed') {
            changedDay.fullDay = false;
          }
          break;
        case 'start':
          changedDay.start = value;
          break;
        case 'end':
          changedDay.end = value;
          break;
        case 'fullDay':
          changedDay.fullDay = !changedDay.fullDay;
          if (changedDay.fullDay) {
            changedDay.start = '00:00';
            changedDay.end = '23:59';
          }
          break;
        default:
          break;
      }

      operationDays[dayIndex] = changedDay;
      form.set('operationDays', operationDays);
    } catch (error) {
      console.error('Error updating operation days:', error);
    }
  };

  return (
    <>
      <div className="tabs">
        <ul>
          <li className={tab === 1 ? 'is-active' : ''} key={1}>
            <a
              onClick={() => {
                setTab(1);
                form.resetAll();
                form.set('operationDays', generateOperationDays());
                selection.resetAll();
              }}
            >
              Add
            </a>
          </li>
          <li className={tab === 2 ? 'is-active' : ''} key={2}>
            <a
              onClick={() => {
                setTab(2);
                form.resetAll();
                form.set('operationDays', generateOperationDays());
                selection.resetAll();
              }}
            >
              Edit
            </a>
          </li>
          {auth.allowedAdmin && (
            <li className={tab === 3 ? 'is-active' : ''} key={3}>
              <a
                onClick={() => {
                  setTab(3);
                  form.resetAll();
                  form.set('operationDays', generateOperationDays());
                  selection.resetAll();
                }}
              >
                Remove
              </a>
            </li>
          )}
        </ul>
      </div>

      {/*TABS*/}
      {tab === 1 ? (
        /** ADD */
        data && data.projects ? (
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
                  reset={['lob', 'capPlan']}
                  callback={(f) => {
                    f.resetAll();
                    f.set('operationDays', generateOperationDays());
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
                  reset={['capPlan']}
                  disabled={!selection.get('project')}
                  callback={(f) => {
                    f.resetAll();
                    f.set('operationDays', generateOperationDays());
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
                  disabled={!selection.get('project')}
                  callback={(f) => {
                    f.resetAll();
                    f.set('operationDays', generateOperationDays());
                  }}
                />
              </div>
            </div>
            <div id="add-form">
              <div className="columns is-multiline">
                <div className="column is-4">
                  <label className="label">Plan Name</label>
                  <div className="control is-small">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set('name', e.target.value)}
                      value={form.get('name') || ''}
                      type="text"
                      placeholder="Plan Name"
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">First Week</label>
                  <div className="control">
                    <DatePicker
                      selected={startDate}
                      locale="en-GB"
                      dateFormat={"YYYY'w'ww"}
                      onChange={(date) => {
                        let year = moment(date).format('YYYY');
                        let week = moment(date).isoWeek();
                        let weekCode = year + 'w' + week;
                        setStartDate(date);
                        form.set('firstWeek', weekCode);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">Starting HC</label>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set('startingHC', e.target.value)}
                      value={form.get('startingHC') || ''}
                      type="number"
                      placeholder="Starting HC"
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">Country</label>
                  <div className="control is-small">
                    <StructureDropdown
                      structureName="country"
                      selection={selection}
                      form={form}
                      data={data && data.countries}
                      disabled={false}
                      callback={(f, s) => {
                        f.set('country', s.name);
                      }}
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
                      onChange={(e) => checkValue(e, 'change')}
                      value={currentValue}
                      type="number"
                      placeholder="FTE Hours Weekly"
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">Pricing Model</label>
                  <div className="control">
                    <FormDropdown
                      fieldName="pricing Model"
                      form={form}
                      data={
                        data && data.pms && data.pms.map((pms) => pms.name)
                      }
                      disabled={false}
                      style={'maxWidth: "74px"'}
                    />
                  </div>
                </div>
                {isLevel4 && (
                  <>
                    <div className="column is-3">
                      <label className="label">Hourly Cost</label>
                      <div className="control is-small">
                        <input
                          className="input is-small"
                          onChange={(e) =>
                            form.set('hourlycost', e.target.value)
                          }
                          value={form.get('hourlycost') || ''}
                          type="number"
                          placeholder="Hourly Cost"
                        />
                      </div>
                    </div>
                    <div className="column is-3">
                      <label className="label">Hourly Rate</label>
                      <div className="control is-small">
                        <input
                          className="input is-small"
                          onChange={(e) =>
                            form.set('hourlyrate', e.target.value)
                          }
                          value={form.get('hourlyrate') || ''}
                          type="number"
                          placeholder="Hourly Rate"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
              {/* Days & Hours of Operation — Compact Table */}
              <div className="is-flex is-align-items-center mb-2">
                <label className="label mb-0 mr-4">Days & Hours of Operation</label>
                <label className="checkbox is-size-7">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={form.get('active') || false}
                    onChange={() => {
                      form.set('active', !form.get('active'));
                    }}
                  />
                  Active
                </label>
              </div>
              <table className="table is-narrow is-bordered is-size-7 mb-3" style={{ width: 'auto' }}>
                <thead>
                  <tr>
                    {weekdays.map((w, i) => (
                      <th key={w} className="has-text-centered" style={{ padding: '4px 6px', minWidth: '90px' }}>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={
                              form.get('operationDays')
                                ? form.get('operationDays')[i].status === 'Open'
                                : false
                            }
                            onChange={() => {
                              handleOperationDaysChange(true, 'status', form, i);
                            }}
                          />{' '}
                          {w.slice(0, 3)}
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Full Day toggle row */}
                  <tr>
                    {weekdays.map((w, i) => (
                      <td
                        key={w + '-fullday'}
                        className="has-text-centered"
                        style={{
                          padding: '2px 4px',
                          opacity:
                            form.get('operationDays') &&
                            form.get('operationDays')[i].status === 'Open'
                              ? 1
                              : 0.3,
                        }}
                      >
                        {form.get('operationDays') &&
                        form.get('operationDays')[i].status === 'Open' ? (
                          <label className="checkbox is-size-7">
                            <input
                              type="checkbox"
                              checked={form.get('operationDays')[i].fullDay || false}
                              onChange={() => {
                                handleOperationDaysChange(true, 'fullDay', form, i);
                              }}
                            />{' '}
                            24h
                          </label>
                        ) : (
                          <span className="has-text-grey-light">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Start/End time row */}
                  <tr>
                    {weekdays.map((w, i) => (
                      <td
                        key={w + '-times'}
                        className="has-text-centered"
                        style={{
                          padding: '4px 4px',
                          opacity:
                            form.get('operationDays') &&
                            form.get('operationDays')[i].status === 'Open'
                              ? 1
                              : 0.3,
                        }}
                      >
                        {form.get('operationDays') &&
                        form.get('operationDays')[i].status === 'Open' ? (
                          form.get('operationDays')[i].fullDay ? (
                            <span className="has-text-success is-size-7" style={{ fontWeight: 600 }}>
                              00:00–23:59
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <FormDropdown
                                className={'workHours'}
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
                                  handleOperationDaysChange(j, 'start', f, i);
                                }}
                                disabled={false}
                                getNestedItem={(opDays) => {
                                  return opDays[i]['start'];
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
                                  handleOperationDaysChange(j, 'end', f, i);
                                }}
                                disabled={false}
                                getNestedItem={(opDays) => {
                                  return opDays[i]['end'];
                                }}
                              />
                            </div>
                          )
                        ) : (
                          <span className="has-text-grey-light">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              {/* ── ENGINE INTEGRATION ── */}
              <EngineSection form={form} />
              {/* ── END ENGINE INTEGRATION ── */}
            </div>

            <div id="add-button">
              <div className="columns mt-3">
                <div className="column is-3">
                  
                  <button
                    className="button is-small is-success is-rounded"
                    onClick={() => handleSubmit('ADD')}
                    disabled={
                      !allOperationDaysClosed ||
                      !form.checkRequired() ||
                      !selection.get('lob') ||
                      !selection.get('language')
                    }
                  >
                    Add Cap Plan
                  </button>
                </div>
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
      ) : tab === 2 ? (
        /** EDIT */
        data && data.projects ? (
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
                  reset={['lob', 'capPlan']}
                  callback={(f) => {
                    f.resetAll();
                    f.set('operationDays', generateOperationDays());
                  }}
                />
                <StructureDropdown
                  structureName="lob"
                  selection={selection}
                  form={form}
                  reset={['capPlan']}
                  data={
                    data &&
                    selection.get('project') &&
                    data.lobs.filter(
                      (lob) => lob.project === selection.get('project')._id
                    )
                  }
                  disabled={!selection.get('project')}
                  callback={(f) => {
                    f.resetAll();
                    f.set('operationDays', generateOperationDays());
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
                  disabled={!selection.get('lob')}
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
                      onChange={(e) => form.set('name', e.target.value)}
                      value={form.get('name') || ''}
                      type="text"
                      placeholder="Plan Name"
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">First Week</label>
                  <div className="control">
                    <DatePicker
                      selected={form.get('firstWeek') ? editGetDate(form) : ''}
                      locale="en-GB"
                      dateFormat={"YYYY'w'ww"}
                      onChange={(date) => {
                        let year = moment(date).format('YYYY');
                        let week = moment(date).isoWeek();
                        let weekCode = year + 'w' + week;
                        setStartDate(date);
                        form.set('firstWeek', weekCode);
                      }}
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">Starting HC</label>
                  <div className="control">
                    <input
                      className="input is-small"
                      onChange={(e) => form.set('startingHC', e.target.value)}
                      value={form.get('startingHC') || ''}
                      type="number"
                      placeholder="Starting HC"
                      required
                    />
                  </div>
                </div>
                <div className="column is-2">
                  <label className="label">Language</label>
                  <StructureDropdown
                    structureName="language"
                    selection={selection}
                    form={selection}
                    data={
                      data && data.languages
                        ? data.languages.sort((a, b) =>
                            a.name > b.name ? 1 : a.name < b.name ? -1 : 0
                          )
                        : ''
                    }
                    disabled={!selection.get('language')}
                  />
                </div>
                <div className="column is-2">
                  <label className="label">Country</label>
                  <div className="control is-small">
                    <StructureDropdown
                      structureName="country"
                      selection={selection}
                      form={form}
                      data={data && data.countries}
                      disabled={false}
                      callback={(f, s) => {
                        f.set('country', s.name);
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="columns is-multiline">
                <div className="column is-2">
                  <label className="label">FTE Hours Weekly</label>
                  <div className="control is-small">
                    <input
                      className="input is-small"
                      onChange={(e) => checkValue(e, 'change')}
                      value={form.get('fteHoursWeekly') || ''}
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
                {isLevel4 && (
                  <>
                    <div className="column is-3">
                      <label className="label">Hourly Cost</label>
                      <div className="control is-small">
                        <input
                          className="input is-small"
                          onChange={(e) =>
                            form.set('hourlycost', e.target.value)
                          }
                          value={form.get('hourlycost') || ''}
                          type="number"
                          placeholder="Hourly Cost"
                        />
                      </div>
                    </div>
                    <div className="column is-3">
                      <label className="label">Hourly Rate</label>
                      <div className="control is-small">
                        <input
                          className="input is-small"
                          onChange={(e) =>
                            form.set('hourlyrate', e.target.value)
                          }
                          value={form.get('hourlyrate') || ''}
                          type="number"
                          placeholder="Hourly Rate"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
             {/* Days & Hours of Operation — Compact Table */}
              <div className="is-flex is-align-items-center mb-2">
                <label className="label mb-0 mr-4">Days & Hours of Operation</label>
                <label className="checkbox is-size-7">
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={form.get('active') || false}
                    onChange={() => {
                      form.set('active', !form.get('active'));
                    }}
                  />
                  Active
                </label>
              </div>
              <table className="table is-narrow is-bordered is-size-7 mb-3" style={{ width: 'auto' }}>
                <thead>
                  <tr>
                    {weekdays.map((w, i) => (
                      <th key={w} className="has-text-centered" style={{ padding: '4px 6px', minWidth: '90px' }}>
                        <label className="checkbox">
                          <input
                            type="checkbox"
                            checked={
                              form.get('operationDays')
                                ? form.get('operationDays')[i].status === 'Open'
                                : false
                            }
                            onChange={() => {
                              handleOperationDaysChange(true, 'status', form, i);
                            }}
                          />{' '}
                          {w.slice(0, 3)}
                        </label>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* Full Day toggle row */}
                  <tr>
                    {weekdays.map((w, i) => (
                      <td
                        key={w + '-fullday'}
                        className="has-text-centered"
                        style={{
                          padding: '2px 4px',
                          opacity:
                            form.get('operationDays') &&
                            form.get('operationDays')[i].status === 'Open'
                              ? 1
                              : 0.3,
                        }}
                      >
                        {form.get('operationDays') &&
                        form.get('operationDays')[i].status === 'Open' ? (
                          <label className="checkbox is-size-7">
                            <input
                              type="checkbox"
                              checked={form.get('operationDays')[i].fullDay || false}
                              onChange={() => {
                                handleOperationDaysChange(true, 'fullDay', form, i);
                              }}
                            />{' '}
                            24h
                          </label>
                        ) : (
                          <span className="has-text-grey-light">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                  {/* Start/End time row */}
                  <tr>
                    {weekdays.map((w, i) => (
                      <td
                        key={w + '-times'}
                        className="has-text-centered"
                        style={{
                          padding: '4px 4px',
                          opacity:
                            form.get('operationDays') &&
                            form.get('operationDays')[i].status === 'Open'
                              ? 1
                              : 0.3,
                        }}
                      >
                        {form.get('operationDays') &&
                        form.get('operationDays')[i].status === 'Open' ? (
                          form.get('operationDays')[i].fullDay ? (
                            <span className="has-text-success is-size-7" style={{ fontWeight: 600 }}>
                              00:00–23:59
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <FormDropdown
                                className={'workHours'}
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
                                  handleOperationDaysChange(j, 'start', f, i);
                                }}
                                disabled={false}
                                getNestedItem={(opDays) => {
                                  return opDays[i]['start'];
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
                                  handleOperationDaysChange(j, 'end', f, i);
                                }}
                                disabled={false}
                                getNestedItem={(opDays) => {
                                  return opDays[i]['end'];
                                }}
                              />
                            </div>
                          )
                        ) : (
                          <span className="has-text-grey-light">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              {/* ── ENGINE INTEGRATION ── */}
              <EngineSection form={form} />
              {/* ── END ENGINE INTEGRATION ── */}
            </div>
            <div className="columns mt-3">
              <div className="column is-3">
                <div id="edit-button">
                  <button
                    className="button is-small is-warning is-rounded"
                    onClick={() => handleSubmit('EDIT')}
                    disabled={
                      !form.checkRequired() ||
                      !selection.get('capPlan') ||
                      !selection.get('language') ||
                      !selection.get('country')
                    }
                  >
                    Edit Cap Plan
                  </button>
                </div>
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
      ) : tab === 3 && auth.allowedAdmin ? (
        data && data.projects ? (
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
                  reset={['lob']}
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
                  disabled={!selection.get('lob')}
                  callback={(f, s) => {
                    f.setMany({
                      name: s.name,
                      firstWeek: s.firstWeek,
                      startingHC: s.startingHC,
                      active: s.active,
                      pricingModel: s.pricingModel,
                    });
                  }}
                />
              </div>
            </div>
            <div>
              <button
                className="button is-small is-danger is-rounded"
                onClick={() => handleSubmit('REMOVE')}
                disabled={!selection.get('capPlan')}
              >
                Remove Cap Plan
              </button>
              <button
                className="button is-small is-danger is-light is-rounded"
                onClick={() => handleSubmit('CLEANUP')}
                disabled={!selection.get('capPlan')}
              >
                Cleanup Entries
              </button>
            </div>
          </div>
        ) : (
          <div className="loaderContainer">
            <span className="loaderGigi"></span>
          </div>
        )
      ) : (
        <div className="message is-danger is-size-5 px-5 py-5">
          <span>
            <FaLock />
          </span>{' '}
          UNAUTHORIZED ACCESS
        </div>
      )}
    </>
  );
};

export default CapPlanManagement;