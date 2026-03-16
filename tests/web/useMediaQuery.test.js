import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery, useIsMobile, useIsTablet, useIsDesktop } from '../../apps/web/src/shared/hooks/useMediaQuery.js';

describe('useMediaQuery Hook', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: vi.fn(), // Deprecated
                removeListener: vi.fn(), // Deprecated
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should return initial match state', () => {
        window.matchMedia.mockImplementation(query => ({
            matches: true,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }));

        const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
        expect(result.current).toBe(true);
    });

    it('should update when media query changes', () => {
        let changeCallback;
        const addEventListener = vi.fn((event, cb) => {
            if (event === 'change') changeCallback = cb;
        });

        window.matchMedia.mockImplementation(query => ({
            matches: false,
            media: query,
            addEventListener,
            removeEventListener: vi.fn(),
        }));

        const { result } = renderHook(() => useMediaQuery('(max-width: 767px)'));
        expect(result.current).toBe(false);

        act(() => {
            changeCallback({ matches: true });
        });

        expect(result.current).toBe(true);
    });

    it('should cleanup event listener on unmount', () => {
        const removeEventListener = vi.fn();
        window.matchMedia.mockImplementation(query => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener,
        }));

        const { unmount } = renderHook(() => useMediaQuery('(max-width: 767px)'));

        unmount();

        expect(removeEventListener).toHaveBeenCalled();
    });

    it('should re-subscribe when query changes', () => {
        const removeEventListener = vi.fn();
        window.matchMedia.mockImplementation(query => ({
            matches: false,
            media: query,
            addEventListener: vi.fn(),
            removeEventListener,
        }));

        const { rerender } = renderHook(
            ({ query }) => useMediaQuery(query),
            { initialProps: { query: '(max-width: 767px)' } }
        );

        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');

        // Change query
        rerender({ query: '(min-width: 768px)' });

        expect(removeEventListener).toHaveBeenCalled();
        expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
    });
});

describe('Convenience Hooks', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn().mockImplementation(query => ({
                matches: false,
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
    });

    it('useIsMobile should check max-width: 767px', () => {
        renderHook(() => useIsMobile());
        expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)');
    });

    it('useIsTablet should check tablet range', () => {
        renderHook(() => useIsTablet());
        expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 768px) and (max-width: 1023px)');
    });

    it('useIsDesktop should check min-width: 1024px', () => {
        renderHook(() => useIsDesktop());
        expect(window.matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    });
});
