/**
 * @props
 *
 * fields = [{name: STRING, default: ANY, required: BOOLEAN}, ...]
 * callback = function (form) => runs instead of resetAll()
 *
 **/

import { useEffect, useState } from "react"

const useForm = ({ fields, callback }) => {
  const [form, setForm] = useState({})

  useEffect(() => {
    fields && (callback ? callback(form) : resetAll())
  }, [])

  const set = (fieldName, value) => {
    let found = fields.find((field) => field.name === fieldName)

    if (found) {
      console.log("FOUND")
      setForm({ ...form, [fieldName]: value })
    } else {
      console.log("Field does not exist")
    }
  }

  const setMany = (formObj) => {
    setForm(formObj)
    console.log(formObj)
  }

  const resetOne = (fieldName) => {
    let found = fields.find((field) => fieldName === field.name)

    if (found) {
      setForm({ ...form, [fieldName]: found.default })
    } else {
      console.log("Field does not exist")
    }
  }

  const resetAll = () => {
    let newForm = {}
    fields.forEach((field) => {
      newForm = { ...newForm, [field.name]: field.default }
    })
    setForm(newForm)
  }

  const getForm = () => {
    return form || null
  }

  const get = (fieldName) => {
    return form[fieldName] || null
  }

  const checkRequired = () => {
    let checked = true
    fields.forEach((field) => {
      checked = field.required ? (form[field.name] ? checked : false) : checked
    })
    return checked
  }

  return {
    getForm,
    get,
    set,
    setMany,
    resetOne,
    resetAll,
    checkRequired,
  }
}

export default useForm
