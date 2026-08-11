import {
  DataGrid,
  GridToolbarExport,
  gridClasses,
  GridFooterContainer,
} from "@mui/x-data-grid"

const legacyPercentFields = new Set([
  "fcAttrition",
  "attrPercent",
  "plannedVac",
  "plannedAbs",
  "plannedAux",
  "actVac",
  "actAbs",
  "actAux",
])

const getNumericValue = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null
  }

  const numericValue = Number(value)

  return Number.isFinite(numericValue)
    ? numericValue
    : null
}

const formatNumber = (value) => {
  const numericValue = getNumericValue(value)

  if (numericValue === null) {
    return ""
  }

  return (
    Math.round(
      numericValue * 1000
    ) / 1000
  ).toString()
}

const formatPercentage = (value) => {
  const numericValue = getNumericValue(value)

  if (numericValue === null) {
    return ""
  }

  return `${numericValue.toFixed(2)}%`
}

const getFormattedValue = (
  formatterParams,
  field
) => {
  // This supports the valueFormatter signatures used
  // across different MUI DataGrid versions.
  const value =
    formatterParams &&
    typeof formatterParams === "object" &&
    Object.prototype.hasOwnProperty.call(
      formatterParams,
      "value"
    )
      ? formatterParams.value
      : formatterParams

  if (
    field.format === "percent" ||
    legacyPercentFields.has(field.internal)
  ) {
    return formatPercentage(value)
  }

  if (field.format === "number") {
    return formatNumber(value)
  }

  return value ?? ""
}

const CapacityDataGrid = ({
  data = [],
  fields = [],
}) => {
  const rows = data.map(
    (row, index) => ({
      ...row,

      // Keep the visible row number consistent
      // with the previous zero-based display.
      rowNumber: index,

      // Use the week code as the stable DataGrid ID.
      // Fall back safely for legacy data.
      id:
        row.week?.code ||
        row.week ||
        row.firstDate ||
        `capacity-row-${index}`,
    })
  )

  const columns = [
    {
      field: "rowNumber",
      headerName: "#",
      minWidth: 70,
      flex: 0.5,
      sortable: false,
      filterable: false,
    },
    {
      field: "firstDate",
      headerName: "week",
      minWidth: 100,
      flex: 1,
    },
    ...fields.map((field) => ({
      field: field.internal,
      headerName: field.external,
      minWidth: 120,
      flex: 1,

      // Keep the underlying value numeric so that
      // sorting continues to work numerically.
      type:
        field.format === "number" ||
        field.format === "percent" ||
        legacyPercentFields.has(field.internal)
          ? "number"
          : undefined,

      valueFormatter: (params) =>
        getFormattedValue(params, field),
    })),
  ]

  return (
    <div
      style={{
        height: 600,
        width: "100%",
      }}
    >
      <DataGrid
        components={{
          Footer: () => (
            <GridFooterContainer
              className={
                gridClasses.toolbarContainer
              }
            >
              <GridToolbarExport />
            </GridFooterContainer>
          ),
        }}
        style={{
          fontSize: "0.75rem",
        }}
        checkboxSelection={true}
        disableColumnMenu
        rows={rows}
        columns={columns}
      />
    </div>
  )
}

export default CapacityDataGrid