// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './css/App.css';
import { Toaster } from 'react-hot-toast';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <App />
      <Toaster
        position="top-center"
        reverseOrder={false}
        gutter={8}
        containerStyle={{
          bottom: 40,
        }}
        toastOptions={{
          duration: 3000,
          style: {
            background: 'var(--bg-card)',
            color: 'var(--text)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '16px',
            fontSize: '0.95rem',
            fontWeight: '500',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            maxWidth: '400px',
          },
          success: {
            duration: 3000,
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text)',
              border: '2px solid var(--success-color)',
            },
            iconTheme: {
              primary: 'var(--success-color)',
              secondary: '#fff',
            },
          },
          error: {
            duration: 4000,
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text)',
              border: '2px solid var(--danger-color)',
            },
            iconTheme: {
              primary: 'var(--danger-color)',
              secondary: '#fff',
            },
          },
          loading: {
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text)',
              border: '2px solid var(--primary-color)',
            },
            iconTheme: {
              primary: 'var(--primary-color)',
              secondary: '#fff',
            },
          },
        }}
      />
    </HashRouter>
  </React.StrictMode>
);
