import React, { useState, useEffect, useCallback } from 'react'; 
import { FiUserPlus, FiLock, FiTrash2, FiUsers, FiShield } from 'react-icons/fi'; 
import toast from 'react-hot-toast';
import ResetPasswordModal from '../modals/ResetPasswordModal'; 
import DelegationModal from '../settings/DelegationModal'; // <--- CRITICAL FIX: CORRECTED PATH
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

const roleOptions = [
  { value: 'staff', label: 'Staff (Data Entry)' },
  { value: 'admin', label: 'Admin (Manager/Delegated)' },
  { value: 'super_admin', label: 'Super Admin (System Owner)' },
];

const initialUserForm = { username: '', password: '', role: 'staff' };

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialUserForm);
  const [isSaving, setIsSaving] = useState(false);
  const [resettingUser, setResettingUser] = useState(null); 
  const [delegatingUser, setDelegatingUser] = useState(null); 

  // Retrieve current feature flags for the Admin ceiling check
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
          (isSuperAdmin || u.role === 'staff')
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
    if (!form.username || !form.password) return toast.error('Fields required');
    
    setIsSaving(true);
    const res = await window.electronAPI.addUser({ 
      user: currentUser, ...form
    });

    if (res.success) {
      setUsers(prev => [...prev, res.data]);
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
        {delegatingUser && ( 
            <DelegationModal
                managerFlags={featureFlags} 
                targetUser={delegatingUser}
                onClose={() => setDelegatingUser(null)}
            />
        )}
        
        <div style={{marginBottom: '1.5rem', paddingBottom:'1rem', borderBottom:'1px solid var(--border-color)'}}>
            <h2><FiUsers /> Add New User</h2>
           {/* Fixed Alignment Form */}
            <form onSubmit={handleSubmit} className="form-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', // Responsive columns
                gap: '20px', 
                alignItems: 'end' // Align everything to bottom
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
                
                {/* Button Container with Invisible Label for Perfect Alignment */}
                <div className="form-group" style={{marginBottom:0}}>
                    <label style={{opacity: 0}}>Action</label> {/* Spacer forces alignment */}
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
                        {user.role === 'staff' && isManager && ( // Admin/SA can delegate to Staff
                            <button
                                className="doc-btn view"
                                onClick={() => setDelegatingUser(user)}
                                title="Delegate Staff Permissions"
                            >
                                <FiShield />
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