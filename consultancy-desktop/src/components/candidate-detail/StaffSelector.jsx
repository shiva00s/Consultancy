import React from 'react';
import { FiUser } from 'react-icons/fi';
import CustomDropdown from '../tools/CustomDropdown';

function StaffSelector({ 
  value, 
  onChange, 
  staffList, 
  currentUser, 
  required = true,
  label = "STAFF"
}) {
  const options = currentUser?.fullName 
    ? [currentUser.fullName, ...staffList.filter(name => name !== currentUser?.fullName)]
    : staffList;

  return (
    <div className="form-group">
      <label><FiUser /> {label} {required && '*'}</label>
      <CustomDropdown
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={options}
        placeholder="Select or type staff name..."
        name={`staff-${label}`}
        allowCustom={true}
      />
    </div>
  );
}

export default StaffSelector;
