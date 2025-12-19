import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FiChevronDown } from 'react-icons/fi';
import './CustomDropdown.css';

function CustomDropdown({ 
  value, 
  onChange, 
  options = [], 
  placeholder = "Select or type...",
  name,
  allowCustom = true 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // ✅ Filter options based on search term
  const filteredOptions = options.filter(opt =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ✅ Calculate dropdown position dynamically
  useEffect(() => {
    if (isOpen && inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  }, [isOpen]);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target) &&
          inputRef.current && !inputRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ✅ Handle option selection
  const handleSelect = (option) => {
    onChange({ target: { name, value: option } });
    setIsOpen(false);
    setSearchTerm('');
  };

  // ✅ Handle manual input changes
  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);
    
    if (allowCustom) {
      onChange({ target: { name, value: newValue } });
    }
  };

  // ✅ Open dropdown on input click
  const handleInputClick = () => {
    setIsOpen(true);
  };

  // ✅ Display value logic: show search term while typing, otherwise show selected value
  const displayValue = isOpen ? searchTerm : value;

  // ✅ Dropdown menu component
  const dropdownMenu = isOpen && (
    <div 
      ref={dropdownRef}
      className="custom-dropdown-menu-portal"
      style={{
        position: 'absolute',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 99999,
      }}
    >
      {filteredOptions.length > 0 ? (
        filteredOptions.map((option, idx) => (
          <div
            key={idx}
            className={`custom-dropdown-item ${value === option ? 'selected' : ''}`}
            onClick={() => handleSelect(option)}
          >
            {option}
          </div>
        ))
      ) : (
        <div className="custom-dropdown-empty">
          {allowCustom && searchTerm ? (
            <span>Type to add "{searchTerm}"</span>
          ) : (
            <span>No options found</span>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="custom-dropdown">
      <div className="custom-dropdown-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="custom-dropdown-input"
          value={displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          autoComplete="off"
        />
        <FiChevronDown 
          className={`custom-dropdown-arrow ${isOpen ? 'open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {/* ✅ Render dropdown menu in document body using portal */}
      {dropdownMenu && ReactDOM.createPortal(dropdownMenu, document.body)}
    </div>
  );
}

export default CustomDropdown;
