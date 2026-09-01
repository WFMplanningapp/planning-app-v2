import { useState } from "react"
import _ from "lodash"
import { useAuth } from "../contexts/authContext"

const useCapacity = () => {
  const [capacity, setCapacity] = useState(null)
  const [generated, setGenerated] =
    useState(false)
  const [lastUpdated, setLastUpdated] =
    useState(null)

  const auth = useAuth()

  const generate = async (capPlan) => {
    if (!capPlan?._id) {
      return
    }

    const authorization = auth.authorization()

    if (!authorization) {
      console.error(
        "Capacity request requires authentication."
      )
      return
    }

    setGenerated(false)

    try {
      const [capacityResponse, updatedResponse] =
        await Promise.all([
          fetch(
            `/api/capacity/${encodeURIComponent(
              capPlan._id
            )}`,
            {
              method: "GET",
              headers: {
                Authorization: authorization,
              },
            }
          ),
          fetch(
            `/api/data/find/lastUpdated?capPlan=${encodeURIComponent(
              capPlan._id
            )}`,
            {
              method: "GET",
              headers: {
                Authorization: authorization,
              },
            }
          ),
        ])

      const capacityResult =
        await capacityResponse.json()

      if (!capacityResponse.ok) {
        throw new Error(
          capacityResult.message ||
            "Unable to generate capacity."
        )
      }

      setCapacity(
        Array.isArray(capacityResult.capacity)
          ? capacityResult.capacity
          : []
      )
      setGenerated(true)

      const updatedResult =
        await updatedResponse.json()

      if (updatedResponse.ok) {
        setLastUpdated(
          updatedResult.data || null
        )
      } else {
        setLastUpdated(null)
      }
    } catch (error) {
      console.error(
        "Capacity request failed:",
        error
      )

      setCapacity(null)
      setLastUpdated(null)
      setGenerated(false)
    }
  }

  const reset = () => {
    setCapacity(null)
    setLastUpdated(null)
    setGenerated(false)
  }

  const get = (weekRange, fields) => {
    if (!capacity) {
      return []
    }

    let firstIndex

    if (weekRange) {
      for (
        let index = 0;
        index < capacity.length;
        index += 1
      ) {
        if (
          weekRange[0].code ===
          capacity[index].week.code
        ) {
          firstIndex = index
          break
        }
      }
    }

    if (
      weekRange &&
      firstIndex === undefined
    ) {
      return []
    }

    return weekRange
      ? weekRange.map((week, index) => {
          const weeklyCapacity =
            capacity[firstIndex + index]

          if (!weeklyCapacity) {
            return {}
          }

          return fields
            ? {
                ..._.pick(
                  weeklyCapacity,
                  fields
                ),
              }
            : {
                ...weeklyCapacity,
              }
        })
      : capacity
  }

  const isGenerated = () => generated

  const getLastUpdated = () =>
    lastUpdated

  return {
    generate,
    isGenerated,
    reset,
    get,
    getLastUpdated,
  }
}

export default useCapacity
