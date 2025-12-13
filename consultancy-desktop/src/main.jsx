import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './css/App.css';
import { Toaster } from 'react-hot-toast'; 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            // 🐞 FIX: Use theme variables for background and text
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
          },
          success: {
            iconTheme: {
              primary: 'var(--success-color)',
              secondary: 'var(--text-on-primary)',
            },
          },
          error: {
            iconTheme: {
              primary: 'var(--danger-color)',
              secondary: 'var(--text-on-primary)',
            },
          },
        }}
      />
    </HashRouter>
  </React.StrictMode>
);