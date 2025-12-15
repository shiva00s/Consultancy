import React, { useState, useEffect, useCallback } from 'react'; 
import { FiUserPlus, FiLock, FiTrash2, FiUsers, FiShield } from 'react-icons/fi'; 
import toast from 'react-hot-toast';
import ResetPasswordModal from '../modals/ResetPasswordModal'; 
import PermissionPopup from '../PermissionPopup'; // NEW IMPORT
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

const roleOptions = [
  { value: 'staff', label: 'Staff (Data Entry)' },
  { value: 'admin', label: 'Admin (Manager/Delegated)' },
  //{ value: 'super_admin', label: 'Super Admin (System Owner)' },
];

const initialUserForm = { username: '', password: '', role: 'staff' };

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialUserForm);
  const [isSaving, setIsSaving] = useState(false);
  const [resettingUser, setResettingUser] = useState(null); 
  const [permissionTarget, setPermissionTarget] = useState(null); // NEW STATE

  const { featureFlags } = useAuthStore(
    useShallow(state => ({ featureFlags: state.featureFlags }))
  );

  const isSuperAdmin = currentUser && currentUser.role === 'super_admin';
  const isAdmin = currentUser && currentUser.role === 'admin'; 
  const isManager = isSuperAdmin || isAdmin; 

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllUsers(); 
    if (res.success) {
      // Filter out the current user and filter users Admin is allowed to manage (only Staff)
      const filteredUsers = res.data.filter(u => 
        u.id !== currentUser.id && 
        (isSuperAdmin || u.role === 'staff' || u.role === 'admin')
      );
      setUsers(filteredUsers);
    } else {
      toast.error(res.error || 'Failed to fetch users.');
    }
    setLoading(false); 
  }, [currentUser.id, isSuperAdmin]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleFormChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
  e.preventDefault();
  
  if (!form.username || !form.password) {
    return toast.error('Fields required');
  }

  setIsSaving(true);
  
  // ✅ Pass complete user object
  const res = await window.electronAPI.addUser({
    user: {
      id: currentUser.id,
      username: currentUser.username,
      role: currentUser.role // Make sure this matches DB format
    },
    username: form.username,
    password: form.password,
    role: form.role
  });

  if (res.success) {
    setUsers((prev) => [...prev, res.data]);
    setForm(initialUserForm);
    toast.success(`User ${res.data.username} added!`);
  } else {
    toast.error(res.error);
  }
  
  setIsSaving(false);
};


  const handleDeleteUser = async (userId, username) => {
    if (!isSuperAdmin) {
      toast.error("Only Super Admin can delete users.");
      return;
    }
    if (!window.confirm(`Permanently delete user: ${username}?`)) return;
    const res = await window.electronAPI.deleteUser({user: currentUser, idToDelete: userId });
    if (res.success) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success('User deleted.');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="settings-section-card">
      {resettingUser && (
        <ResetPasswordModal 
          currentUser={currentUser}
          userToReset={resettingUser}
          onClose={() => setResettingUser(null)}
          onPasswordReset={() => setResettingUser(null)}
        />
      )}
      
      {/* NEW: Permission Popup */}
      {permissionTarget && (
        <PermissionPopup
          user={currentUser}
          targetUser={permissionTarget}
          onClose={() => setPermissionTarget(null)}
          onSave={() => {
            setPermissionTarget(null);
            fetchUsers(); // Refresh if needed
          }}
        />
      )}
      
      <div style={{marginBottom: '1.5rem', paddingBottom:'1rem', borderBottom:'1px solid var(--border-color)'}}>
        <h2><FiUsers /> Add New User</h2>
        {/* Fixed Alignment Form */}
        <form onSubmit={handleSubmit} className="form-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px', 
          alignItems: 'end'
        }}>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Username</label>
            <input name="username" value={form.username} onChange={handleFormChange} disabled={!isSuperAdmin} placeholder="Enter username" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Password</label>
            <input type="password" name="password" value={form.password} onChange={handleFormChange} disabled={!isSuperAdmin} placeholder="Enter password" />
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label>Role</label>
            <select name="role" value={form.role} onChange={handleFormChange} disabled={!isSuperAdmin}>
              {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          
          <div className="form-group" style={{marginBottom:0}}>
            <label style={{opacity: 0}}>Action</label>
            <button type="submit" className="btn btn-primary btn-full-width" disabled={!isSuperAdmin || isSaving}>
              <FiUserPlus /> Add User
            </button>
          </div>
        </form>
      </div>

      {/* Existing Users List */}
      <div className="user-list-section">
        <h3>Existing Users ({users.length})</h3>
        {loading ? <p>Loading...</p> : (
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
                  {/* NEW: Permission Icon - Show for Admin and Staff */}
                  {(isSuperAdmin || isAdmin) && user.role !== 'super_admin' && (
                    <>
                      {/* Super Admin can set for Admin and Staff */}
                      {/* Admin can only set for Staff */}
                      {(isSuperAdmin || (isAdmin && user.role === 'staff')) && (
                        <button
                          className="doc-btn view"
                          onClick={() => setPermissionTarget(user)}
                          title="Set Permissions"
                          style={{fontSize: '1.2rem'}}
                        >
                          🔐
                        </button>
                      )}
                    </>
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
