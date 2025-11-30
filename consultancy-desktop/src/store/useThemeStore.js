// src/store/useThemeStore.js
import { create } from 'zustand';

const useThemeStore = create((set) => ({
  theme: localStorage.getItem('theme') || 
         (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'),
  
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    document.body.dataset.theme = newTheme;
    return { theme: newTheme };
  }),
}));
export default useThemeStore;