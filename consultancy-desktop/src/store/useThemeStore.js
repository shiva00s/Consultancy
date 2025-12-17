import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'dark',
      isDark: true,
      systemTheme: 'dark',
      toggleTheme: () => {
        const current = get().theme;
        const nextTheme = current === 'dark' ? 'light' : 'dark';
        set({ theme: nextTheme, isDark: nextTheme === 'dark' });
        document.body.dataset.theme = nextTheme;
        document.documentElement.style.setProperty('--transition-duration', '150ms');
      },
      setSystemTheme: (theme) => set({ systemTheme: theme }),
      syncSystemTheme: () => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        const theme = mediaQuery.matches ? 'dark' : 'light';
        set({ systemTheme: theme });
        if (get().theme === 'system') {
          set({ theme, isDark: theme === 'dark' });
          document.body.dataset.theme = theme;
        }
      },
      setTheme: (theme) => {
        set({ theme, isDark: theme === 'dark' });
        document.body.dataset.theme = theme;
      },
    }),
    {
      name: 'consultancy-theme',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

// Auto-sync system theme changes
if (typeof window !== 'undefined') {
  useThemeStore.persist.onFinishHydration(() => {
    const store = useThemeStore.getState();
    store.syncSystemTheme();
    
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => store.setSystemTheme(e.matches ? 'dark' : 'light');
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  });
}

export default useThemeStore;
