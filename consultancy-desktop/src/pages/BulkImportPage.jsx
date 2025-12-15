// src/pages/BulkImportPage.jsx
import React, { useState } from 'react';
import {
  FiUploadCloud,
  FiGrid,
  FiCheckCircle,
  FiAlertTriangle,
  FiDownload,
  FiFile,
  FiPackage,
  FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/BulkImportPage.css';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

const dbColumns = [
  { key: '', label: '-- Do Not Import --' },
  { key: 'name', label: 'Name (Required)' },
  { key: 'passportNo', label: 'Passport No (Required)' },
  { key: 'Position', label: 'Position' },
  { key: 'contact', label: 'Contact Number' },
  { key: 'aadhar', label: 'Aadhar Number' },
  { key: 'education', label: 'Education' },
  { key: 'experience', label: 'Experience' },
  { key: 'dob', label: 'Date of Birth' },
  { key: 'passportExpiry', label: 'Passport Expiry' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
];

const getFileName = (filePath) => {
  if (!filePath) return '';
  return filePath.replace(/\\/g, '/').split('/').pop();
};

function BulkImportPage() {
  const { user } = useAuthStore(
    useShallow((state) => ({
      user: state.user,
    }))
  );

  const [importMode, setImportMode] = useState('data'); // 'data' | 'docs'
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [mapping, setMapping] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState(null);

  // File Selection
  const handleFileSelect = async () => {
    setResults(null);

    const res = await window.electronAPI.showOpenDialog({
      title: 'Select Data File',
      buttonLabel: 'Select',
      filters: [
        {
          name: 'Import Files',
          extensions: ['csv', 'xlsx', 'xls'],
        },
      ],
      properties: ['openFile'],
    });

    if (!res.canceled && res.filePaths.length > 0) {
      const filePath = res.filePaths[0];
      const fileName = getFileName(filePath);
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      setFile({ path: filePath, name: fileName, isExcel });

      if (isExcel) {
        await fetchExcelSheets(filePath);
      } else {
        await fetchCsvHeaders(filePath);
      }
    }
  };

  // Fetch Excel Sheets
  const fetchExcelSheets = async (filePath) => {
    setIsLoading(true);
    try {
      const res = await window.electronAPI.getExcelSheets({ filePath });
      if (res.success) {
        setSheetNames(res.sheets);
        setSelectedSheet(res.sheets[0]);
        await handleSheetSelect(res.sheets[0], filePath);
        setStep(2);
      } else {
        toast.error(res.error || 'Failed to read Excel file');
        setFile(null);
      }
    } catch (error) {
      toast.error('Error reading Excel file: ' + error.message);
      setFile(null);
    }
    setIsLoading(false);
  };

  // Fetch CSV Headers
  const fetchCsvHeaders = async (filePath) => {
    setIsLoading(true);
    try {
      const res = await window.electronAPI.getCsvHeaders({ filePath });
      if (res.success) {
        setCsvHeaders(res.headers);
        autoMapHeaders(res.headers);
        setStep(2);
      } else {
        toast.error(res.error || 'Failed to read CSV file');
        setFile(null);
      }
    } catch (error) {
      toast.error('Error reading CSV file: ' + error.message);
      setFile(null);
    }
    setIsLoading(false);
  };

  // Handle Sheet Selection
  const handleSheetSelect = async (sheetName, path = file.path) => {
    setSelectedSheet(sheetName);
    setIsLoading(true);
    try {
      const res = await window.electronAPI.getExcelHeaders({
        filePath: path,
        sheetName,
      });
      if (res.success) {
        setCsvHeaders(res.headers);
        autoMapHeaders(res.headers);
      } else {
        toast.error(res.error || 'Failed to read sheet headers');
        setCsvHeaders([]);
        setMapping({});
      }
    } catch (error) {
      toast.error('Error reading sheet: ' + error.message);
      setCsvHeaders([]);
      setMapping({});
    }
    setIsLoading(false);
  };

  // Auto Map Headers
  const autoMapHeaders = (headers) => {
    const initialMap = {};
    headers.forEach((header) => {
      const simpleHeader = header.toLowerCase().replace(/[\s_]/g, '');
      const match = dbColumns.find(
        (col) =>
          col.key !== '' && simpleHeader.includes(col.key.toLowerCase())
      );
      initialMap[header] = match ? match.key : '';
    });
    setMapping(initialMap);
  };

  // Handle Mapping Change
  const handleMapChange = (csvHeader, dbColumn) => {
    setMapping((prev) => ({
      ...prev,
      [csvHeader]: dbColumn,
    }));
  };

  // Import Data
  const handleImportData = async () => {
    setIsLoading(true);
    const mappedValues = Object.values(mapping);

    if (!mappedValues.includes('name') || !mappedValues.includes('passportNo')) {
      toast.error('You must map columns to "Name" and "Passport No".');
      setIsLoading(false);
      return;
    }

    try {
      let res;
      if (file.isExcel) {
        res = await window.electronAPI.importCandidatesFromExcel({
          user,
          filePath: file.path,
          sheetName: selectedSheet,
          mapping,
        });
      } else {
        res = await window.electronAPI.importCandidatesFromFile({
          user,
          filePath: file.path,
          mapping,
        });
      }

      if (res.success) {
        setResults(res.data);
        setStep(3);
        toast.success(
          `Import finished. ${res.data.successfulCount} candidates added.`
        );
      } else {
        toast.error(res.error || 'Import failed');
      }
    } catch (error) {
      toast.error('Import error: ' + error.message);
    }

    setIsLoading(false);
  };

  // Reset
  const resetImporter = () => {
    setStep(1);
    setFile(null);
    setCsvHeaders([]);
    setSheetNames([]);
    setSelectedSheet('');
    setMapping({});
    setResults(null);
  };

  // Download Template
  const handleDownloadTemplate = async (e) => {
    e.stopPropagation();
    setIsLoading(true);
    try {
      const res = await window.electronAPI.downloadExcelTemplate();
      if (res.success) {
        toast.success(`Template saved to ${res.filePath}`);
      } else {
        toast.error(res.error || 'Failed to download template');
      }
    } catch (error) {
      toast.error('Error downloading template: ' + error.message);
    }
    setIsLoading(false);
  };

  // Download Errors
  const handleDownloadErrors = async () => {
    if (!results || results.failedCount === 0) return;

    setIsLoading(true);
    toast.loading('Generating error report...');
    try {
      const res = await window.electronAPI.downloadImportErrors({
        user,
        failedRows: results.failures,
      });
      toast.dismiss();

      if (res.success) {
        toast.success(`Error report saved to ${res.filePath}`);
      } else {
        toast.error(res.error || 'Failed to download error report');
      }
    } catch (error) {
      toast.dismiss();
      toast.error('Error generating report: ' + error.message);
    }
    setIsLoading(false);
  };

  // Document Import
  const handleDocArchiveSelect = async () => {
    const res = await window.electronAPI.showOpenDialog({
      title: 'Select Documents Archive',
      buttonLabel: 'Import Docs',
      filters: [{ name: 'Archives', extensions: ['zip'] }],
      properties: ['openFile'],
    });

    if (!res.canceled && res.filePaths.length > 0) {
      setIsLoading(true);
      toast.loading('Processing archive...');
      try {
        const importRes = await window.electronAPI.bulkImportDocuments({
          user,
          candidateIdMap: {},
          archivePath: res.filePaths[0],
        });
        toast.dismiss();
        if (importRes.success) {
          toast.success('Documents imported successfully!');
        } else {
          toast.error(importRes.error || 'Failed to import documents');
        }
      } catch (error) {
        toast.dismiss();
        toast.error('Error importing documents: ' + error.message);
      }
      setIsLoading(false);
    }
  };

  // Render Step 1 (Data)
  const renderDataStep1 = () => (
    <div className="import-card">
      <h3>
        <FiUploadCloud /> Step 1 · Select file
      </h3>
      <p>
        Choose a CSV or Excel file containing candidate data. The importer will
        help you map columns to database fields.
      </p>

      <div className="file-selection-box" onClick={handleFileSelect}>
        <FiUploadCloud />
        <h4>Drop your file here or click to browse</h4>
        <p>
          Supported formats: <strong>.csv</strong>, <strong>.xlsx</strong>,{' '}
          <strong>.xls</strong>
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={handleFileSelect}
        >
          <FiFile /> Choose file
        </button>

        <button
          type="button"
          className="ghost-btn"
          onClick={handleDownloadTemplate}
        >
          <FiDownload /> Download Excel template
        </button>

        {file && (
          <div className="file-name">
            <FiGrid />
            <span>{file.name}</span>
          </div>
        )}
      </div>
    </div>
  );

  // Render Step 2 (Mapping)
  const renderDataStep2 = () => (
    <div className="import-card">
      <div className="import-card-header-row">
        <h3>
          <FiGrid /> Step 2 · Map columns
        </h3>
        {file && (
          <span className="badge-file">
            <FiFile /> {file.name}
          </span>
        )}
      </div>

      {file?.isExcel && sheetNames.length > 0 && (
        <div className="sheet-selector">
          <label htmlFor="sheetSelect">📑 Worksheet:</label>
          <select
            id="sheetSelect"
            value={selectedSheet}
            onChange={(e) => handleSheetSelect(e.target.value)}
          >
            {sheetNames.map((sheet) => (
              <option key={sheet} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </div>
      )}

      {csvHeaders.length === 0 ? (
        <p className="info-text subtle">Loading headers...</p>
      ) : (
        <table className="mapping-table">
          <thead>
            <tr>
              <th>File column</th>
              <th>Database field</th>
            </tr>
          </thead>
          <tbody>
            {csvHeaders.map((header) => (
              <tr key={header}>
                <td>{header}</td>
                <td>
                  <select
                    value={mapping[header] || ''}
                    onChange={(e) =>
                      handleMapChange(header, e.target.value)
                    }
                  >
                    {dbColumns.map((col) => (
                      <option key={col.key} value={col.key}>
                        {col.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="card-actions">
        <button
          type="button"
          className="ghost-btn"
          onClick={() => setStep(1)}
        >
          ◀ Back
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={handleImportData}
          disabled={isLoading || !file}
        >
          {isLoading ? (
            <>
              <FiRefreshCw className="spin-icon" /> Importing…
            </>
          ) : (
            <>
              <FiCheckCircle /> Start import
            </>
          )}
        </button>
      </div>
    </div>
  );

  // Render Step 3 (Results)
  const renderDataStep3 = () => (
    <div className="import-card import-results">
      <h3>
        <FiCheckCircle /> Step 3 · Review results
      </h3>

      {results && (
        <>
          <div
            className={`form-message ${
              results.failedCount > 0 ? 'error' : 'success'
            }`}
          >
            {results.failedCount > 0 ? (
              <>
                <FiAlertTriangle />
                <span>
                  {results.successfulCount} records imported,{' '}
                  {results.failedCount} failed.
                </span>
              </>
            ) : (
              <>
                <FiCheckCircle />
                <span>
                  All {results.successfulCount} records imported
                  successfully.
                </span>
              </>
            )}
          </div>

          <ul>
            {results.failures?.map((row, idx) => (
              <li key={idx}>
                <span className="result-title">
                  Row {row.rowNumber} – {row.name || 'Unknown'}
                </span>
                <span className="result-message">{row.error}</span>
              </li>
            ))}
            {(!results.failures || results.failures.length === 0) && (
              <li className="result-empty">No errors to display.</li>
            )}
          </ul>

          <div className="card-actions">
            <button
              type="button"
              className="ghost-btn"
              onClick={resetImporter}
            >
              <FiRefreshCw /> New import
            </button>
            {results.failedCount > 0 && (
              <button
                type="button"
                className="secondary-btn"
                onClick={handleDownloadErrors}
              >
                <FiDownload /> Download error report
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  // Render Docs Import
  const renderDocsImport = () => (
    <div className="import-card">
      <h3>
        <FiPackage /> Bulk document import
      </h3>
      <p>
        Upload a <strong>ZIP file</strong> containing candidate documents.
        Files must be named like{' '}
        <code>PassportNo_DocumentType.pdf</code> (for example:{' '}
        <code>A1234567_Resume.pdf</code>). The system matches files to
        existing candidates by passport number.
      </p>

      <div
        className="file-selection-box docs-box"
        onClick={handleDocArchiveSelect}
      >
        <FiPackage />
        <h4>Drop your ZIP archive here or click to browse</h4>
        <p>
          Recommended: group documents by batch and keep file names
          consistent with your candidate passports.
        </p>
        <button
          type="button"
          className="primary-btn"
          onClick={handleDocArchiveSelect}
        >
          <FiUploadCloud /> Import documents
        </button>
      </div>
    </div>
  );

  return (
    <div className="bulk-import-container">
      <div className="bulk-import-header">
        <div>
          <h1>Bulk import</h1>
          <p className="header-subtitle">
            Quickly onboard multiple candidates and their documents using
            smart import tools.
          </p>
        </div>

        <div className="import-mode-toggle">
          <button
            type="button"
            className={`mode-btn ${
              importMode === 'data' ? 'active' : ''
            }`}
            onClick={() => setImportMode('data')}
          >
            <FiGrid /> Data
          </button>
          <button
            type="button"
            className={`mode-btn ${
              importMode === 'docs' ? 'active' : ''
            }`}
            onClick={() => setImportMode('docs')}
          >
            <FiPackage /> Documents
          </button>
        </div>
      </div>

      {importMode === 'data' && (
        <>
          <ol className="import-stepper">
            <li
              className={`stepper-item ${
                step === 1 ? 'active' : step > 1 ? 'completed' : ''
              }`}
            >
              <div className="step-number">1</div>
              <div className="step-title">Select file</div>
            </li>
            <li
              className={`stepper-item ${
                step === 2 ? 'active' : step > 2 ? 'completed' : ''
              }`}
            >
              <div className="step-number">2</div>
              <div className="step-title">Map columns</div>
            </li>
            <li
              className={`stepper-item ${step === 3 ? 'active' : ''}`}
            >
              <div className="step-number">3</div>
              <div className="step-title">Review results</div>
            </li>
          </ol>

          {step === 1 && renderDataStep1()}
          {step === 2 && renderDataStep2()}
          {step === 3 && renderDataStep3()}
        </>
      )}

      {importMode === 'docs' && renderDocsImport()}
    </div>
  );
}

export default BulkImportPage;
