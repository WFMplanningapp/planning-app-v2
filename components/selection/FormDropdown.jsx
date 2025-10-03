import { uniqueId } from "lodash"
import { useEffect, useState } from "react"

const FormDropdown = ({
  fieldName,
  subFieldName,
  data,
  disabled,
  className,
  form,
  callback,
  reset,
  debug,
  getNestedItem,
}) => {
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    !form.checkIsReset() && setSelected(handleGetItem(form.get(fieldName)))
  }, [form.get(fieldName)])

  useEffect(() => {
    if (debug) debug()
  }, [data])

  const handleGetItem = (i) => {
    if (getNestedItem) {
      return getNestedItem(i)
    } else {
      return i
    }
  }

  return (
    <div className="select is-small is-rounded">
      <select
        className={className}
        style={{ minWidth: "40px" }}
        disabled={disabled}
        onChange={(e) => {
          let value = e.target.value
          //console.log("Value:", value)
          setSelected(value)

          if (reset) {
            let newForm = {
              ...form.getForm(),
              [fieldName]: value,
            }
            reset.forEach((field) => (newForm[field] = null))
            form.setMany(newForm)
          } else if (!callback) {
            form.set(fieldName, value)
          } else if (callback && form) {
            callback(form, value, e.target.value)
          }
          return
        }}
        value={
          selected
            ? selected
            : `Select ${subFieldName ? subFieldName : fieldName}`
        }
      >
        {!selected && (
          <option value={null}>{`Select ${
            subFieldName ? subFieldName : fieldName
          }`}</option>
        )}
        {data &&
          data.map((item) => (
            <option
              key={"form-" + subFieldName + "-" + uniqueId()}
              value={item}
            >
              {item}
            </option>
          ))}
      </select>
    </div>
  )
}

export default FormDropdown
