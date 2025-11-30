import { useEffect, useCallback } from 'react';

/**
 * Register keyboard shortcuts
 * @param {Object} shortcuts - Map of key combos to callbacks
 * @param {Array} deps - Dependencies array
 */
export const useKeyboardShortcuts = (shortcuts, deps = []) => {
  const handleKeyDown = useCallback((event) => {
    const key = event.key.toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const alt = event.altKey;

    // Build shortcut string
    let shortcut = '';
    if (ctrl) shortcut += 'ctrl+';
    if (shift) shortcut += 'shift+';
    if (alt) shortcut += 'alt+';
    shortcut += key;

    // Check if shortcut exists
    if (shortcuts[shortcut]) {
      // Prevent default browser behavior
      event.preventDefault();
      event.stopPropagation();

      // Execute callback
      shortcuts[shortcut](event);
    }
  }, [shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, ...deps]);
};

/**
 * Global keyboard shortcuts
 */
export const useGlobalShortcuts = (navigate, user) => {
  useKeyboardShortcuts({
    // Navigation
    'ctrl+k': () => {
      // Focus search bar
      const searchInput = document.querySelector('input[type="text"]');
      if (searchInput) searchInput.focus();
    },
    'ctrl+h': () => navigate('/'),
    'ctrl+s': () => navigate('/search'),
    'ctrl+n': () => navigate('/add'),
    
    // Actions
    'escape': () => {
      // Close modals, dropdowns, etc.
      const closeButtons = document.querySelectorAll('[aria-label*="Close"], .btn-close');
      if (closeButtons.length > 0) {
        closeButtons[0].click();
      }
    },
    
    // Admin only
    ...(user?.role === 'super_admin' && {
      'ctrl+shift+b': () => navigate('/backup-settings'),
      'ctrl+shift+s': () => navigate('/settings'),
    }),
  }, [navigate, user]);
};
export default { useKeyboardShortcuts, useGlobalShortcuts };