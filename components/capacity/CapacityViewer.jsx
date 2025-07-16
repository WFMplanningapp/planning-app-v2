import React, { useState } from 'react';

const CapacityViewer = ({ capacity, fields, currentWeek, withStaff }) => {
  const [expandedTypes, setExpandedTypes] = useState({
    capacity: true,
    staffing: true,
    Attrition: true,
    training: true,
  });

  const groupFieldsByType = (fields) => {
    return fields.reduce((acc, field) => {
      if (!acc[field.type]) {
        acc[field.type] = [];
      }
      acc[field.type].push(field);
      return acc;
    }, {});
  };

  const groupedFields = groupFieldsByType(
    fields.filter((field) => (withStaff ? true : field.order < 1000))
  );

  const toggleTypeExpansion = (fieldType) => {
    setExpandedTypes((prev) => ({
      ...prev,
      [fieldType]: !prev[fieldType],
    }));
  };

  return (
    <div className="columns is-gapless is-size-7 is-mobile">
      <div className="column is-narrow table-container has-text-right">
        <table className="table">
          <thead>
            <tr>
              <th className="is-dark">CAPACITY VIEW</th>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <th className="is-dark">CAPACITY VIEW</th>
            </tr>
          </tfoot>
          <tbody>
            {Object.entries(groupedFields).map(([type, typeFields]) => (
              <React.Fragment key={`group-${type}`}>
                <tr>
                  <th
                    className={`flex items-center cursor-pointer ${
                      type === 'capacity'
                        ? 'has-text-primary'
                        : type === 'staffing'
                        ? 'has-text-link'
                        : type === 'Attrition'
                        ? 'has-text-danger'
                        : type === 'training'
                        ? 'has-text-link'
                        : ''
                    }`}
                    onClick={() => toggleTypeExpansion(type)}
                  >
                    <span className="mr-2">
                      {expandedTypes[type] ? '▼' : '▶'}
                    </span>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </th>
                </tr>
                {!expandedTypes[type] ? (
                  <tr>
                    <td>{typeFields[0].external}</td>
                  </tr>
                ) : (
                  typeFields.map((field) => (
                    <tr key={`field-${field.internal}`}>
                      <td>{field.external}</td>
                    </tr>
                  ))
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="column table-container ml-1">
        <table className="table is-striped is-hoverable">
          <thead>
            <tr>
              {capacity &&
                capacity.map((weekly) => (
                  <th
                    key={`weekly-head-${weekly.week.code}`}
                    className={
                      weekly.week.code === currentWeek.code
                        ? 'is-danger'
                        : 'is-dark'
                    }
                    style={{ whiteSpace: 'nowrap', cursor: 'pointer' }}
                    title={weekly.Comment}
                  >
                    <div className="mx-auto">{weekly.firstDate}</div>
                  </th>
                ))}
            </tr>
          </thead>
          <tfoot>
            <tr>
              {capacity &&
                capacity.map((weekly) => (
                  <th
                    key={`weekly-foot-${weekly.week.code}`}
                    className="is-dark"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {weekly.firstDate}
                  </th>
                ))}
            </tr>
          </tfoot>
          <tbody>
            {Object.entries(groupedFields).map(([type, typeFields]) => (
              <React.Fragment key={`group-body-${type}`}>
                <tr>
                  <th colSpan={capacity.length} style={{ textAlign: 'center' }}>
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </th>
                </tr>
                {!expandedTypes[type] ? (
                  <tr>
                    {capacity.map((weekly, index) => (
                      <td
                        key={`collapsed-${type}-${weekly.week.code}`}
                        style={{ whiteSpace: 'nowrap', textAlign: 'center' }}
                      >
                        {weekly[typeFields[0]?.internal] !== undefined ? (
                          Math.round(weekly[typeFields[0].internal] * 1000) /
                          1000
                        ) : weekly[typeFields[0]?.internal] === 0 ? (
                          <span className="has-text-primary">0</span>
                        ) : (
                          <span className="has-text-light">#</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ) : (
                  typeFields.map((field) => (
                    <tr key={`body-row-${field.internal}`}>
                      {capacity.map((weekly) => (
                        <td
                          key={`weekly-body-${weekly.week.code}-${field.internal}`}
                          style={{ whiteSpace: 'nowrap', textAlign: 'center' }}
                        >
                          {weekly[field.internal] !== undefined ? (
                            Math.round(weekly[field.internal] * 1000) / 1000
                          ) : weekly[field.internal] === 0 ? (
                            <span className="has-text-primary">0</span>
                          ) : (
                            <span className="has-text-light">#</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CapacityViewer;
