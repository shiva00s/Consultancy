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
  allowCustom = true,
  disabled = false,
  emptyMessage = "No options available"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Support both string arrays and object arrays with {value, label}
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'string') {
      return { value: opt, label: opt };
    }
    return opt; // Already an object with value & label
  });

  const filteredOptions = normalizedOptions.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate dropdown position
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue) => {
    onChange({ target: { name, value: optionValue } });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setIsOpen(true);

    if (allowCustom) {
      onChange({ target: { name, value: newValue } });
    }
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  // Find the display label for the current value
  const getDisplayValue = () => {
    if (isOpen) return searchTerm;
    if (!value) return '';
    
    const selectedOption = normalizedOptions.find(opt => opt.value === value || opt.value === String(value));
    return selectedOption ? selectedOption.label : value;
  };

  const displayValue = getDisplayValue();

  // Dropdown menu component
  const dropdownMenu = isOpen && (
    <div
      ref={dropdownRef}
      className="custom-dropdown-menu"
      style={{
        position: 'absolute',
        top: `${dropdownPosition.top}px`,
        left: `${dropdownPosition.left}px`,
        width: `${dropdownPosition.width}px`,
        zIndex: 10000,
      }}
    >
      {filteredOptions.length === 0 ? (
        <div className="custom-dropdown-empty">{emptyMessage}</div>
      ) : (
        filteredOptions.map((opt, index) => (
          <div
            key={index}
            className="custom-dropdown-option"
            onClick={() => handleSelect(opt.value)}
          >
            {opt.label}
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="custom-dropdown-container">
      <div className="custom-dropdown-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onClick={handleInputClick}
          placeholder={placeholder}
          disabled={disabled}
          className="custom-dropdown-input"
        />
        <FiChevronDown
          className={`custom-dropdown-icon ${isOpen ? 'rotate' : ''}`}
          onClick={handleInputClick}
        />
      </div>
      {ReactDOM.createPortal(dropdownMenu, document.body)}
    </div>
  );
}

export default CustomDropdown;
