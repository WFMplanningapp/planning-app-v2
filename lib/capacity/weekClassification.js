const DAY_IN_MILLISECONDS =
  24 * 60 * 60 * 1000

const getDateValue = (value) => {
  if (
    value &&
    typeof value === "object" &&
    "$date" in value
  ) {
    return value.$date
  }

  return value
}

const toValidDate = (value) => {
  const date =
    value instanceof Date
      ? new Date(value.getTime())
      : new Date(getDateValue(value))

  return Number.isNaN(date.getTime())
    ? null
    : date
}

const getEndExclusive = (
  week,
  weekStart
) => {
  const lastDate = toValidDate(
    week?.lastDate
  )

  if (lastDate) {
    return new Date(
      lastDate.getTime() +
        DAY_IN_MILLISECONDS
    )
  }

  return new Date(
    weekStart.getTime() +
      7 * DAY_IN_MILLISECONDS
  )
}

export const classifyCapacityWeek = (
  week,
  referenceDate = new Date()
) => {
  const weekStart = toValidDate(
    week?.firstDate
  )

  const now = toValidDate(
    referenceDate
  )

  if (!weekStart || !now) {
    return {
      periodType: "unknown",
      availabilitySource: null,
      usesPlannedAvailability: false,
    }
  }

  const weekEndExclusive =
    getEndExclusive(
      week,
      weekStart
    )

  if (now < weekStart) {
    return {
      periodType: "future",
      availabilitySource: "planned",
      usesPlannedAvailability: true,
    }
  }

  if (now >= weekEndExclusive) {
    return {
      periodType: "completed",
      availabilitySource: "actual",
      usesPlannedAvailability: false,
    }
  }

  return {
    periodType: "current",
    availabilitySource: "planned",
    usesPlannedAvailability: true,
  }
}
