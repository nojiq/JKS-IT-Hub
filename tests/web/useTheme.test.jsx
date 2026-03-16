import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTheme } from '../../apps/web/src/shared/hooks/useTheme';

describe('useTheme Hook', () => {
    const localStorageMock = (function () {
        let store = {};
        return {
            getItem: vi.fn((key) => store[key] || null),
            setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
            clear: vi.fn(() => { store = {}; }),
            removeItem: vi.fn((key) => { delete store[key]; })
        };
    })();

    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', { value: localStorageMock });
        localStorageMock.clear();
        document.documentElement.removeAttribute('data-theme');

        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(),
                removeListener: vi.fn(),
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should initialize with default light theme when no preference stored', () => {
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('light');
        expect(result.current.isDark).toBe(false);
    });

    it('should toggle theme from light to dark', () => {
        const { result } = renderHook(() => useTheme());

        act(() => {
            result.current.toggleTheme();
        });

        expect(result.current.theme).toBe('dark');
        expect(result.current.isDark).toBe(true);
        expect(localStorageMock.setItem).toHaveBeenCalledWith('it-hub-theme', 'dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    });

    it('should initialize from localStorage if present', () => {
        localStorageMock.getItem.mockReturnValue('dark');
        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('dark');
    });

    it('should detect system preference if no localStorage value', () => {
        window.matchMedia.mockImplementation(query => ({
            matches: query === '(prefers-color-scheme: dark)',
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        const { result } = renderHook(() => useTheme());
        expect(result.current.theme).toBe('dark');
    });
});
