import EntryForm from "./EntryForm"
import { useState, useEffect } from "react"
import { FaAngleRight, FaAngleLeft } from "react-icons/fa"


const EntriesModal = ({ active, toggle, selection, week, weeks }) => {

  console.log(weeks)
  const [currentWeek, setCurrentWeek] = useState(week)
  const [selectedWeekIdx, setSelectedWeekIdx] = useState(null)
  const [colorLft, setColorLft] = useState("");
  const [colorRgt, setColorRgt] = useState("");


  useEffect(() => {
    console.log(week)
    setCurrentWeek(week)
    setTimeout(selectWeek(week), 0)
  }, [week])
  
  const selectWeek = (week) => {
    console.log(currentWeek)

    const weekIndex = weeks.findIndex(smn => {
      console.log(smn.code === week.code)
      return smn.code === week.code
    })
    setSelectedWeekIdx(weekIndex)
    setCurrentWeek(week);
  }
  
  const nextWeek = () => {
    if ( selectedWeekIdx < (weeks.length - 1)){
      setCurrentWeek(weeks[selectedWeekIdx + 1]) 
      setSelectedWeekIdx(selectedWeekIdx + 1)
    }
  }
  
  const prevWeek = () => {
    if ( selectedWeekIdx > 0 ){
      setCurrentWeek(weeks[selectedWeekIdx - 1]) 
      setSelectedWeekIdx(selectedWeekIdx - 1)
    }
  }
  
  const close = () => {
    setCurrentWeek(week)
    selectWeek(week)
    toggle()
  }

  console.log(currentWeek)
  return currentWeek && currentWeek.firstDate ? (
    <div className={`modal ${active ? "is-active" : ""}`}>
      <div className="modal-background"></div>
      {selection.get("capPlan") && currentWeek && (
        <div className="modal-card" style={{ minWidth: "80vw" }}>
          <header className="modal-card-head  py-2">
            
            <div className="modal-card-title" style={{flex:1}}>
              
              <span className="tag is-light is-medium">
                {selection.get("capPlan").name}
              </span>
              </div>
              <div 
              style={{display:"flex"}}
              >
              <button
              onMouseEnter={() => setColorLft("#67958e")}
              onMouseLeave={() => setColorLft("")}
              onMouseDown={() => setColorLft("#5b716e")}
              onMouseUp={() => setColorLft("#67958e")}
              className="tag is-primary is-medium"
              style={{cursor:"pointer", borderWidth: 0, marginRight:"10px", backgroundColor: colorLft}}
              onClick={ prevWeek }
              ><FaAngleLeft /></button>
              <span className="tag is-primary is-medium">
                {currentWeek.code + " - " + currentWeek.firstDate.split("T")[0]}
              </span>
              <button
              onMouseEnter={() => setColorRgt("#67958e")}
              onMouseLeave={() => setColorRgt("")}
              onMouseDown={() => setColorRgt("#5b716e")}
              onMouseUp={() => setColorRgt("#67958e")}
              className="tag is-primary is-medium"
              style={{cursor:"pointer", borderWidth: 0, marginLeft:"10px", backgroundColor: colorRgt}}
              onClick={ nextWeek }
              ><FaAngleRight /></button>
              <div

              ></div>
              </div>
              <div
              style={{flex:1,textAlign:"right"}}
              >
            <button
              className="delete"
              onClick={close}
              aria-label="close"
            ></button>
            </div>
          </header>
          <section className="modal-card-body pb-0 pt-2">
            <div>
              {active && selection.get("capPlan") && currentWeek ? (
                <EntryForm selection={selection} week={currentWeek} />
              ) : (
                <h3>loading</h3>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  ) : null
}

export default EntriesModal
