// src/layouts/MainLayout.jsx
import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid,
  FiClock,
  FiSearch,
  FiUserPlus,
  FiLogOut,
  FiBriefcase,
  FiServer,
  FiClipboard,
  FiSettings,
  FiBarChart2,
  FiUserCheck,
  FiTrash2,
  FiChevronLeft,
  FiPackage,
  FiUploadCloud,
  FiSun,
  FiMoon,
  FiChevronDown,
} from 'react-icons/fi';
import { toast } from 'react-hot-toast';
import '../css/MainLayout.css';

function getInitialCollapseState() {
  const stored = localStorage.getItem('sidebarCollapsed');
  return stored ? JSON.parse(stored) : false;
}

function getInitialTheme() {
  const stored = localStorage.getItem('theme');
  return stored || 'dark';
}

function SubMenu({ title, icon, children, isCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = e => {
    if (!isCollapsed) {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
  };

  return (
    <li className={isOpen && !isCollapsed ? 'submenu-open' : ''}>
      <a onClick={handleToggle} className="submenu-toggle">
        {icon}
        <span>{title}</span>
        {!isCollapsed && <FiChevronDown className="submenu-arrow" />}
      </a>
      <ul className="submenu-content">{children}</ul>
    </li>
  );
}

function MainLayout({ children, onLogout, user, flags }) {
  const navigate = useNavigate();

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapseState);
  const [theme, setTheme] = useState(getInitialTheme);
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');

  // Granular permissions for STAFF; for super_admin/admin we set everything true
  const [granularPermissions, setGranularPermissions] = useState({});
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Load granular permissions
  useEffect(() => {
    const loadPermissions = async () => {
      if (!user) return;

      // Super Admin: everything on sidebar
      if (user.role === 'super_admin') {
        setGranularPermissions({
          candidatesearch: true,
          addcandidate: true,
          bulkimport: true,
          employers: true,
          joborders: true,
          visaboard: true,
          systemreports: true,
          systemauditlog: true,
          systemmodules: true,
          systemrecyclebin: true,
        });
        setPermsLoaded(true);
        return;
      }

      // Admin: same sidebar as super admin
      if (user.role === 'admin') {
        setGranularPermissions({
          candidatesearch: true,
          addcandidate: true,
          bulkimport: true,
          employers: false,
          joborders: false,
          visaboard: false,
          systemreports: true,
          systemauditlog: true,
          systemmodules: false,
          systemrecyclebin: true,
        });
        setPermsLoaded(true);
        return;
      }

      // Staff: load real granular permissions from DB
      try {
        const res = await window.electronAPI.getUserGranularPermissions({
          userId: user.id,
        });
        if (res.success) {
          setGranularPermissions(res.data || {});
        }
      } catch (err) {
        console.error('Error fetching granular permissions:', err);
      } finally {
        setPermsLoaded(true);
      }
    };

    loadPermissions();
  }, [user]);

  const canAccess = permKey => {
    if (!permKey) return true;
    // for super_admin/admin we already set all keys to true above
    return granularPermissions[permKey] === true;
  };

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Role polling (existing logic kept)
  useEffect(() => {
    const checkRoleStatus = async () => {
      if (!window.electronAPI || typeof window.electronAPI.getUserRole !== 'function') return;
      if (!user || !user.id) return;

      try {
        const res = await window.electronAPI.getUserRole({ userId: user.id });
        if (res.success) {
          if (res.role !== user.role) {
            toast.error('Your permissions have changed. You must log in again.');
            onLogout();
            navigate('/login');
          }
        } else if (res.error === 'User not found') {
          toast.error('This account no longer exists.');
          onLogout();
          navigate('/login');
        }
      } catch (error) {
        console.warn('Role check failed silently', error);
      }
    };

    const interval = setInterval(checkRoleStatus, 60000);
    return () => clearInterval(interval);
  }, [user, onLogout, navigate]);

  const handleGlobalSearch = e => {
    if (e.key === 'Enter' && globalSearchTerm.trim() !== '') {
      navigate(`/search?q=${encodeURIComponent(globalSearchTerm.trim())}`);
      setGlobalSearchTerm('');
    }
  };

  const getDisplayRole = role => {
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'admin') return 'Admin';
    return 'Staff';
  };

  const displayedRole = user ? getDisplayRole(user.role) : 'Guest';
  const username = user ? user.username : 'Unknown';

  const handleLogoutClick = () => {
    onLogout();
    navigate('/login');
  };

  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', JSON.stringify(newState));
  };

  const handlePasswordChangeLogout = () => {
    onLogout();
    navigate('/login');
  };

  const isManagementVisible = () => {
    return (
      canAccess('employers') ||
      canAccess('joborders') ||
      canAccess('visaboard') ||
      canAccess('bulkimport')
    );
  };

  const isSystemVisible = () => {
    return (
      canAccess('systemreports') ||
      canAccess('systemauditlog') ||
      canAccess('systemmodules') ||
      canAccess('systemrecyclebin') ||
      user.role === 'super_admin' ||
      user.role === 'admin'
    );
  };

  if (!permsLoaded) {
    return <div style={{ padding: '2rem' }}>Loading application...</div>;
  }

  return (
    <div className={`layout-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className="sidebar">
        <div className="sidebar-scrollable-area">
          <button className="sidebar-toggle-btn" onClick={handleToggleCollapse}>
            <FiChevronLeft />
          </button>

          <div className="sidebar-header">
            <FiBriefcase className="sidebar-logo" />
            <h3>Consultancy App</h3>
            <button
              onClick={toggleTheme}
              className="theme-icon-toggle"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? <FiMoon /> : <FiSun />}
            </button>
          </div>

          <div className="global-search-bar">
            <FiSearch />
            <input
              type="text"
              placeholder="Global Search..."
              value={globalSearchTerm}
              onChange={e => setGlobalSearchTerm(e.target.value)}
              onKeyDown={handleGlobalSearch}
              title="Press Enter to search candidates"
            />
          </div>

          <ul className="sidebar-nav">
            {/* Dashboard */}
            <li>
              <NavLink to="/" end>
                <FiGrid />
                <span>Dashboard</span>
              </NavLink>
            </li>

            {/* Candidates */}
            <SubMenu title="Candidates" icon={<FiSearch />} isCollapsed={isCollapsed}>
              {canAccess('candidatesearch') && (
                <li>
                  <NavLink to="/search">
                    <FiSearch />
                    <span>Candidate Search</span>
                  </NavLink>
                </li>
              )}
              {canAccess('addcandidate') && (
                <li>
                  <NavLink to="/add">
                    <FiUserPlus />
                    <span>Add New Candidate</span>
                  </NavLink>
                </li>
              )}
              {canAccess('bulkimport') && (
                <li>
                  <NavLink to="/import">
                    <FiUploadCloud />
                    <span>Bulk Import</span>
                  </NavLink>
                </li>
              )}
            </SubMenu>

            {/* Management */}
            {isManagementVisible() && (
              <SubMenu title="Management" icon={<FiBriefcase />} isCollapsed={isCollapsed}>
                {canAccess('employers') && (
                  <li>
                    <NavLink to="/employers">
                      <FiServer />
                      <span>Employers</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('joborders') && (
                  <li>
                    <NavLink to="/jobs">
                      <FiClipboard />
                      <span>Job Orders</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('visaboard') && (
                  <li>
                    <NavLink to="/visa-board">
                      <FiBriefcase />
                      <span>Visa Board</span>
                    </NavLink>
                  </li>
                )}
              </SubMenu>
            )}

            {/* System Settings */}
            {isSystemVisible() && (
              <SubMenu title="System Settings" icon={<FiSettings />} isCollapsed={isCollapsed}>
                {canAccess('systemreports') && (
                  <li>
                    <NavLink to="/reports">
                      <FiBarChart2 />
                      <span>Reports</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('systemauditlog') && (
                  <li>
                    <NavLink to="/system-audit">
                      <FiClock />
                      <span>Audit Log</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('systemmodules') && (
                  <li>
                    <NavLink to="/system-modules">
                      <FiPackage />
                      <span>Modules</span>
                    </NavLink>
                  </li>
                )}
              </SubMenu>
            )}

            {/* Settings – always for super_admin/admin */}
            {(user.role === 'super_admin' || user.role === 'admin') && (
              <li>
                <NavLink to="/settings">
                  <FiSettings />
                  <span>Settings</span>
                </NavLink>
              </li>
            )}

            {/* Recycle Bin */}
            {canAccess('systemrecyclebin') && (
              <li>
                <NavLink to="/recycle-bin">
                  <FiTrash2 />
                  <span>Recycle Bin</span>
                </NavLink>
              </li>
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="user-info-badge">
            <FiUserCheck />
            <div className="user-info-text-wrapper">
              <span>Logged in as:</span>
              <strong>
                {username} ({displayedRole})
              </strong>
            </div>
          </div>
          <button onClick={handleLogoutClick} className="logout-button">
            <FiLogOut />
            <span>Logout</span>
          </button>
        </div>
      </nav>

      <main className="main-content">{children}</main>

      {isPasswordModalOpen && (
        <ChangePasswordModal
          user={user}
          onClose={() => setIsPasswordModalOpen(false)}
          onPasswordChange={handlePasswordChangeLogout}
        />
      )}
    </div>
  );
}

export default MainLayout;
