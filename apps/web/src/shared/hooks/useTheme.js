import { useState, useEffect } from 'react';

const THEME_STORAGE_KEY = 'it-hub-theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

/**
 * Custom hook for theme management
 * Handles localStorage persistence and system preference detection
 */
export function useTheme() {
    // Initialize from localStorage or system preference
    const [theme, setTheme] = useState(() => {
        // Check if running in browser environment
        if (typeof window === 'undefined') return THEME_LIGHT;

        const saved = localStorage.getItem(THEME_STORAGE_KEY);
        if (saved === THEME_LIGHT || saved === THEME_DARK) {
            return saved;
        }

        // Detect system dark mode preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return THEME_DARK;
        }

        return THEME_LIGHT;
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;

        // Apply theme to document root
        document.documentElement.setAttribute('data-theme', theme);

        // Persist to localStorage
        localStorage.setItem(THEME_STORAGE_KEY, theme);
    }, [theme]);

    // Listen for system preference changes
    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return;

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = (e) => {
            // Only auto-switch if user hasn't manually set a preference
            const hasManualPreference = localStorage.getItem(THEME_STORAGE_KEY);
            if (!hasManualPreference) {
                setTheme(e.matches ? THEME_DARK : THEME_LIGHT);
            }
        };

        // Modern browsers
        mediaQuery.addEventListener('change', handleChange);

        return () => {
            mediaQuery.removeEventListener('change', handleChange);
        };
    }, []);

    const toggleTheme = () => {
        setTheme((current) => (current === THEME_LIGHT ? THEME_DARK : THEME_LIGHT));
    };

    return { theme, toggleTheme, isDark: theme === THEME_DARK };
}
