import React, { useState, useEffect } from 'react';
import { 
  FiGrid, 
  FiToggleLeft, 
  FiToggleRight, 
  FiUsers, 
  FiSave,
  FiRefreshCw,
  FiAlertCircle,
  FiCheckCircle,
  FiSearch,
  FiFilter,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import Tabs from '../components/Tabs';
import { LoadingSpinner } from '../components/LoadingSpinner';
import usePermissionStore from '../store/usePermissionStore';
import '../css/ModulesPage.css';

function ModulesPage({ user }) {
  const { refreshPermissions } = usePermissionStore();
  
  const [activeTab, setActiveTab] = useState('modules');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modules State
  const [modules, setModules] = useState([]);
  const [moduleChanges, setModuleChanges] = useState({});
  const [moduleFilter, setModuleFilter] = useState('all');
  const [moduleSearch, setModuleSearch] = useState('');
  
  // Users/Permissions State
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [permissionChanges, setPermissionChanges] = useState({});
  const [enabledModules, setEnabledModules] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load based on role
      if (user.role === 'super_admin') {
        await loadAllModules();
      } else if (user.role === 'admin') {
        await loadEnabledModules();
      }
      
      // Load users for permission management
      await loadUsers();
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // SUPERADMIN: Load All Modules
  // ============================================
  const loadAllModules = async () => {
    try {
      const result = await window.electronAPI.getAllModules();
      if (result.success) {
        setModules(result.data);
      } else {
        toast.error('Failed to load modules');
      }
    } catch (error) {
      console.error('Error loading modules:', error);
      toast.error('Error loading modules');
    }
  };

  // ============================================
  // ADMIN: Load Enabled Modules Only
  // ============================================
  const loadEnabledModules = async () => {
    try {
      const result = await window.electronAPI.getEnabledModules();
      if (result.success) {
        setEnabledModules(result.data);
        setModules(result.data);
      } else {
        toast.error('Failed to load modules');
      }
    } catch (error) {
      console.error('Error loading modules:', error);
      toast.error('Error loading modules');
    }
  };

  // ============================================
  // Load Users for Permission Assignment
  // ============================================
  const loadUsers = async () => {
    try {
      const result = await window.electronAPI.getAllUsers();
      if (result.success) {
        // Filter users based on role
        let filteredUsers = result.data;
        
        if (user.role === 'admin') {
          // Admin can only manage staff
          filteredUsers = result.data.filter(u => u.role === 'staff');
        }
        
        setUsers(filteredUsers);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // ============================================
  // Load User Permissions
  // ============================================
  const loadUserPermissions = async (userId) => {
    try {
      const result = await window.electronAPI.getUserPermissions({ userId });
      if (result.success) {
        setUserPermissions(result.data.map(p => p.module_key));
      }
    } catch (error) {
      console.error('Error loading user permissions:', error);
    }
  };

  // ============================================
  // Toggle Module (SuperAdmin Only)
  // ============================================
  const handleModuleToggle = (moduleKey, currentValue) => {
    setModuleChanges(prev => ({
      ...prev,
      [moduleKey]: !currentValue
    }));
  };

  // ============================================
  // Save Module Changes (SuperAdmin Only)
  // ============================================
  const saveModuleChanges = async () => {
    const changes = Object.entries(moduleChanges);
    
    if (changes.length === 0) {
      toast.error('No changes to save');
      return;
    }

    setSaving(true);
    try {
      const updates = changes.map(([moduleKey, isEnabled]) => ({
        moduleKey,
        isEnabled,
      }));

      const result = await window.electronAPI.bulkToggleModules({
        user,
        updates,
      });

      if (result.success) {
        toast.success('Modules updated successfully');
        setModuleChanges({});
        await loadAllModules();
        await refreshPermissions(user);
      } else {
        toast.error(result.error || 'Failed to update modules');
      }
    } catch (error) {
      console.error('Error saving modules:', error);
      toast.error('Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Toggle User Permission
  // ============================================
  const handlePermissionToggle = (moduleKey) => {
    setPermissionChanges(prev => {
      const current = prev[moduleKey] !== undefined 
        ? prev[moduleKey] 
        : userPermissions.includes(moduleKey);
      
      return {
        ...prev,
        [moduleKey]: !current
      };
    });
  };

  // ============================================
  // Save Permission Changes
  // ============================================
  const savePermissionChanges = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    const changes = Object.entries(permissionChanges);
    
    if (changes.length === 0) {
      toast.error('No changes to save');
      return;
    }

    setSaving(true);
    try {
      // Get final list of module keys
      const finalPermissions = modules
        .map(m => m.module_key)
        .filter(key => {
          const hasChange = permissionChanges[key] !== undefined;
          if (hasChange) {
            return permissionChanges[key];
          }
          return userPermissions.includes(key);
        });

      const result = await window.electronAPI.bulkUpdatePermissions({
        user,
        userId: selectedUser.id,
        moduleKeys: finalPermissions,
      });

      if (result.success) {
        toast.success('Permissions updated successfully');
        setPermissionChanges({});
        await loadUserPermissions(selectedUser.id);
      } else {
        toast.error(result.error || 'Failed to update permissions');
      }
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Error saving permissions');
    } finally {
      setSaving(false);
    }
  };

  // ============================================
  // Select User
  // ============================================
  const handleUserSelect = async (selectedUser) => {
    setSelectedUser(selectedUser);
    setPermissionChanges({});
    await loadUserPermissions(selectedUser.id);
  };

  // ============================================
  // Filter Modules
  // ============================================
  const getFilteredModules = () => {
    let filtered = modules;

    // Filter by type
    if (moduleFilter !== 'all') {
      filtered = filtered.filter(m => m.module_type === moduleFilter);
    }

    // Search filter
    if (moduleSearch) {
      const search = moduleSearch.toLowerCase();
      filtered = filtered.filter(m => 
        m.module_name.toLowerCase().includes(search) ||
        m.module_key.toLowerCase().includes(search)
      );
    }

    return filtered;
  };

  // ============================================
  // Check if module has pending changes
  // ============================================
  const hasModuleChange = (moduleKey, originalValue) => {
    return moduleChanges[moduleKey] !== undefined && 
           moduleChanges[moduleKey] !== originalValue;
  };

  // ============================================
  // Check if permission has pending changes
  // ============================================
  const hasPermissionChange = (moduleKey) => {
    return permissionChanges[moduleKey] !== undefined;
  };

  // ============================================
  // Get permission status
  // ============================================
  const isPermissionEnabled = (moduleKey) => {
    if (permissionChanges[moduleKey] !== undefined) {
      return permissionChanges[moduleKey];
    }
    return userPermissions.includes(moduleKey);
  };

  // ============================================
  // Modules Tab Content (SuperAdmin)
  // ============================================
  const ModulesTabContent = (
    <div className="modules-content">
      <div className="content-header">
        <div>
          <h2>Module Management</h2>
          <p>Enable or disable modules for all users</p>
        </div>
        
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={loadAllModules}
            disabled={saving}
          >
            <FiRefreshCw /> Refresh
          </button>
          <button 
            className="btn btn-primary"
            onClick={saveModuleChanges}
            disabled={saving || Object.keys(moduleChanges).length === 0}
          >
            {saving ? (
              <>
                <LoadingSpinner size="small" />
                Saving...
              </>
            ) : (
              <>
                <FiSave /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <FiFilter />
          <select 
            value={moduleFilter} 
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="menu">Menu Items</option>
            <option value="submenu">Submenus</option>
            <option value="tab">Candidate Tabs</option>
            <option value="feature">Features</option>
          </select>
        </div>

        <div className="search-group">
          <FiSearch />
          <input
            type="text"
            placeholder="Search modules..."
            value={moduleSearch}
            onChange={(e) => setModuleSearch(e.target.value)}
          />
        </div>

        {Object.keys(moduleChanges).length > 0 && (
          <div className="pending-changes">
            <FiAlertCircle />
            <span>{Object.keys(moduleChanges).length} pending changes</span>
          </div>
        )}
      </div>

      {/* Modules List */}
      <div className="modules-list">
        {loading ? (
          <div className="loading-state">
            <LoadingSpinner />
            <p>Loading modules...</p>
          </div>
        ) : getFilteredModules().length === 0 ? (
          <div className="empty-state">
            <FiGrid />
            <p>No modules found</p>
          </div>
        ) : (
          getFilteredModules().map((module) => {
            const currentValue = moduleChanges[module.module_key] !== undefined
              ? moduleChanges[module.module_key]
              : module.is_enabled;
            const hasChange = hasModuleChange(module.module_key, module.is_enabled);

            return (
              <div 
                key={module.module_key}
                className={`module-item ${hasChange ? 'has-changes' : ''}`}
              >
                <div className="module-info">
                  <div className="module-header">
                    <h4>{module.module_name}</h4>
                    <span className={`module-type ${module.module_type}`}>
                      {module.module_type}
                    </span>
                  </div>
                  <p className="module-key">{module.module_key}</p>
                  {module.route && (
                    <p className="module-route">Route: {module.route}</p>
                  )}
                </div>

                <button
                  className={`toggle-btn ${currentValue ? 'enabled' : 'disabled'}`}
                  onClick={() => handleModuleToggle(module.module_key, currentValue)}
                  title={currentValue ? 'Click to disable' : 'Click to enable'}
                >
                  {currentValue ? <FiToggleRight /> : <FiToggleLeft />}
                  <span>{currentValue ? 'Enabled' : 'Disabled'}</span>
                </button>

                {hasChange && (
                  <div className="change-indicator">
                    <FiAlertCircle />
                    <span>Unsaved</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  // ============================================
  // Permissions Tab Content (Admin)
  // ============================================
  const PermissionsTabContent = (
    <div className="permissions-content">
      <div className="content-header">
        <div>
          <h2>User Permissions</h2>
          <p>Assign module permissions to users</p>
        </div>

        <div className="header-actions">
          {selectedUser && (
            <button 
              className="btn btn-primary"
              onClick={savePermissionChanges}
              disabled={saving || Object.keys(permissionChanges).length === 0}
            >
              {saving ? (
                <>
                  <LoadingSpinner size="small" />
                  Saving...
                </>
              ) : (
                <>
                  <FiSave /> Save Permissions
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="permissions-layout">
        {/* Users Sidebar */}
        <div className="users-sidebar">
          <h3>
            <FiUsers /> Select User
          </h3>
          
          {users.length === 0 ? (
            <div className="empty-users">
              <p>No users available</p>
            </div>
          ) : (
            <div className="users-list">
              {users.map((u) => (
                <button
                  key={u.id}
                  className={`user-item ${selectedUser?.id === u.id ? 'active' : ''}`}
                  onClick={() => handleUserSelect(u)}
                >
                  <div className="user-info">
                    <span className="user-name">{u.username}</span>
                    <span className="user-role">{u.role}</span>
                  </div>
                  {selectedUser?.id === u.id && <FiCheckCircle />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Permissions Panel */}
        <div className="permissions-panel">
          {!selectedUser ? (
            <div className="empty-state">
              <FiUsers />
              <p>Select a user to manage permissions</p>
            </div>
          ) : loading ? (
            <div className="loading-state">
              <LoadingSpinner />
              <p>Loading permissions...</p>
            </div>
          ) : (
            <>
              <div className="selected-user-info">
                <h3>Permissions for {selectedUser.username}</h3>
                {Object.keys(permissionChanges).length > 0 && (
                  <div className="pending-changes">
                    <FiAlertCircle />
                    <span>{Object.keys(permissionChanges).length} pending changes</span>
                  </div>
                )}
              </div>

              <div className="permissions-list">
                {modules.map((module) => {
                  const isEnabled = isPermissionEnabled(module.module_key);
                  const hasChange = hasPermissionChange(module.module_key);

                  return (
                    <div 
                      key={module.module_key}
                      className={`permission-item ${hasChange ? 'has-changes' : ''}`}
                    >
                      <div className="permission-info">
                        <div className="permission-header">
                          <h4>{module.module_name}</h4>
                          <span className={`module-type ${module.module_type}`}>
                            {module.module_type}
                          </span>
                        </div>
                        <p className="module-key">{module.module_key}</p>
                      </div>

                      <button
                        className={`toggle-btn ${isEnabled ? 'enabled' : 'disabled'}`}
                        onClick={() => handlePermissionToggle(module.module_key)}
                      >
                        {isEnabled ? <FiToggleRight /> : <FiToggleLeft />}
                        <span>{isEnabled ? 'Granted' : 'Denied'}</span>
                      </button>

                      {hasChange && (
                        <div className="change-indicator">
                          <FiAlertCircle />
                          <span>Unsaved</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  // ============================================
  // Tab Configuration
  // ============================================
  const tabConfig = user.role === 'super_admin' 
    ? [
        {
          key: 'modules',
          title: 'Modules',
          icon: <FiGrid />,
          content: ModulesTabContent,
        },
        {
          key: 'permissions',
          title: 'User Permissions',
          icon: <FiUsers />,
          content: PermissionsTabContent,
        },
      ]
    : [
        {
          key: 'permissions',
          title: 'User Permissions',
          icon: <FiUsers />,
          content: PermissionsTabContent,
        },
      ];

  return (
    <div className="modules-page">
      <div className="page-header">
        <h1>
          <FiGrid /> Modules & Permissions
        </h1>
        <p>
          {user.role === 'super_admin' 
            ? 'Manage system modules and user permissions'
            : 'Assign permissions to staff members'}
        </p>
      </div>

      <Tabs tabs={tabConfig} defaultActiveTab={user.role === 'super_admin' ? 'modules' : 'permissions'} />
    </div>
  );
}

export default ModulesPage;
