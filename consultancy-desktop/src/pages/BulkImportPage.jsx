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
  FiRefreshCw 
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
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  
  const [importMode, setImportMode] = useState('data');
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
      filters: [{ name: 'Import Files', extensions: ['csv', 'xlsx', 'xls'] }],
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
        sheetName 
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
    headers.forEach(header => {
      const simpleHeader = header.toLowerCase().replace(/[\s_]/g, '');
      const match = dbColumns.find(col => 
        col.key !== '' && simpleHeader.includes(col.key.toLowerCase())
      );
      initialMap[header] = match ? match.key : '';
    });
    setMapping(initialMap);
  };

  // Handle Mapping Change
  const handleMapChange = (csvHeader, dbColumn) => {
    setMapping(prev => ({ ...prev, [csvHeader]: dbColumn }));
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
        toast.success(`Import finished. ${res.data.successfulCount} candidates added.`);
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

  // Render Step 1
  const renderDataStep1 = () => (
    <div className="import-card">
      <div 
        className="file-selection-box" 
        onClick={handleFileSelect}
        style={{ 
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.6 : 1 
        }}
      >
        {isLoading ? (
          <>
            <FiRefreshCw className="spin-icon" style={{ fontSize: '3rem' }} />
            <h4>Loading file...</h4>
          </>
        ) : (
          <>
            <FiUploadCloud style={{ fontSize: '3rem' }} />
            <h4>Drag & Drop your .CSV or .XLSX file here</h4>
            <p>or</p>
            <button className="btn btn-secondary">Click to Select File</button>
          </>
        )}
      </div>
      <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        <button 
          className="btn" 
          onClick={handleDownloadTemplate} 
          disabled={isLoading}
        >
          <FiDownload /> Download Excel Template
        </button>
      </div>
    </div>
  );

  // Render Step 2
  const renderDataStep2 = () => (
    <div className="import-card">
      <h3>Map Your Columns</h3>
      <p>File: <strong>{file.name}</strong></p>
      
      {file.isExcel && (
        <div className="form-group" style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
          <label><FiGrid /> Select Excel Sheet</label>
          <select 
            value={selectedSheet} 
            onChange={(e) => handleSheetSelect(e.target.value)}
            disabled={isLoading}
          >
            {sheetNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <FiRefreshCw className="spin-icon" style={{ fontSize: '2rem' }} />
          <p>Loading headers...</p>
        </div>
      ) : (
        <table className="mapping-table">
          <thead>
            <tr>
              <th>File Column</th>
              <th>Database Field</th>
            </tr>
          </thead>
          <tbody>
            {csvHeaders.map(header => (
              <tr key={header}>
                <td>{header}</td>
                <td>
                  <select 
                    value={mapping[header] || ''} 
                    onChange={(e) => handleMapChange(header, e.target.value)}
                  >
                    {dbColumns.map(col => (
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

      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginTop: '1.5rem' 
      }}>
        <button 
          className="btn btn-secondary" 
          onClick={resetImporter}
          disabled={isLoading}
        >
          Back
        </button>
        <button 
          className="btn" 
          onClick={handleImportData} 
          disabled={isLoading || csvHeaders.length === 0}
        >
          {isLoading ? 'Importing...' : 'Run Import'}
        </button>
      </div>
    </div>
  );

  // Render Step 3
  const renderDataStep3 = () => (
    <div className="import-card import-results">
      <h3>Import Complete</h3>
      
      {results.successfulCount > 0 && (
        <div className="form-message success">
          <FiCheckCircle /> Added {results.successfulCount} candidates.
        </div>
      )}
      
      {results.failedCount > 0 && (
        <>
          <div className="form-message error">
            <FiAlertTriangle /> Failed {results.failedCount} candidates.
          </div>
          <button 
            className="btn btn-danger" 
            onClick={handleDownloadErrors} 
            disabled={isLoading}
          >
            <FiDownload /> Download Error Report
          </button>
        </>
      )}
      
      <button 
        className="btn" 
        onClick={resetImporter} 
        style={{ marginTop: '1rem' }}
      >
        Import Another File
      </button>
    </div>
  );

  // Render Document Import
  const renderDocumentImport = () => (
    <div className="import-card">
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <FiPackage style={{ 
          fontSize: '3rem', 
          color: 'var(--primary-color)', 
          marginBottom: '1rem' 
        }} />
        <h3>Bulk Document Import</h3>
        <p style={{ 
          maxWidth: '500px', 
          margin: '0 auto 1.5rem auto', 
          color: 'var(--text-secondary)' 
        }}>
          Upload a <strong>ZIP file</strong> containing candidate documents. 
          Files should be named using the pattern: <code>PassportNo_DocumentType.pdf</code> 
          (e.g., <code>A1234567_Resume.pdf</code>).
        </p>
        <button 
          className="btn btn-primary" 
          onClick={handleDocArchiveSelect} 
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Select ZIP Archive'}
        </button>
        <p style={{ 
          marginTop: '1rem', 
          fontSize: '0.85rem', 
          fontStyle: 'italic', 
          color: 'var(--text-secondary)' 
        }}>
          Note: This feature matches files to existing candidates by Passport Number.
        </p>
      </div>
    </div>
  );

  return (
    <div className="bulk-import-container">
      <h1><FiUploadCloud /> Bulk Import</h1>

      {/* Mode Switcher */}
      <div className="custom-tabs-container" style={{ marginBottom: '2rem' }}>
        <div className="tabs-header">
          <button 
            className={`tab-btn ${importMode === 'data' ? 'active' : ''}`} 
            onClick={() => setImportMode('data')}
          >
            <FiGrid /> Import Candidate Data
          </button>
          <button 
            className={`tab-btn ${importMode === 'documents' ? 'active' : ''}`} 
            onClick={() => setImportMode('documents')}
          >
            <FiFile /> Import Documents (ZIP)
          </button>
        </div>
      </div>

      {importMode === 'data' && (
        <>
          <ul className="import-stepper">
            <li className={`stepper-item ${step >= 1 ? 'active' : ''}`}>
              <span className="step-number">1</span>
              <span className="step-title">Select</span>
            </li>
            <li className={`stepper-item ${step >= 2 ? (step === 2 ? 'active' : 'completed') : ''}`}>
              <span className="step-number">2</span>
              <span className="step-title">Map</span>
            </li>
            <li className={`stepper-item ${step === 3 ? 'completed' : ''}`}>
              <span className="step-number">3</span>
              <span className="step-title">Result</span>
            </li>
          </ul>
          {step === 1 && renderDataStep1()}
          {step === 2 && renderDataStep2()}
          {step === 3 && results && renderDataStep3()}
        </>
      )}

      {importMode === 'documents' && renderDocumentImport()}
    </div>
  );
}

export default BulkImportPage;
