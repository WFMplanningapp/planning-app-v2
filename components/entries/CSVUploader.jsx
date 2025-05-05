import { CSVReader } from 'react-papaparse';
import { useRef } from 'react';

const CSVUploader = ({ loadedHandler, removeHandler, header, label }) => {
  const buttonRef = useRef();

  const handleOpenDialog = (e) => {
    // Note that the ref is set async, so it might be null at some point
    if (buttonRef.current) {
      buttonRef.current.open(e);
    }
  };

  const handleRemoveFile = (e) => {
    // Note that the ref is set async, so it might be null at some point
    if (buttonRef.current) {
      buttonRef.current.removeFile(e);
    }
    removeHandler();
  };

  return (
    <div className="d-flex flex-column m-2 align-items-center">
      <h6>{header ? header : 'Upload CSV'}</h6>
      <CSVReader
        config={{ encoding: 'ISO-8859-1' }}
        ref={buttonRef}
        onFileLoad={(csv) => {
          //console.log(csv)
          loadedHandler(csv.map((entry) => entry.data));
        }}
        onError={(error) => console.log(error)}
        onRemoveFile={() => removeHandler()}
        noProgressBar
      >
        {({ file }) => (
          <aside className="d-flex">
            <button
              type="button"
              onClick={handleOpenDialog}
              className="btn btn-primary btn-sm"
            >
              Browse
            </button>
            <div
              className="border mx-1 d-flex align-items-center justify-content-center"
              style={{ width: '300px', overflow: 'hidden', fontSize: '0.75em' }}
            >
              {file && file.name}
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleRemoveFile}
            >
              Remove
            </button>
          </aside>
        )}
      </CSVReader>
      {label && (
        <label className="text-secondary mt-1" style={{ fontSize: '0.7em' }}>
          {label}
        </label>
      )}
    </div>
  );
};

export default CSVUploader;
