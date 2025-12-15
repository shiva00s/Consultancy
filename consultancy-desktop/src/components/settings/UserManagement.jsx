import React, { useState, useEffect, useCallback } from 'react';
import { FiUserPlus, FiLock, FiTrash2, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ResetPasswordModal from '../modals/ResetPasswordModal';
import PermissionPopup from '../PermissionPopup';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../../css/UserManagement.css';

const roleOptions = [
  { value: 'staff', label: 'Staff (Data Entry)' },
  { value: 'admin', label: 'Admin (Manager/Delegated)' },
  // { value: 'super_admin', label: 'Super Admin (System Owner)' },
];

const initialUserForm = { username: '', password: '', role: 'staff' };

function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(initialUserForm);
  const [isSaving, setIsSaving] = useState(false);
  const [resettingUser, setResettingUser] = useState(null);
  const [permissionTarget, setPermissionTarget] = useState(null);

  const { featureFlags } = useAuthStore(
    useShallow((state) => ({ featureFlags: state.featureFlags }))
  );

  const isSuperAdmin = currentUser && currentUser.role === 'super_admin';
  const isAdmin = currentUser && currentUser.role === 'admin';
  const isManager = isSuperAdmin || isAdmin;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const res = await window.electronAPI.getAllUsers();
    if (res.success) {
      const filteredUsers = res.data.filter(
        (u) =>
          u.id !== currentUser.id &&
          (isSuperAdmin || u.role === 'staff' || u.role === 'admin')
      );
      setUsers(filteredUsers);
    } else {
      toast.error(res.error || 'Failed to fetch users.');
    }
    setLoading(false);
  }, [currentUser.id, isSuperAdmin]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleFormChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.username || !form.password) {
      return toast.error('Fields required');
    }

    setIsSaving(true);

    const res = await window.electronAPI.addUser({
      user: {
        id: currentUser.id,
        username: currentUser.username,
        role: currentUser.role,
      },
      username: form.username,
      password: form.password,
      role: form.role,
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
      toast.error('Only Super Admin can delete users.');
      return;
    }
    if (!window.confirm(`Permanently delete user: ${username}?`)) return;
    const res = await window.electronAPI.deleteUser({
      user: currentUser,
      idToDelete: userId,
    });
    if (res.success) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success('User deleted.');
    } else {
      toast.error(res.error);
    }
  };

  return (
    <div className="settings-section-card user-management-shell">
      {resettingUser && (
        <ResetPasswordModal
          currentUser={currentUser}
          userToReset={resettingUser}
          onClose={() => setResettingUser(null)}
          onPasswordReset={() => setResettingUser(null)}
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

      <div className="user-management-header">
        <div className="user-management-title">
          <span className="user-management-title-emoji">👥</span>
          <span>Users & Roles</span>
        </div>
        <div className="user-management-sub">
          <FiUsers />
          <span>Manage who can log in and what they can do.</span>
        </div>
      </div>

      <div className="user-add-section">
        <h2>
          <FiUsers /> Add New User
        </h2>

        <form
          onSubmit={handleSubmit}
          className="form-grid user-add-form"
        >
          <div className="form-group">
            <label>Username</label>
            <input
              name="username"
              value={form.username}
              onChange={handleFormChange}
              disabled={!isSuperAdmin}
              placeholder="Enter username"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleFormChange}
              disabled={!isSuperAdmin}
              placeholder="Enter password"
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              name="role"
              value={form.role}
              onChange={handleFormChange}
              disabled={!isSuperAdmin}
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group user-add-button-cell">
            <label className="visually-hidden">Action</label>
            <button
              type="submit"
              className="btn btn-primary btn-full-width"
              disabled={!isSuperAdmin || isSaving}
            >
              <FiUserPlus /> {isSaving ? 'Adding…' : 'Add User'}
            </button>
          </div>
        </form>
      </div>

      {/* Existing Users – single row, 3 columns of chips */}
      <div className="user-list-section">
        <h3>Existing Users ({users.length})</h3>
        {loading ? (
          <p>Loading...</p>
        ) : users.length === 0 ? (
          <div className="user-empty-state">
            No users created yet.
          </div>
        ) : (
          <div className="user-row-3cols">
            {users.slice(0, 3).map((user) => (
              <div key={user.id} className="user-chip">
                <div className="user-chip-main">
                  <div className="user-avatar-pill">
                    {user.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div className="user-chip-text">
                    <div className="user-name-row">
                      {user.username}
                    </div>
                    <span className="user-role-pill">
                      {user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="user-chip-actions">
                  {(isSuperAdmin || isAdmin) &&
                    user.role !== 'super_admin' &&
                    (isSuperAdmin ||
                      (isAdmin && user.role === 'staff')) && (
                      <button
                        className="doc-btn view"
                        onClick={() => setPermissionTarget(user)}
                        title="Set Permissions"
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
                    onClick={() =>
                      handleDeleteUser(user.id, user.username)
                    }
                    title="Delete User"
                    disabled={!isSuperAdmin}
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default UserManagement;
