import React, { useState, useEffect, useCallback } from 'react'; 
import { FiUserPlus, FiLock, FiTrash2, FiUsers } from 'react-icons/fi'; 
import toast from 'react-hot-toast';
import ResetPasswordModal from '../modals/ResetPasswordModal'; 
import PermissionPopup from '../PermissionPopup';

// ✅ Normalize role - handles "super_admin", "Super Admin", "SUPER_ADMIN", etc.
const normalizeRole = (role) => {
  return String(role || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[()_-]/g, '')
    .trim();
};

const roleOptions = [
  { value: 'staff', label: 'Staff (Data Entry)' },
  { value: 'admin', label: 'Admin (Manager/Delegated)' },
];

const initialUserForm = { username: '', password: '', role: 'staff' };

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialUserForm);
  const [isSaving, setIsSaving] = useState(false);
  const [resettingUser, setResettingUser] = useState(null); 
  const [permissionTarget, setPermissionTarget] = useState(null);

  // ✅ Check if user is super admin
  const isSuperAdmin = normalizeRole(currentUser?.role) === 'superadmin';
  const isAdmin = normalizeRole(currentUser?.role) === 'admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllUsers(); 
    if (res.success) {
      const filteredUsers = res.data.filter(u => u.id !== currentUser.id);
      setUsers(filteredUsers);
    } else {
      toast.error(res.error || 'Failed to fetch users.');
    }
    setLoading(false); 
  }, [currentUser.id]);

  useEffect(() => { 
    fetchUsers(); 
  }, [fetchUsers]);

  const handleFormChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isSuperAdmin) {
      toast.error('Only Super Admin can add users');
      return;
    }
    
    if (!form.username?.trim() || !form.password) {
      return toast.error('Username and password are required');
    }

    if (form.password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }

    setIsSaving(true);
    
    try {
      const res = await window.electronAPI.addUser({
        user: {
          id: currentUser.id,
          username: currentUser.username,
          role: currentUser.role // Pass original DB format
        },
        username: form.username.trim(),
        password: form.password,
        role: form.role
      });

      if (res.success) {
        await fetchUsers();
        setForm(initialUserForm);
        toast.success(`User "${form.username}" created successfully!`);
      } else {
        toast.error(res.error || 'Failed to create user');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete users.");
      return;
    }
    
    if (!window.confirm(`⚠️ Permanently delete user: ${username}?\n\nThis action cannot be undone.`)) {
      return;
    }
    
    const res = await window.electronAPI.deleteUser({
      user: currentUser, 
      idToDelete: userId 
    });
    
    if (res.success) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted successfully.');
    } else {
      toast.error(res.error || 'Failed to delete user');
    }
  };

  return (
    <div className="settings-section-card">
      {resettingUser && (
        <ResetPasswordModal 
          currentUser={currentUser}
          userToReset={resettingUser}
          onClose={() => setResettingUser(null)}
          onPasswordReset={() => {
            setResettingUser(null);
            toast.success('Password reset successfully');
          }}
        />
      )}
      
      {permissionTarget && (
        <PermissionPopup
          user={currentUser}
          targetUser={permissionTarget}
          onClose={() => setPermissionTarget(null)}
          onSave={() => {
            setPermissionTarget(null);
            fetchUsers();
          }}
        />
      )}
      
      <div style={{marginBottom: '1.5rem', paddingBottom:'1rem', borderBottom:'1px solid var(--border-color)'}}>
        <h2><FiUsers /> Add New User</h2>
        
        {!isSuperAdmin && (
          <div style={{
            padding: '10px 15px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '6px',
            marginBottom: '15px',
            fontSize: '13px',
            color: '#ef4444'
          }}>
            ⚠️ Only Super Admin can add users
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="form-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px', 
          alignItems: 'end'
        }}>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Username</label>
            <input 
              name="username" 
              value={form.username} 
              onChange={handleFormChange} 
              disabled={!isSuperAdmin} 
              placeholder="Enter username"
              autoComplete="off"
            />
          </div>
          
          <div className="form-group" style={{marginBottom:0}}>
            <label>Password</label>
            <input 
              type="password" 
              name="password" 
              value={form.password} 
              onChange={handleFormChange} 
              disabled={!isSuperAdmin} 
              placeholder="Min 6 characters"
              autoComplete="new-password"
            />
          </div>
          
          <div className="form-group" style={{marginBottom:0}}>
            <label>Role</label>
            <select 
              name="role" 
              value={form.role} 
              onChange={handleFormChange} 
              disabled={!isSuperAdmin}
            >
              {roleOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className="form-group" style={{marginBottom:0}}>
            <label style={{opacity: 0}}>Action</label>
            <button 
              type="submit" 
              className="btn btn-primary btn-full-width" 
              disabled={!isSuperAdmin || isSaving}
            >
              <FiUserPlus /> {isSaving ? 'Adding...' : 'Add User'}
            </button>
          </div>
        </form>
      </div>

      <div className="user-list-section">
        <h3>Existing Users ({users.length})</h3>
        {loading ? (
          <p style={{textAlign: 'center', padding: '20px'}}>Loading...</p>
        ) : (
          <ul className="user-list">
            {users.map(user => (
              <li key={user.id} className="user-item">
                <div className="user-item-info">
                  <strong>{user.username}</strong>
                  <span className="badge neutral" style={{marginLeft: '10px', textTransform: 'uppercase', fontSize:'0.7rem'}}>
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
                
                <div className="user-item-actions">
                  {isSuperAdmin && normalizeRole(user.role) !== 'superadmin' && (
                    <button
                      className="doc-btn view"
                      onClick={() => setPermissionTarget(user)}
                      title="Set Permissions"
                      style={{fontSize: '1.2rem'}}
                    >
                      🔐
                    </button>
                  )}
                  
                  <button
                    className="doc-btn view"
                    onClick={() => setResettingUser(user)}
                    title="Reset Password"
                    disabled={!isSuperAdmin}
                  >
                    <FiLock />
                  </button>
                  
                  <button
                    className="doc-btn delete"
                    onClick={() => handleDeleteUser(user.id, user.username)}
                    title="Delete User"
                    disabled={!isSuperAdmin}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default UserManagement;
