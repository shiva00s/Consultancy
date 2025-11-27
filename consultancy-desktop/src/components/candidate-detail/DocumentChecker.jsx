import React, { useState, useEffect, useCallback } from 'react';
import { FiAlertTriangle, FiCheckCircle, FiBookOpen } from 'react-icons/fi';
import toast from 'react-hot-toast';

function DocumentChecker({ candidateDocuments }) {
  const [requiredDocs, setRequiredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [missingDocs, setMissingDocs] = useState([]);
  const [uploadedCategories, setUploadedCategories] = useState(new Set());

  // 1. Fetch the master list of required documents
  const fetchRequiredDocs = useCallback(async () => {
    const res = await window.electronAPI.getRequiredDocuments();
    if (res.success) {
      setRequiredDocs(res.data.map(doc => doc.name));
    } else {
      toast.error(res.error || 'Failed to fetch required documents list.');
      setRequiredDocs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRequiredDocs();
  }, [fetchRequiredDocs]);

  // 2. Perform the document check whenever the candidate's documents change
  useEffect(() => {
    if (loading || requiredDocs.length === 0) return;

    // Create a Set of categories already uploaded by the candidate
    const uploaded = new Set(candidateDocuments.map(doc => doc.category));
    setUploadedCategories(uploaded);

    // Filter the master list to find missing documents
    const missing = requiredDocs.filter(docName => !uploaded.has(docName));
    setMissingDocs(missing);
  }, [requiredDocs, candidateDocuments, loading]);
  
  if (loading) return <p>Checking document status...</p>;
  if (requiredDocs.length === 0) return (
    <div className="form-message neutral" style={{marginTop: '1.25rem'}}>
      <FiBookOpen /> No required documents are configured by the administrator.
    </div>
  );

  return (
    <div className="module-form-card" style={{marginTop: '1.25rem'}}>
        <h3><FiAlertTriangle /> Document Status Check</h3>
        {missingDocs.length === 0 ? (
            <div className="form-message success">
                <FiCheckCircle /> All {requiredDocs.length} required documents have been uploaded!
            </div>
        ) : (
            <>
                <div className="form-message error">
                    <FiAlertTriangle /> {missingDocs.length} mandatory document(s) are **MISSING**!
                </div>
                <h4>Missing Mandatory Documents:</h4>
                <ul className="doc-missing-list">
                    {missingDocs.map((doc, index) => (
                        <li key={index} style={{color: 'var(--danger-color)', fontWeight: 600}}>
                            - {doc}
                        </li>
                    ))}
                </ul>
            </>
        )}
        <h4 style={{marginTop: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '5px'}}>
            Uploaded Categories:
        </h4>
        <p style={{color: 'var(--text-secondary)', fontSize: '0.9rem'}}>
            {Array.from(uploadedCategories).length > 0
                ? Array.from(uploadedCategories).join(' | ')
                : 'No documents uploaded yet.'}
        </p>
    </div>
  );
}

export default DocumentChecker;