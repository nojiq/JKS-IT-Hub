import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LdapSyncPanel from '../src/features/users/ldap-sync-panel.jsx';
import { ToastProvider } from '../src/shared/components/Toast/ToastProvider.jsx';
import { fetchLatestSync, triggerLdapSync } from '../src/features/users/ldap-sync-api.js';

vi.mock('../src/features/users/ldap-sync-api.js', () => ({
    fetchLatestSync: vi.fn(),
    triggerLdapSync: vi.fn(),
    getLdapSyncStreamUrl: () => 'http://localhost:3006/ldap/sync/stream'
}));

class EventSourceMock {
    static instances = [];

    constructor(url, options) {
        this.url = url;
        this.options = options;
        this.listeners = new Map();
        EventSourceMock.instances.push(this);
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener);
    }

    removeEventListener(type) {
        this.listeners.delete(type);
    }

    emit(type, data) {
        this.listeners.get(type)?.({ data: JSON.stringify(data) });
    }

    close() {}
}

const renderPanel = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    render(
        <MemoryRouter>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <LdapSyncPanel />
                </ToastProvider>
            </QueryClientProvider>
        </MemoryRouter>
    );

    return { queryClient, invalidateSpy };
};

describe('LdapSyncPanel', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        EventSourceMock.instances = [];
        global.EventSource = EventSourceMock;
    });

    it('auto-starts LDAP sync when latest sync is missing', async () => {
        fetchLatestSync.mockResolvedValue(null);
        triggerLdapSync.mockResolvedValue({
            run: {
                id: 'run-1',
                status: 'started',
                startedAt: '2026-05-11T08:00:00.000Z'
            }
        });

        renderPanel();

        await waitFor(() => {
            expect(triggerLdapSync).toHaveBeenCalledTimes(1);
        });
    });

    it('treats sync-in-progress conflicts as running state instead of visible errors', async () => {
        fetchLatestSync.mockResolvedValue(null);
        triggerLdapSync.mockRejectedValue(new Error('A sync process is currently in progress.'));

        renderPanel();

        await waitFor(() => {
            expect(triggerLdapSync).toHaveBeenCalledTimes(1);
        });
        expect(screen.queryByText('A sync process is currently in progress.')).not.toBeInTheDocument();
    });

    it('invalidates users and shows toast when completed sync creates users', async () => {
        fetchLatestSync.mockResolvedValue({
            id: 'run-1',
            status: 'started',
            startedAt: '2026-05-11T08:00:00.000Z'
        });
        triggerLdapSync.mockResolvedValue({});
        const { invalidateSpy } = renderPanel();

        await waitFor(() => {
            expect(EventSourceMock.instances.length).toBe(1);
        });

        act(() => {
            EventSourceMock.instances[0].emit('ldap.sync', {
                data: {
                    run: {
                        id: 'run-1',
                        status: 'completed',
                        startedAt: '2026-05-11T08:00:00.000Z',
                        completedAt: '2026-05-11T08:01:00.000Z',
                        createdCount: 2,
                        createdUsers: [
                            { id: 'u1', username: 'ali' },
                            { id: 'u2', username: 'sara' }
                        ],
                        createdUsersHasMore: false
                    }
                }
            });
        });

        await waitFor(() => {
            expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['users'] });
        });
        expect(await screen.findByText('2 new LDAP users synced')).toBeInTheDocument();
        expect(screen.getByText('ali, sara')).toBeInTheDocument();
    });
});
