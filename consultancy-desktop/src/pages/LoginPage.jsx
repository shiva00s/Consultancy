import React, { useState } from 'react';
import { FiBriefcase } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/useAuthStore';
import toast from 'react-hot-toast';
import '../css/LoginPage.css';

function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!username || !password) {
      toast.error('Please enter both username and password.');
      setLoading(false);
      return;
    }

    try {
      const result = await window.electronAPI.invoke('login', { username, password });
      
      if (result.success) {
        // Create complete user object
        const userData = {
          id: result.id,
          username: result.username,
          role: result.role,
          permissions: result.permissions || {},
          adminId: result.adminId || null,
        };

        // Call the Zustand store login method
        await login(userData, null);
        
        toast.success(`Welcome back, ${result.username}!`);
        navigate('/');
      } else {
        toast.error(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
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
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          <button type="submit" className="btn btn-full-width" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
