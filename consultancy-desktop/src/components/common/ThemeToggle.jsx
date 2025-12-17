import React from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import useThemeStore from '../../store/useThemeStore';

const ThemeToggle = React.memo(() => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button 
      className="btn glass-card"
      style={{ 
        padding: '8px', 
        minHeight: 'auto',
        width: '40px',
        height: '40px'
      }}
      onClick={toggleTheme}
      title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
      aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
    >
      {theme === 'dark' ? <FiSun size={18} /> : <FiMoon size={18} />}
    </button>
  );
});

ThemeToggle.displayName = 'ThemeToggle';

export default ThemeToggle;
