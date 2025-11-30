import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FiHome,
  FiUsers,
  FiSearch,
  FiUserPlus,
  FiUpload,
  FiBriefcase,
  FiClipboard,
  FiGlobe,
  FiBarChart,
  FiMail,
  FiEdit,
  FiInbox,
  FiSettings,
  FiActivity,
  FiGrid,
  FiDatabase,
  FiTool,
  FiTrash2,
  FiChevronDown,
  FiChevronRight,
} from 'react-icons/fi';
import usePermissionStore from '../store/usePermissionStore';
import useAuthStore from '../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

// Icon mapping for dynamic rendering
const ICON_MAP = {
  FiHome,
  FiUsers,
  FiSearch,
  FiUserPlus,
  FiUpload,
  FiBriefcase,
  FiClipboard,
  FiGlobe,
  FiBarChart,
  FiMail,
  FiEdit,
  FiInbox,
  FiSettings,
  FiActivity,
  FiGrid,
  FiDatabase,
  FiTool,
  FiTrash2,
};

function DynamicSidebar({ isCollapsed }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore(useShallow((state) => ({ user: state.user })));
  const { getMenuItems, getSubmenus } = usePermissionStore();

  const [menuItems, setMenuItems] = useState([]);
  const [expandedMenus, setExpandedMenus] = useState({});

  // Load menu items on mount
  useEffect(() => {
    loadMenuItems();
  }, [user]);

  const loadMenuItems = () => {
    const items = getMenuItems();
    setMenuItems(items);

    // Auto-expand active menu
    const activeMenu = items.find(item => {
      if (item.route === location.pathname) return true;
      const subs = getSubmenus(item.module_key);
      return subs.some(sub => sub.route === location.pathname);
    });

    if (activeMenu) {
      setExpandedMenus(prev => ({ ...prev, [activeMenu.module_key]: true }));
    }
  };

  const toggleMenu = (moduleKey) => {
    setExpandedMenus(prev => ({
      ...prev,
      [moduleKey]: !prev[moduleKey]
    }));
  };

  const handleMenuClick = (item) => {
    const submenus = getSubmenus(item.module_key);

    // If has submenus, toggle expansion
    if (submenus.length > 0) {
      toggleMenu(item.module_key);
    } else if (item.route) {
      // If has route, navigate
      navigate(item.route);
    }
  };

  const handleSubmenuClick = (submenu) => {
    if (submenu.route) {
      navigate(submenu.route);
    }
  };

  const isActive = (route) => {
    if (!route) return false;
    return location.pathname === route;
  };

  const isMenuActive = (menuKey) => {
    const menu = menuItems.find(m => m.module_key === menuKey);
    if (!menu) return false;

    // Check if menu route is active
    if (menu.route && isActive(menu.route)) return true;

    // Check if any submenu is active
    const submenus = getSubmenus(menuKey);
    return submenus.some(sub => isActive(sub.route));
  };

  const getIcon = (iconName) => {
    const IconComponent = ICON_MAP[iconName] || FiGrid;
    return <IconComponent />;
  };

  return (
    <nav className={`dynamic-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-menu">
        {menuItems.map((menuItem) => {
          const submenus = getSubmenus(menuItem.module_key);
          const hasSubmenus = submenus.length > 0;
          const isExpanded = expandedMenus[menuItem.module_key];
          const isMenuItemActive = isMenuActive(menuItem.module_key);

          return (
            <div key={menuItem.module_key} className="menu-item-wrapper">
              {/* Main Menu Item */}
              <button
                className={`menu-item ${isMenuItemActive ? 'active' : ''}`}
                onClick={() => handleMenuClick(menuItem)}
                title={isCollapsed ? menuItem.module_name : ''}
              >
                <span className="menu-icon">
                  {getIcon(menuItem.icon)}
                </span>
                
                {!isCollapsed && (
                  <>
                    <span className="menu-label">{menuItem.module_name}</span>
                    {hasSubmenus && (
                      <span className="menu-arrow">
                        {isExpanded ? <FiChevronDown /> : <FiChevronRight />}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Submenus */}
              {hasSubmenus && isExpanded && !isCollapsed && (
                <div className="submenu-container">
                  {submenus.map((submenu) => (
                    <button
                      key={submenu.module_key}
                      className={`submenu-item ${isActive(submenu.route) ? 'active' : ''}`}
                      onClick={() => handleSubmenuClick(submenu)}
                    >
                      <span className="submenu-icon">
                        {getIcon(submenu.icon)}
                      </span>
                      <span className="submenu-label">{submenu.module_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

export default DynamicSidebar;
