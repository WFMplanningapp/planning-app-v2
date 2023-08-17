import { useEffect, useState } from "react"

const FormDropdown = ({
  fieldName,
  data,
  disabled,
  form,
  callback,
  reset,
  debug,
}) => {
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    setSelected(form.get(fieldName))
  }, [form.get(fieldName)])

  useEffect(() => {
    if (debug) debug()
  }, [data])

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
        }}
        value={selected ? JSON.stringify(selected) : `${fieldName}`}
      >
        {!selected && (
          <option value={null}>{`${fieldName.match(/(From|To)\w*/g)}`}</option>
        )}
        {data &&
          data.map((item, index) => (
            <option
              key={"form-" + (item._id || item.name)}
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
