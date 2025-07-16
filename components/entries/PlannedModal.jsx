import PlannedForm from "./PlannedForm"

const PlannedModal = ({ active, toggle, selection, channel, week }) => {
  return (
    <div className={`modal ${active ? "is-active" : ""}`}>
      <div className="modal-background"></div>
      {selection.get("capPlan") && week && (
        <div className="modal-card" style={{ minWidth: "15vw" }}>
          <header className="modal-card-head  py-2">
            <p className="modal-card-title ">
              <span className="tag is-primary is-medium">
                {week.code + " - " + week.firstDate.split("T")[0]}
              </span>
              <span className="tag is-light is-medium">
                {channel && channel}
              </span>
            </p>

            <button
              className="delete"
              onClick={() => toggle(null, false)}
              aria-label="close"
            ></button>
          </header>
          <section className="modal-card-body pb-0 pt-2">
            <div>
              {active && selection.get("capPlan") && week && channel ? (
                <PlannedForm
                  selection={selection}
                  channel={channel}
                  week={week}
                  toggle={toggle}
                />
              ) : (
                <h3>loading</h3>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default PlannedModal
