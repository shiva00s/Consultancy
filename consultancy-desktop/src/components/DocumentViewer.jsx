import React, { useState, useEffect, useMemo } from "react";
import "../css/DocumentViewer.css";
import { FiX, FiLoader } from "react-icons/fi";

function DocumentViewer({ doc, onClose }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fileType = doc.fileType || "";
  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf";

  const mimeForIframe = useMemo(() => {
    if (isPdf) return "application/pdf";
    if (isImage) return fileType;
    return "application/octet-stream";
  }, [isPdf, isImage, fileType]);

  useEffect(() => {
    let cancelled = false;

    const loadDocument = async () => {
      setLoading(true);
      setError(null);
      setDataUrl(null);

      try {
        const result = await window.electronAPI.getDocumentBase64({
          filePath: doc.filePath,
        });

        if (!result.success) {
          throw new Error(result.error || "Failed to load document.");
        }

        if (cancelled) return;

        const raw = result.data || "";
        const hasPrefix = raw.startsWith("data:");

        const finalUrl = hasPrefix
          ? raw
          : `data:${mimeForIframe};base64,${raw}`;

        setDataUrl(finalUrl);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Error loading document.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadDocument();
    return () => {
      cancelled = true;
    };
  }, [doc.filePath, mimeForIframe]);

  const emoji = isImage ? "🖼️" : isPdf ? "📄" : "📎";

  return (
    <div className="dv-backdrop">
      <div className="dv-shell">
        <button className="dv-close" onClick={onClose} title="Close Preview">
          <FiX />
        </button>

        <header className="dv-header">
          <div className="dv-title-block">
            <span className="dv-emoji">{emoji}</span>
            <div className="dv-title-text">
              <h3 title={doc.fileName || doc.filePath}>
                📄 {doc.fileName || "Document Preview"}
              </h3>
              <p className="dv-subtitle">
                📋 {fileType || "Unknown type"}
              </p>
            </div>
          </div>
        </header>

        <main className="dv-body">
          {loading && (
            <div className="dv-state dv-loading">
              <FiLoader className="dv-spinner" />
              <span>⏳ Loading your document…</span>
            </div>
          )}

          {!loading && error && (
            <div className="dv-state dv-error">
              <span>⚠️ Could not open this file.</span>
              <small>❌ {error}</small>
            </div>
          )}

          {!loading && !error && dataUrl && (
            <>
              {isImage && (
                <img
                  src={dataUrl}
                  alt={doc.fileName || "Document"}
                  className="dv-media"
                />
              )}

              {isPdf && (
                <iframe
                  src={dataUrl}
                  title={doc.fileName || "PDF Preview"}
                  className="dv-frame"
                />
              )}

              {!isImage && !isPdf && (
                <iframe
                  src={dataUrl}
                  title={doc.fileName || "Document Preview"}
                  className="dv-frame"
                />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default DocumentViewer;
