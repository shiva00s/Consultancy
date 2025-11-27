import React, { useState } from 'react';
import { FiUserPlus, FiArrowLeft } from 'react-icons/fi';
import { useNavigate, Link } from 'react-router-dom';
import '../css/LoginPage.css'; // We can reuse the login page CSS


function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('staff'); // Default to 'staff'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    if (!username || !password) {
      setError('Please enter both username and password.');
      setLoading(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.registerNewUser({ username, password, role });
      if (result.success) {
        setSuccess(`User ${result.data.username} created! Redirecting to login...`);
        setUsername('');
        setPassword('');
        
        // --- THIS IS THE FIX ---
        // Wait 2 seconds, then navigate to login
        setTimeout(() => {
          navigate('/login');
        }, 2000);
        
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError(`An error occurred: ${err.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <FiUserPlus className="login-logo" />
        <h2>Register New User</h2>
        
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
            <label>Password (min 6 chars)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={loading}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          
          {error && <p className="login-error">{error}</p>}
          {success && <p className="form-message success" style={{textAlign: 'center'}}>{success}</p>}
          
          <button type="submit" className="btn btn-full-width" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <Link to="/login" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
          <FiArrowLeft style={{ marginRight: '5px' }} /> Back to Login
        </Link>
      </div>
    </div>
  );
}

export default RegisterPage;