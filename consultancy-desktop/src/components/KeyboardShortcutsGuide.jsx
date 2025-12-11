import React, { useState } from 'react';
import { FiCommand, FiX } from 'react-icons/fi';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import '../css/KeyboardShortcuts.css';

const shortcuts = [
  {
    category: 'Navigation',
    items: [
      { keys: ['Ctrl', 'K'], description: 'Focus search bar' },
      { keys: ['Ctrl', 'H'], description: 'Go to home/dashboard' },
      { keys: ['Ctrl', 'S'], description: 'Go to candidate search' },
      { keys: ['Ctrl', 'N'], description: 'Add new candidate' },
      { keys: ['Escape'], description: 'Close modals/dialogs' },
    ],
  },
  {
    category: 'Forms',
    items: [
      { keys: ['Ctrl', 'Enter'], description: 'Submit form' },
      { keys: ['Ctrl', 'S'], description: 'Save changes' },
      { keys: ['Escape'], description: 'Cancel editing' },
    ],
  },
  {
    category: 'Admin Only',
    items: [
      { keys: ['Ctrl', 'Shift', 'B'], description: 'Backup settings' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'System settings' },
    ],
  },
];

function KeyboardShortcutsGuide() {
  const [isOpen, setIsOpen] = useState(false);

  // Toggle guide with ? or Shift+/
  useKeyboardShortcuts({
    '?': () => setIsOpen(true),
    'shift+/': () => setIsOpen(true),
  }, []);

  return (
    <>
      {/* ✅ Floating Button - Bottom Right */}
      <button
        className="floating-shortcuts-btn"
        onClick={() => setIsOpen(true)}
        title="Keyboard Shortcuts (Press ?)"
      >
        <FiCommand />
      </button>

      {/* ✅ Modal Overlay */}
      {isOpen && (
        <div className="shortcuts-overlay" onClick={() => setIsOpen(false)}>
          <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
            <div className="shortcuts-header">
              <h3>
                <FiCommand />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setIsOpen(false)} className="btn-close">
                <FiX />
              </button>
            </div>

            <div className="shortcuts-body">
              {shortcuts.map((section) => (
                <div key={section.category} className="shortcut-section">
                  <h4>{section.category}</h4>
                  <div className="shortcut-list">
                    {section.items.map((item, index) => (
                      <div key={index} className="shortcut-item">
                        <div className="shortcut-keys">
                          {item.keys.map((key, i) => (
                            <React.Fragment key={i}>
                              <kbd>{key}</kbd>
                              {i < item.keys.length - 1 && <span>+</span>}
                            </React.Fragment>
                          ))}
                        </div>
                        <div className="shortcut-description">
                          {item.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="shortcuts-footer">
              <small>Press <kbd>?</kbd> to toggle this guide</small>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default KeyboardShortcutsGuide;
