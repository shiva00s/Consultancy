import { useEffect, useRef, useCallback } from 'react';
import { useDebounce } from './useDebounce';

/**
 * Auto-save form data with debouncing
 * @param {Object} data - Form data to save
 * @param {Function} saveFn - Save function
 * @param {number} delay - Debounce delay in ms
 * @param {boolean} enabled - Enable/disable auto-save
 */
export const useAutoSave = (data, saveFn, delay = 2000, enabled = true) => {
  const debouncedData = useDebounce(data, delay);
  const initialRender = useRef(true);
  const lastSaved = useRef(null);

  useEffect(() => {
    // Skip on initial render
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }

    // Skip if auto-save is disabled
    if (!enabled) return;

    // Skip if data hasn't changed
    if (JSON.stringify(debouncedData) === JSON.stringify(lastSaved.current)) {
      return;
    }

    // Save data
    const save = async () => {
      try {
        await saveFn(debouncedData);
        lastSaved.current = debouncedData;
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    };

    save();
  }, [debouncedData, saveFn, enabled]);

  // Manual save function
  const saveNow = useCallback(async () => {
    try {
      await saveFn(data);
      lastSaved.current = data;
      return { success: true };
    } catch (error) {
      console.error('Manual save failed:', error);
      return { success: false, error: error.message };
    }
  }, [data, saveFn]);

  return { saveNow };
};
export default useAutoSave;