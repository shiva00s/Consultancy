import React, { useState } from 'react';
import { FiBriefcase } from 'react-icons/fi';
/* import { Link } from 'react-router-dom';  */
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

    if (!username || !password) {
      setError('Please enter both username and password.');
      setLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.login({ username, password });
      if (result.success) {
       onLogin({ id: result.id, username: result.username, role: result.role });
      } else {
        setError(result.error || 'Login failed');
      }
    } catch {
      setError('An error occurred. Please try again.');
    }
    setLoading(false);
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
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn btn-full-width" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        {/* <Link to="/register" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
          Register a New User
        </Link> */}
        
        
      </div>
    </div>
  );
}

export default LoginPage;