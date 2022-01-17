import { useState } from "react"
import _ from "lodash"
/**
 * @props
 **/

const useCapacity = () => {
  const [capacity, setCapacity] = useState(null)
  const [generated, setGenerated] = useState(false)

  const generate = (capPlan) => {
    if (capPlan && capPlan._id) {
      fetch(`/api/capacity/${capPlan._id}`)
        .then((response) => response.json())
        .then((data) => {
          console.log(data.message)
          setCapacity(data.capacity)
          setGenerated(true)
        })
        .catch((err) => console.log(err))
    } else {
      console.log("No initial data!")
    }
    return
  }

  const reset = () => {
    setCapacity(null)
  }

  const get = (weekRange, fields) => {
    if (!capacity) {
      console.log("No capacity generated")
      return []
    }

    let firstIndex
    if (weekRange) {
      for (let i = 0; i < capacity.length; ++i) {
        if (weekRange[0].code === capacity[i].week.code) {
          firstIndex = i
          break
        }
      }
    }

    let output = weekRange
      ? weekRange.map((week, index) => {
          return fields
            ? {
                ..._.pick(capacity[firstIndex + index], fields),
              }
            : {
                ...capacity[firstIndex + index],
              }
        })
      : capacity

    return output
  }

  const isGenerated = () => {
    return generated
  }

  return {
    generate,
    isGenerated,
    reset,
    get,
  }
}

export default useCapacity
