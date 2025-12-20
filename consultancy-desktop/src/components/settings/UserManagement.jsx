import React, { useState, useEffect, useCallback } from 'react';
import { FiUserPlus, FiLock, FiTrash2, FiUsers, FiKey } from 'react-icons/fi';
import toast from 'react-hot-toast';
import ResetPasswordModal from '../modals/ResetPasswordModal';
import ChangePasswordModal from '../modals/ChangePasswordModal';
import PermissionPopup from '../PermissionPopup';
import useAuthStore from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import '../../css/UserManagement.css';

const roleOptions = [
  { value: 'staff', label: '👤 Staff (Data Entry)' },
  { value: 'admin', label: '👨‍💼 Admin (Manager/Delegated)' },
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
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);

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
      toast.error(res.error || '❌ Failed to fetch users');
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
      return toast.error('⚠️ All fields required');
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
      toast.success(`✅ User ${res.data.username} added successfully!`);
    } else {
      toast.error(`❌ ${res.error}`);
    }

    setIsSaving(false);
  };

  const handleDeleteUser = async (userId, username) => {
    if (!isSuperAdmin) {
      toast.error('🚫 Only Super Admin can delete users');
      return;
    }

    const res = await window.electronAPI.deleteUser({
      user: currentUser,
      idToDelete: userId,
    });

    if (res.success) {
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      toast.success(`🗑️ User ${username} deleted successfully`);
      setDeleteConfirmUser(null);
    } else {
      toast.error(`❌ ${res.error}`);
    }
  };

  return (
    <div className="settings-section-card user-management-shell">
      {/* RESET PASSWORD MODAL */}
      {resettingUser && (
        <ResetPasswordModal
          currentUser={currentUser}
          userToReset={resettingUser}
          onClose={() => setResettingUser(null)}
          onPasswordReset={() => setResettingUser(null)}
        />
      )}

      {/* CHANGE PASSWORD MODAL (for current user) */}
      {showChangePasswordModal && (
        <ChangePasswordModal
          user={currentUser}
          onClose={() => setShowChangePasswordModal(false)}
          onPasswordChange={() => {
            setShowChangePasswordModal(false);
            toast.success('✅ Password changed! Please login again');
            setTimeout(() => window.location.reload(), 1500);
          }}
        />
      )}

      {/* PERMISSION POPUP */}
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

      {/* DELETE CONFIRM DIALOG */}
      {deleteConfirmUser && (
        <div className="premium-confirm-overlay">
          <div className="premium-confirm-dialog">
            <div className="confirm-icon">🗑️</div>
            <h3>Delete User</h3>
            <p>
              Are you sure you want to permanently delete{' '}
              <strong>{deleteConfirmUser.username}</strong>?
            </p>
            <p className="confirm-warning">⚠️ This action cannot be undone!</p>
            <div className="confirm-actions">
              <button
                className="btn-cancel"
                onClick={() => setDeleteConfirmUser(null)}
              >
                ❌ Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() =>
                  handleDeleteUser(deleteConfirmUser.id, deleteConfirmUser.username)
                }
              >
                🗑️ Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="user-management-header">
        <div className="user-management-title">
          <span className="user-management-title-emoji">👥</span>
          <span>Users & Roles</span>
        </div>
        <div className="user-management-sub">
          <span>
            <FiUsers />
            Manage who can log in and what they can do
          </span>
          <button
            className="change-password-btn"
            onClick={() => setShowChangePasswordModal(true)}
            title="🔑 Change My Password"
          >
            <FiKey /> 🔑
          </button>
        </div>
      </div>

      {/* ADD USER SECTION */}
      <div className="user-add-section">
        <h2>
          ➕ Add New User
        </h2>

        <form onSubmit={handleSubmit} className="form-grid user-add-form">
          <div className="form-group">
            <label>
              👤 Username <span className="required">*</span>
            </label>
            <input
              name="username"
              value={form.username}
              onChange={handleFormChange}
              disabled={!isSuperAdmin}
              placeholder="Enter username"
            />
          </div>
          <div className="form-group">
            <label>
              🔒 Password <span className="required">*</span>
            </label>
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
            <label>
              🎭 Role <span className="required">*</span>
            </label>
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
              <FiUserPlus /> {isSaving ? '⏳ Adding…' : '✅ Add User'}
            </button>
          </div>
        </form>
      </div>

      {/* EXISTING USERS LIST */}
      <div className="user-list-section">
        <h3>📋 Existing Users ({users.length})</h3>
        {loading ? (
          <div className="user-empty-state">⏳ Loading users...</div>
        ) : users.length === 0 ? (
          <div className="user-empty-state">
            📭 No users created yet. Add a new user above.
          </div>
        ) : (
          <div className="user-row-3cols">
            {users.map((user) => (
              <div key={user.id} className="user-chip">
                <div className="user-chip-main">
                  <div className="user-avatar-pill">
                    {user.username?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="user-chip-text">
                    <div className="user-name-row">
                      <strong>{user.username}</strong>
                    </div>
                    <span className="user-role-pill">
                      {user.role === 'admin'
                        ? '👨‍💼 ADMIN'
                        : user.role === 'staff'
                        ? '👤 STAFF'
                        : user.role.replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="user-chip-actions">
                  {/* PERMISSION BUTTON */}
                  {(isSuperAdmin || isAdmin) &&
                    user.role !== 'super_admin' &&
                    (isSuperAdmin || (isAdmin && user.role === 'staff')) && (
                      <button
                        className="doc-btn view"
                        onClick={() => setPermissionTarget(user)}
                        title="🔑 Set Permissions"
                      >
                        🔐
                      </button>
                    )}

                  {/* RESET PASSWORD BUTTON */}
                  <button
                    className="doc-btn view"
                    onClick={() => setResettingUser(user)}
                    title="🔒 Reset Password"
                    disabled={!isSuperAdmin}
                  >
                    <FiLock />
                  </button>

                  {/* DELETE BUTTON */}
                  <button
                    className="doc-btn delete"
                    onClick={() => setDeleteConfirmUser(user)}
                    title="🗑️ Delete User"
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
