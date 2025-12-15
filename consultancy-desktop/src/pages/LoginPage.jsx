// FILE: src/pages/LoginPage.jsx
// ✅ UPDATED: Stores user correctly in auth store

import React, { useState } from 'react';
import { FiBriefcase } from 'react-icons/fi';
import '../css/LoginPage.css';

function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!username?.trim() || !password) {
      setError('Please enter both username and password.');
      setLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.login({ 
        username: username.trim(), 
        password 
      });
      
      if (result.success) {
        // ✅ Pass complete user object with original role format from DB
        onLogin({ 
          id: result.id, 
          username: result.username, 
          role: result.role // Keep original format (e.g., "super_admin", "admin", "staff")
        });
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ⚠️ DEVELOPMENT ONLY - Hidden reset function
  const handleResetActivation = async () => {
    if (!window.confirm('⚠️ Reset activation status? This will reload the app.')) {
      return;
    }
    
    try {
      const result = await window.electronAPI.resetActivationStatus();
      if (result?.success) {
        alert('✅ Activation reset! Reloading...');
        window.location.reload();
      } else {
        alert('❌ Reset failed: ' + (result?.error || 'Unknown error'));
      }
    } catch (err) {
      alert('❌ Error: ' + err.message);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <FiBriefcase className="login-logo" />
        <h2>Consultancy App Login</h2>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="Enter your username"
              autoComplete="username"
              autoFocus
            />
          </div>
          
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>
          
          {error && <p className="login-error">{error}</p>}
          
          <button type="submit" className="btn btn-full-width" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        {/* ⚠️ DEVELOPMENT ONLY - HIDDEN RESET BUTTON */}
        {process.env.NODE_ENV === 'development' && (
          <button
            onClick={handleResetActivation}
            style={{
              position: 'fixed',
              bottom: 10,
              right: 10,
              opacity: 0.3,
              fontSize: 10,
              padding: '5px 10px',
              background: '#334155',
              color: '#94a3b8',
              border: '1px solid #475569',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.opacity = '1'}
            onMouseLeave={(e) => e.target.style.opacity = '0.3'}
            title="Reset activation status (Dev only)"
          >
            🔧 Reset Activation
          </button>
        )}
      </div>
    </div>
  );
}

export default LoginPage;
