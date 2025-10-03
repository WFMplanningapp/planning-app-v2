import { CSVReader } from 'react-papaparse';
import { useRef } from 'react';

const CSVUploader = ({ loadedHandler, removeHandler, label }) => {
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
    <div>
      <CSVReader
        config={{ encoding: 'ISO-8859-1' }}
        ref={buttonRef}
        onFileLoad={(raw) => {
          let csv = raw.map((entry) => entry.data);
          // console.log(csv)
          if (csv[0] && csv[0].length === csv[1].length) {
            let output = csv.slice(1).map((row) => {
              let rowObj = {};
              csv[0].forEach((field, index) => (rowObj[field] = row[index]));
              return rowObj;
            });
            loadedHandler(output);
            //console.log('Uploader Output', output);
          } else {
            console.log('Not CSV');
          }
        }}
        onError={(error) => console.log(error)}
        onRemoveFile={() => removeHandler()}
        noProgressBar
      >
        {({ file }) => (
          <div className="file has-name is-fullwidth is-right is-small has-text-centered is-info">
            <label className="file-label">
              <input
                className="file-input"
                type="file"
                name="csv"
                onClick={handleOpenDialog}
              />
              <span className="file-cta">
                <span className="file-label" onClick={handleOpenDialog}>
                  File to Upload
                </span>
              </span>

              <span className="file-name">{file && file.name}</span>
              <button
                className="is-danger button is-small ml-1"
                onClick={handleRemoveFile}
              >
                x
              </button>
            </label>
          </div>
        )}
      </CSVReader>

      {label && <label style={{ fontSize: '0.6em' }}>{label}</label>}
    </div>
  );
};

export default CSVUploader;
