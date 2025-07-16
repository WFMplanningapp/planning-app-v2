const useWeeks = (weeks) => {
  const getCurrentWeek = () => {
    let today = new Date()
    return weeks.find((week) => week.firstDate > today.toISOString())
  }

  const getWeekRelative = (dif) => {
    let currentWeekIndex = weeks.indexOf(getCurrentWeek())
    console.log(dif, currentWeekIndex + dif)
    return weeks[currentWeekIndex + parseFloat(dif)]
  }

  const getWeek = ({ value, type }) => {
    return weeks.find((week) => week[type] === value)
  }

  const getWeekRange = (fromWeek, toWeek) => {
    if (toWeek) {
      return weeks
        ? weeks.slice(
            weeks.indexOf(
              getWeek({ value: fromWeek || weeks[0], type: "code" })
            ),
            1 + weeks.indexOf(getWeek({ value: toWeek, type: "code" }))
          )
        : null
    } else {
      return weeks
        ? weeks
            .slice(
              weeks.indexOf(
                getWeek({ value: fromWeek || weeks[0], type: "code" })
              )
            )
            .sort((a, b) =>
              a.firstDate > b.firstDate ? 1 : a.firstDate < b.firstDate ? -1 : 0
            )
        : null
    }
  }

  const getMonth = (week) => {
    return week.firstDate.split("T")[0].split("-")[2]
  }

  return {
    getCurrentWeek,
    getWeekRelative,
    getWeek,
    getWeekRange,
    getMonth,
  }
}

export default useWeeks
