import {
  useCallback,
  useEffect,
  useState,
} from "react"
import { useAuth } from "../contexts/authContext"

export default function useData(selected) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  const auth = useAuth()
  const authorization = auth.authorization()

  const selectedKey = Array.isArray(selected)
    ? selected.join(",")
    : ""

  const refresh = useCallback(async () => {
    if (!selectedKey || !authorization) {
      setData(null)
      return
    }

    try {
      setError(null)

      const parameters = new URLSearchParams({
        selected: selectedKey,
      })

      const response = await fetch(
        `/api/data/structures?${parameters.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: authorization,
          },
        }
      )

      const fetched = await response.json()

      if (!response.ok) {
        setData(null)
        setError(
          fetched.message ||
            "Unable to retrieve application data."
        )
        return
      }

      setData(fetched.data)
    } catch (requestError) {
      console.error(
        "Structure request failed:",
        requestError
      )

      setData(null)
      setError("Unable to retrieve application data.")
    }
  }, [authorization, selectedKey])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    ...data,
    refresh,
    error,
  }
}
