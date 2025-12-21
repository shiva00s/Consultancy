import React, { useEffect, useState } from 'react';
import './UploadProgress.css';

function formatPercent(transferred, total) {
  if (!total) return '0%';
  return `${Math.round((transferred / total) * 100)}%`;
}

export default function UploadProgress() {
  const [uploads, setUploads] = useState({});

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.onUploadProgress) return;

    const unsubscribe = window.electronAPI.onUploadProgress((payload) => {
      const { uploadId, transferred = 0, total = 0, status, data, error } = payload || {};
      setUploads((prev) => {
        const next = { ...prev };
        const now = Date.now();

        if (!next[uploadId]) next[uploadId] = { transferred: 0, total: total || 0, status: 'progress', startedAt: now };

        if (status === 'progress') {
          next[uploadId] = { ...next[uploadId], transferred, total };
        } else if (status === 'done' || status === 'completed') {
          next[uploadId] = { ...next[uploadId], transferred: total || transferred, total, status: 'completed', finishedAt: now, data };
          // schedule removal
          setTimeout(() => {
            setUploads((p) => {
              const c = { ...p };
              delete c[uploadId];
              return c;
            });
          }, 2500);
        } else if (status === 'error') {
          next[uploadId] = { ...next[uploadId], status: 'error', error };
          setTimeout(() => {
            setUploads((p) => {
              const c = { ...p };
              delete c[uploadId];
              return c;
            });
          }, 5000);
        }

        return next;
      });
    });

    return () => unsubscribe && unsubscribe();
  }, []);

  const keys = Object.keys(uploads);
  if (!keys.length) return null;

  return (
    <div className="upload-progress-root" aria-live="polite">
      {keys.map((id) => {
        const u = uploads[id];
        const percent = u.total ? Math.round((u.transferred / u.total) * 100) : 0;
        return (
          <div key={id} className="upload-item">
            <div className="upload-item-title">Uploading… {u.data?.fileName || id}</div>
            <div className="upload-bar">
              <div className="upload-bar-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="upload-meta">{formatPercent(u.transferred, u.total)} {u.status === 'error' ? ` • Error: ${u.error}` : ''}</div>
          </div>
        );
      })}
    </div>
  );
}
