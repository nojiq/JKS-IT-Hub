import { useThemeContext } from '../../context/ThemeProvider';
import './ThemeToggle.css';

export function ThemeToggle() {
    const { isDark, toggleTheme } = useThemeContext();

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        >
            {isDark ? (
                // Sun icon for light mode (show sun when currently dark, meaning "switch to light"?)
                // Usually: show icon representing the *current* state or the *target* state?
                // AC says: "And the toggle icon updates to reflect the new state".
                // Usually, sun icon means "Light Mode" is active OR "Switch to Light Mode".
                // Let's follow standard: Show Sun when in Dark Mode (to switch to light), Moon when in Light Mode (to switch to dark).
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="theme-toggle-icon">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
            ) : (
                // Moon icon for dark mode (show moon when currently light)
                <svg viewBox="0 0 24 24" fill="currentColor" className="theme-toggle-icon">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
            )}
        </button>
    );
}
