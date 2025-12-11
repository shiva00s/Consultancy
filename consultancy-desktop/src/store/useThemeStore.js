// src/store/useThemeStore.js
import { create } from 'zustand';

const useThemeStore = create((set) => {
  // Get saved theme or default to system preference
  const savedTheme = localStorage.getItem('theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  
  // CRITICAL FIX: Apply theme IMMEDIATELY on store creation
  if (typeof document !== 'undefined') {
    document.body.dataset.theme = savedTheme;
  }
  
  return {
    theme: savedTheme,
    
    toggleTheme: () => set((state) => {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', newTheme);
      document.body.dataset.theme = newTheme;
      return { theme: newTheme };
    }),
    
    // NEW: Programmatic theme setter
    setTheme: (newTheme) => {
      if (newTheme !== 'dark' && newTheme !== 'light') return;
      localStorage.setItem('theme', newTheme);
      document.body.dataset.theme = newTheme;
      set({ theme: newTheme });
    }
  };
});

export default useThemeStore;
