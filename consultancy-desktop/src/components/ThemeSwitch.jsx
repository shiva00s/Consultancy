import React from 'react';
import '../css/ThemeSwitch.css'; 

// MODIFIED: Accepts theme and toggleTheme as props from MainLayout
const ThemeSwitch = ({ theme, toggleTheme }) => {

  return (
    <div className="theme-switch-wrapper">
      <label className="theme-switch" htmlFor="checkbox">
        <input 
          type="checkbox" 
          id="checkbox" 
          checked={theme === 'dark'} // Checked if dark theme is active
          onChange={toggleTheme} 
        />
        <div className="slider round"></div>
      </label>
    </div>
  );
};

export default ThemeSwitch;