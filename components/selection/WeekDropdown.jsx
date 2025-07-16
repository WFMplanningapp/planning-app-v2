import { useEffect, useState } from "react"

const WeekDropdown = ({
  fieldName,
  label,
  weekRange,
  disabled,
  form,
  callback,
}) => {
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setSelected(form.get(fieldName))
  }, [form.get(fieldName)])

  return (
    <div className="select is-small is-rounded">
      <select
        style={{ minWidth: "150px" }}
        disabled={disabled}
        onChange={(e) => {
          let json = JSON.parse(e.target.value)
          // console.log(json)
          setSelected(json)
          form.set(fieldName, json)
          if (callback && form) {
            callback(form, json)
          }
        }}
        value={
          selected ? JSON.stringify(selected) : `Select ${label || fieldName}`
        }
      >
        {!selected && (
          <option value={null}>{`Select ${label || fieldName}`}</option>
        )}
        {weekRange &&
          weekRange.map((item, index) => (
            <option
              className={
                item.firstDate > new Date().toISOString()
                  ? "has-text-danger"
                  : ""
              }
              key={"selection-" + item._id}
              value={JSON.stringify(item)}
            >
              {`${item.code} - ${item.firstDate.split("T")[0]}`}
            </option>
          ))}
      </select>
    </div>
  )
}

export default WeekDropdown
