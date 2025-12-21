import React, { useEffect, useRef, useState } from 'react';

// Simple module-level cache and in-flight map to avoid duplicate requests
const imageCache = new Map();
const fetchPromises = new Map();

export default function LazyRemoteImage({ filePath, placeholder = null, className = '', onLoad }) {
  const [src, setSrc] = useState(() => (filePath && imageCache.has(filePath) ? imageCache.get(filePath) : null));
  const [loading, setLoading] = useState(false);
  const elRef = useRef(null);

  useEffect(() => {
    setSrc(filePath && imageCache.has(filePath) ? imageCache.get(filePath) : null);
  }, [filePath]);

  useEffect(() => {
    if (!filePath) return undefined;
    if (src) return undefined; // already have it

    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        let promise = fetchPromises.get(filePath);
        if (!promise) {
          promise = window.electronAPI.getImageBase64({ filePath }).then((res) => (res.success ? res.data : null));
          fetchPromises.set(filePath, promise);
        }

        const data = await promise;
        fetchPromises.delete(filePath);
        if (data && !cancelled) {
          imageCache.set(filePath, data);
          setSrc(data);
          if (onLoad) onLoad(data);
        }
      } catch (err) {
        // ignore errors silently; leave placeholder
        // console.error('LazyRemoteImage error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    // If element already visible, load immediately
    const node = elRef.current;
    if (node && typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            io.disconnect();
            load();
          }
        });
      });
      io.observe(node);

      return () => {
        cancelled = true;
        io.disconnect();
      };
    }

    // Fallback: load immediately
    load();

    return () => {
      cancelled = true;
    };
  }, [filePath, src, onLoad]);

  return (
    <div
      ref={elRef}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {src ? (
        // src is expected to be a data URL already
        <img src={src} alt="profile" className={className} style={{ width: '100%', height: '100%' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {placeholder || null}
        </div>
      )}
    </div>
  );
}
