import { useEffect, useState } from "react"

export default function useData(selected) {
  const [data, setData] = useState(null)

  useEffect(() => {
    refresh()
  }, [])

  const refresh = async () => {
    {
      if (selected) {
        const response = await fetch(
          `/api/data/structures?selected=${selected.join("+")}`
        )
        if (!response.ok) {
          // oups! something went wrong
          return
        }

        const fetched = await response.json()
        setData(fetched.data)
      } else {
        //console.log("No initial data!")
        return
      }
    }
  }

  return { ...data, refresh }
}
