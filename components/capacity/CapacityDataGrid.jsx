import {
  DataGrid,
  GridToolbarExport,
  gridClasses,
  GridFooterContainer,
} from "@mui/x-data-grid"

const CapacityDataGrid = ({ data, fields }) => {
  return (
    <div style={{ height: 600, width: "100%" }}>
      <DataGrid
        components={{
          Footer: () => (
            <GridFooterContainer className={gridClasses.toolbarContainer}>
              <GridToolbarExport />
            </GridFooterContainer>
          ),
        }}
        style={{ fontSize: "0.75rem" }}
        checkboxSelection={true}
        disableColumnMenu
        rows={data.map((row, index) => ({
          ...row,
          id: index,
        }))}
        columns={[
          { field: "id", headerName: "#", minWidth: 70, flex: 0.5 },
          { field: "firstDate", headerName: "week", minWidth: 100, flex: 1 },
          ...fields.map((field, index) => ({
            field: field.internal,
            headerName: field.external,
            minWidth: 100,
            flex: 1,
          })),
        ]}
        height
      />
    </div>
  )
}

export default CapacityDataGrid
