import React from 'react';
import { FiUser } from 'react-icons/fi';
import CustomDropdown from '../common/CustomDropdown';

function StaffSelector({ 
  value, 
  onChange, 
  staffList = [], 
  currentUser, 
  required = true,
  label = "STAFF"
}) {
  // Build options list with current user at top (if exists)
  let options = [...staffList]; // Start with all staff
  
  // If current user exists and has a fullName, prioritize it
  if (currentUser?.fullName) {
    // Remove current user from list if already present
    options = options.filter(name => name !== currentUser.fullName);
    // Add current user at the beginning
    options = [currentUser.fullName, ...options];
  }

  return (
    <div className="form-group">
      <label>
        <FiUser /> {label} {required && '*'}
      </label>
      <CustomDropdown
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder="Select or type staff name..."
        name={`staff-${label.replace(/\s/g, '-').toLowerCase()}`}
        allowCustom={true}
      />
    </div>
  );
}

export default StaffSelector;
