import { useEffect, useState } from "react"

const FormDropdown = ({
  fieldName,
  subFieldName,
  data,
  disabled,
  form,
  callback,
  reset,
  debug,
  getNestedItem,
}) => {
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    console.log(
      "SETTING SELECTED: ",
      form.get(fieldName),
      handleGetItem(form.get(fieldName))
    )
    setSelected(handleGetItem(form.get(fieldName)))
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
        style={{ minWidth: "40px" }}
        disabled={disabled}
        onChange={(e) => {
          let json = JSON.parse(e.target.value)
          console.log("JSON:", json)
          setSelected(json)

          if (reset) {
            let newForm = {
              ...form.getForm(),
              [fieldName]: json,
            }
            reset.forEach((field) => (newForm[field] = null))
            form.setMany(newForm)
          } else {
            form.set(fieldName, json)
          }
          if (callback && form) {
            callback(form, json, e.target.value)
          }
          return
        }}
        value={
          selected
            ? JSON.stringify(selected)
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
              key={"form-" + item._id || item.name}
              value={JSON.stringify(item)}
            >
              {item.name}
            </option>
          ))}
      </select>
    </div>
  )
}

export default FormDropdown
