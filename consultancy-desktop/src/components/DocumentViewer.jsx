import React, { useState, useEffect } from 'react';
import '../css/DocumentViewer.css';
import { FiX, FiLoader } from 'react-icons/fi';

function DocumentViewer({ doc, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      const result = await window.electronAPI.getDocumentBase64({
        filePath: doc.filePath,
      });
      if (result.success) {
        setContent(result.data);
      } else {
        setError(result.error);
      }
      setLoading(false);
    };

    loadDocument();
  }, [doc]);

  const isPdf = doc.fileType === 'application/pdf';
  const isImage = doc.fileType && doc.fileType.startsWith('image/');

  return (
    <div className="viewer-modal-backdrop" onClick={onClose}>
      <div className="viewer-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="viewer-close-btn" onClick={onClose}>
          <FiX />
        </button>
        <div className="viewer-header">
          <h3>{doc.fileName}</h3>
        </div>
        <div className="viewer-body">
          {loading && (
            <div className="viewer-loading">
              <FiLoader className="spinner" />
              <p>Loading document...</p>
            </div>
          )}
          {error && <p className="viewer-error">Error: {error}</p>}
          {!loading && !error && (
            <>
              {isPdf && (
                <object
                  data={content}
                  type="application/pdf"
                  width="100%"
                  height="100%"
                >
                  <p>
                    It appears you don't have a PDF plugin for this browser.
                    You can{' '}
                    <a href={content} download={doc.fileName}>
                      download the PDF
                    </a>{' '}
                    instead.
                  </p>
                </object>
              )}
              {isImage && <img src={content} alt={doc.fileName} />}
              {!isPdf && !isImage && (
                <p>
                  In-app preview is not available for this file type (
                  {doc.fileType}).
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentViewer;