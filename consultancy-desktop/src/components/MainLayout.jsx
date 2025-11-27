import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  FiGrid, FiClock, FiSearch, FiUserPlus, FiLogOut, FiBriefcase, FiServer,
  FiClipboard, FiSettings, FiLock, FiBarChart2, FiUserCheck,
  FiTrash2, FiChevronLeft, FiPackage, FiUploadCloud, FiSun, FiMoon,
  FiChevronDown
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import '../css/MainLayout.css';
import ChangePasswordModal from './modals/ChangePasswordModal';
import ThemeSwitch from './ThemeSwitch';

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

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };
  
  useEffect(() => {
    document.body.dataset.theme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  // --- SECURITY POLLING: Auto-logout if role changes ---
  useEffect(() => {
    const checkRoleStatus = async () => {
        // [FIX] SAFETY CHECK: Stop execution if API or User is missing
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

    checkRoleStatus(); // Run once immediately
    const interval = setInterval(checkRoleStatus, 60000); // Then every 60s
    return () => clearInterval(interval);
  }, [user, onLogout, navigate]);
  // -----------------------------------------------------

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

  // === VISIBILITY CHECKERS ===
  const canViewLink = (user, flags, linkKey) => {
    if (!user || !flags) return false;

    if (user.role === 'super_admin') return true;

    if (linkKey === 'dashboard' || linkKey === 'search' || linkKey === 'add') {
      return true;
    }

    if (user.role === 'staff') {
        return false; // Block management/system links for staff
    }

    if (user.role === 'admin') {
        if (linkKey === 'employers') return flags.isEmployersEnabled;
        if (linkKey === 'jobs') return flags.isJobsEnabled;
        if (linkKey === 'import') return flags.isBulkImportEnabled; 
        if (linkKey === 'visa') return flags.isVisaKanbanEnabled; // [FIX] Kanban Permission
        
        if (linkKey === 'reports') return flags.canViewReports;
        if (linkKey === 'audit-log') return flags.canAccessSettings; 
        if (linkKey === 'settings') return flags.canAccessSettings;
        if (linkKey === 'system-modules') return false; 
        if (linkKey === 'recycle-bin') return flags.canAccessRecycleBin;
        
        return false;
    }

    return false;
  };

  const isManagementVisible = () => {
    return canViewLink(user, flags, 'employers') ||
           canViewLink(user, flags, 'jobs') ||
           canViewLink(user, flags, 'visa') ||
           canViewLink(user, flags, 'import');
  };

  const isSystemVisible = () => {
    return canViewLink(user, flags, 'reports') ||
           canViewLink(user, flags, 'settings') ||
           canViewLink(user, flags, 'recycle-bin') ||
           canViewLink(user, flags, 'audit-log') ||
           canViewLink(user, flags, 'system-modules'); 
  };

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
            />
          </div>
          
          <ul className="sidebar-nav">
  {canViewLink(user, flags, 'dashboard') && (
    <li>
      <NavLink to="/" end>
        <FiGrid />
        <span>Dashboard</span>
      </NavLink>
    </li>
  )}
  <SubMenu title="Candidates" icon={<FiSearch />} isCollapsed={isCollapsed}>
    {canViewLink(user, flags, 'search') && (
      <li>
        <NavLink to="/search">
          <FiSearch />
          <span>Candidate Search</span>
        </NavLink>
      </li>
    )}
    {canViewLink(user, flags, 'add') && (
      <li>
        <NavLink to="/add">
          <FiUserPlus />
          <span>Add New Candidate</span>
        </NavLink>
      </li>
    )}
    {canViewLink(user, flags, 'import') && (
      <li>
        <NavLink to="/import">
          <FiUploadCloud />
          <span>Bulk Import</span>
        </NavLink>
      </li>
    )}
  </SubMenu>
  
  {isManagementVisible() && ( 
    <SubMenu title="Management" icon={<FiBriefcase />} isCollapsed={isCollapsed}>
      {canViewLink(user, flags, 'employers') && (
        <li>
          <NavLink to="/employers">
            <FiServer />
            <span>Employers</span>
          </NavLink>
        </li>
      )}
      {canViewLink(user, flags, 'jobs') && (
        <li>
          <NavLink to="/jobs">
            <FiClipboard />
            <span>Job Orders</span>
          </NavLink>
        </li>
      )}
      {/* [FIX] Added Visa Kanban Link */}
      {canViewLink(user, flags, 'visa') && (
        <li>
          <NavLink to="/visa-board">
            <FiBriefcase /> {/* Or FiActivity */}
            <span>Visa Board</span>
          </NavLink>
        </li>
      )}
    </SubMenu>
  )}
  
  {isSystemVisible() && ( 
    <SubMenu title="System Settings" icon={<FiSettings />} isCollapsed={isCollapsed}>
      {canViewLink(user, flags, 'reports') && (
        <li>
          <NavLink to="/reports">
            <FiBarChart2 />
            <span>Reports</span>
          </NavLink>
        </li>
      )}
      {canViewLink(user, flags, 'audit-log') && (
        <li>
          <NavLink to="/system-audit">
            <FiClock />
            <span>Audit Log</span>
          </NavLink>
        </li>
      )}
      {canViewLink(user, flags, 'system-modules') && ( 
        <li>
            <NavLink to="/system-modules"> 
                <FiPackage />
                <span>Modules</span>
            </NavLink>
        </li>
      )}
      {canViewLink(user, flags, 'settings') && (
        <li>
          <NavLink to="/settings">
            <FiSettings />
            <span>Settings</span>
          </NavLink>
        </li>
      )}
      {canViewLink(user, flags, 'recycle-bin') && (
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