import { useState } from "react"
import { FaLock } from "react-icons/fa"
import { useAuth } from "../../contexts/authContext"

const PlannedForm = ({ selection, week, channel, toggle }) => {
  const [formInfo, setFormInfo] = useState({
    name: channel,
    volumes: 0,
    aht: 0,
  })

  const auth = useAuth()

  const handleChange = (e, field, changeConfig) => {
    if (!changeConfig) {
      setFormInfo({ ...formInfo, [field]: e.target.value })
    } else {
      setFormInfo({
        ...formInfo,
        config: { ...formInfo.config, [field]: e.target.value },
      })
    }
  }

  const handleSubmit = () => {
    fetch(
      `/api/data/entries/planned?capPlan=${selection.get("capPlan")._id}&week=${
        week.code
      }`,
      {
        method: "POST",
        headers: {
          Authorization: auth.authorization(),
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload: formInfo,
        }),
      }
    )
      .then((res) => res.json())
      .then((fetched) => {
        alert(fetched.message)
      })
      .catch()

    toggle(null, true)
    return
  }

  return (
    <>
      <div>
        <form className="is-size-5">
          <div className="columns has-text-centered">
            <div className="column is-half">
              <label>VOLUMES</label>
              <input
                className={
                  "input mx-3  is-rounded " +
                  (formInfo["volumes"] ? "is-danger" : "")
                }
                type={"number"}
                aria-label={"volumes"}
                value={formInfo["volumes"] || ""}
                disabled={!week}
                onChange={(e) => handleChange(e, "volumes")}
              />
            </div>

            <div className="column is-half">
              <label>AHT</label>

              <input
                className={
                  "input is-rounded " + (formInfo["aht"] ? "is-danger" : "")
                }
                aria-label={"aht"}
                value={formInfo["aht"] || ""}
                disabled={!week}
                onChange={(e) => handleChange(e, "aht")}
              />
            </div>
          </div>

          <div className="columns has-text-right my-0">
            <div key={`Col-Button`} className="column is-12 py-0">
              <button
                type="button"
                className={`button is-fullwidth ${
                  auth.allowedManager ? "is-primary" : "is-danger"
                }`}
                onClick={handleSubmit}
                disabled={!auth.allowedManager}
              >
                {auth.allowedManager ? (
                  "SUBMIT"
                ) : (
                  <span>
                    <FaLock className="mx-1" /> Unauthorized Access
                  </span>
                )}
              </button>
            </div>
          </div>
        </form>

        <br></br>
      </div>
    </>
  )
}

export default PlannedForm
