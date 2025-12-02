import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiSend ,FiClock, FiSearch, FiUserPlus, FiLogOut, FiBriefcase, FiServer,
  FiClipboard, FiSettings, FiLock, FiBarChart2, FiUserCheck,
  FiTrash2, FiChevronLeft, FiPackage, FiUploadCloud, FiSun, FiMoon,
  FiChevronDown, FiChevronRight, FiUsers
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/MainLayout.css';
import ChangePasswordModal from './modals/ChangePasswordModal';
import KeyboardShortcutsGuide from './KeyboardShortcutsGuide';
import { useGlobalShortcuts } from '../hooks/useKeyboardShortcuts';

const getInitialCollapseState = () => {
  const storedState = localStorage.getItem('sidebarCollapsed');
  return storedState ? JSON.parse(storedState) : false;
};

const getInitialTheme = () => {
  const storedTheme = localStorage.getItem('theme');
  return storedTheme || 'dark';
};

function SubMenu({ title, icon, children, isCollapsed }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    if (!isCollapsed) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <li className={isOpen && !isCollapsed ? 'submenu-open' : ''}>
      <a onClick={handleToggle} className="submenu-toggle">
        {icon}
        <span>{title}</span>
        <FiChevronDown className="submenu-arrow" />
      </a>
      <ul className="submenu-content">
        {children}
      </ul>
    </li>
  );
}

function MainLayout({ children, onLogout, user, flags }) {
  const navigate = useNavigate();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(getInitialCollapseState());
  const [theme, setTheme] = useState(getInitialTheme());
  const [globalSearchTerm, setGlobalSearchTerm] = useState('');
  const [granularPermissions, setGranularPermissions] = useState({});
  const [permsLoaded, setPermsLoaded] = useState(false);

  const globalSearchRef = useRef(null);

  // Use global keyboard shortcuts for navigation, search, etc
  useGlobalShortcuts(navigate, user);

  // Granular Permissions (unchanged)
  useEffect(() => {
    const loadPermissions = async () => {
      if (user.role === 'super_admin') {
        setGranularPermissions({
          candidate_search: true,
          add_candidate: true,
          bulk_import: true,
          employers: true,
          job_orders: true,
          visa_board: true,
          system_reports: true,
          system_audit_log: true,
          system_modules: true,
          system_recycle_bin: true,
        });
      } else {
        const res = await window.electronAPI.getUserGranularPermissions({ userId: user.id });
        if (res.success) {
          setGranularPermissions(res.data || {});
        }
      }
      setPermsLoaded(true);
    };
    loadPermissions();
  }, [user]);

  const canAccess = (permKey) => granularPermissions[permKey] === true;

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const checkRoleStatus = async () => {
      if (!window.electronAPI || typeof window.electronAPI.getUserRole !== 'function') return;
      if (!user || !user.id) return;
      try {
        const res = await window.electronAPI.getUserRole({ userId: user.id });
        if (res.success) {
          if (res.role !== user.role) {
            toast.error("Your permissions have changed. You must log in again.");
            onLogout();
            navigate('/login');
          }
        } else if (res.error === 'User not found') {
          toast.error("This account no longer exists.");
          onLogout();
          navigate('/login');
        }
      } catch (error) {
        console.warn("Role check failed silently:", error);
      }
    };
    checkRoleStatus();
    const interval = setInterval(checkRoleStatus, 60000);
    return () => clearInterval(interval);
  }, [user, onLogout, navigate]);

  const handleGlobalSearch = (e) => {
    if (e.key === 'Enter' && globalSearchTerm.trim() !== '') {
      navigate(`/search?q=${globalSearchTerm}`);
      setGlobalSearchTerm('');
    }
  };

  const getDisplayRole = (role) => {
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

  const handlePasswordChangeLogout = onLogout;

  const isManagementVisible = () =>
    canAccess('employers') ||
    canAccess('job_orders') ||
    canAccess('visa_board') ||
    canAccess('bulk_import');

  const isSystemVisible = () =>
    canAccess('system_reports') ||
    canAccess('system_audit_log') ||
    canAccess('system_modules') ||
    canAccess('system_recycle_bin') ||
    user.role === 'super_admin' ||
    user.role === 'admin';

  if (!permsLoaded) {
    return <div style={{ padding: '2rem' }}>Loading application...</div>;
  }

  return (
    <div className={`layout-container ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
      <nav className={`sidebar`}>
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
            {/* Keyboard Shortcuts Trigger */}
            <KeyboardShortcutsGuide />
          </div>

          <div className="global-search-bar">
            <FiSearch />
            <input
              type="text"
              placeholder="Global Search..."
              value={globalSearchTerm}
              onChange={(e) => setGlobalSearchTerm(e.target.value)}
              onKeyDown={handleGlobalSearch}
              title="Press Enter to search candidates"
              ref={globalSearchRef}
            />
          </div>

          <ul className="sidebar-nav">
            {/* Dashboard - Always visible */}
            <li>
              <NavLink to="/" end>
                <FiGrid />
                <span>Dashboard</span>
              </NavLink>
            </li>

            {/* Candidates Section */}
            <SubMenu title="Candidates" icon={<FiSearch />} isCollapsed={isCollapsed}>
              {canAccess('candidate_search') && (
                <li>
                  <NavLink to="/search">
                    <FiSearch />
                    <span>Candidate Search</span>
                  </NavLink>
                </li>
              )}
              {canAccess('add_candidate') && (
                <li>
                  <NavLink to="/add">
                    <FiUserPlus />
                    <span>Add New Candidate</span>
                  </NavLink>
                </li>
              )}
              {canAccess('bulk_import') && (
                <li>
                  <NavLink to="/import">
                    <FiUploadCloud />
                    <span>Bulk Import</span>
                  </NavLink>
                </li>
              )}
            </SubMenu>

            {/* Management Section */}
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
                {canAccess('job_orders') && (
                  <li>
                    <NavLink to="/jobs">
                      <FiClipboard />
                      <span>Job Orders</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('visa_board') && (
                  <li>
                    <NavLink to="/visa-board">
                      <FiBriefcase />
                      <span>Visa Board</span>
                    </NavLink>
                  </li>
                )}
              </SubMenu>
            )}

            {/* System Settings Section */}
            {isSystemVisible() && (
              <SubMenu title="System Settings" icon={<FiSettings />} isCollapsed={isCollapsed}>
                {canAccess('system_reports') && (
                  <li>
                    <NavLink to="/reports">
                      <FiBarChart2 />
                      <span>Reports</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('system_modules') && (
                   <li>
                  <NavLink to="/whatsapp-bulk">
                   <FiSend />
                     <span>WhatsApp Bulk</span>
                  </NavLink>
                    </li>
                )}
                {canAccess('system_audit_log') && (
                  <li>
                    <NavLink to="/system-audit">
                      <FiClock />
                      <span>Audit Log</span>
                    </NavLink>
                  </li>
                )}
                {/* {canAccess('system_modules') && (
                  <li>
                    <NavLink to="/system-modules">
                      <FiPackage />
                      <span>Modules</span>
                    </NavLink>
                  </li>
                )} */}
                {(user.role === 'super_admin' || user.role === 'admin') && (
                  <li>
                    <NavLink to="/settings">
                      <FiSettings />
                      <span>Settings</span>
                    </NavLink>
                  </li>
                )}
                {canAccess('system_recycle_bin') && (
                  <li>
                    <NavLink to="/recycle-bin">
                      <FiTrash2 />
                      <span>Recycle Bin</span>
                    </NavLink>
                  </li>
                )}
              </SubMenu>
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          <div className="user-info-badge">
            <FiUserCheck />
            <div className="user-info-text-wrapper">
              <span>Logged in as:</span>
              <strong>{username} ({displayedRole})</strong>
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
