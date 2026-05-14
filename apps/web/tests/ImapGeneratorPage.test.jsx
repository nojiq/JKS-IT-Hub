import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../src/shared/context/ThemeProvider';
import { WorkspaceLayout } from '../src/shared/workspace/WorkspaceLayout';
import { UsersLayout } from '../src/features/users/UsersLayout.jsx';
import ImapGeneratorPage from '../src/features/credentials/imap/ImapGeneratorPage.jsx';

vi.mock('../src/features/users/auth-api', () => ({
    fetchSession: vi.fn(),
    logout: vi.fn()
}));

vi.mock('../src/features/notifications/components/NotificationBell', () => ({
    NotificationBell: () => <div data-testid="notification-bell" />
}));

vi.mock('../src/features/users/users-api.js', () => ({
    fetchUsers: vi.fn(),
    fetchUserDetail: vi.fn(),
    updateUserProfileFields: vi.fn()
}));

vi.mock('../src/features/credentials/api/credentials.js', () => ({
    getImapWorkbench: vi.fn(),
    previewActualPassword: vi.fn(),
    saveImapPassword: vi.fn(),
    getPreviousImapPasswords: vi.fn()
}));

import { fetchSession } from '../src/features/users/auth-api';
import { fetchUsers } from '../src/features/users/users-api.js';
import {
    getImapWorkbench,
    saveImapPassword,
    getPreviousImapPasswords
} from '../src/features/credentials/api/credentials.js';

const renderApp = (initialEntry = '/users/imap-generator') => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    const router = createMemoryRouter([
        {
            path: '/',
            element: <WorkspaceLayout />,
            children: [
                { index: true, element: <div>Dashboard Content</div> },
                {
                    path: 'users',
                    element: <UsersLayout />,
                    children: [
                        { index: true, element: <div>Users Overview</div> },
                        { path: 'directory', element: <div>Directory Content</div> },
                        { path: 'imap-generator', element: <ImapGeneratorPage /> },
                        { path: 'credential-generator', element: <ImapGeneratorPage /> },
                        { path: 'history', element: <div>History Content</div> }
                    ]
                }
            ]
        }
    ], {
        initialEntries: [initialEntry]
    });

    render(
        <QueryClientProvider client={queryClient}>
            <ThemeProvider>
                <RouterProvider router={router} />
            </ThemeProvider>
        </QueryClientProvider>
    );
};

describe('ImapGeneratorPage (provider IMAP)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        fetchSession.mockResolvedValue({
            user: {
                id: 'user-1',
                username: 'alice.it',
                role: 'admin',
                status: 'active'
            }
        });

        getImapWorkbench.mockResolvedValue({
            data: {
                user: { id: 'user-42', username: 'abdullah.fauzi', status: 'active' },
                activeCredential: {
                    id: 'c1',
                    username: 'abdullah.fauzi@jkseng.com',
                    password: 'old'
                },
                previousPasswordsCount: 2
            }
        });

        fetchUsers.mockResolvedValue({
            users: [
                {
                    id: 'user-42',
                    username: 'abdullah.fauzi',
                    ldapFields: { cn: 'Abdullah Fauzi' }
                }
            ]
        });

        saveImapPassword.mockResolvedValue({
            data: {
                user: { id: 'user-42' },
                record: { id: 'cred-new', metadata: { mode: 'provider_recorded' } }
            }
        });

        getPreviousImapPasswords.mockResolvedValue({
            data: [
                { id: 'cred-1', username: 'a@b.com', metadata: { saveMode: 'active' } }
            ]
        });
    });

    it('shows provider recording instructions', async () => {
        renderApp('/users/imap-generator?userId=user-42');

        await waitFor(() => {
            expect(getImapWorkbench).toHaveBeenCalledWith('user-42');
        });

        expect(screen.getByText(/Record provider IMAP password/i)).toBeInTheDocument();
        expect(screen.getByText(/does not generate IMAP passwords/i)).toBeInTheDocument();
    });

    it('submits provider password for selected user', async () => {
        renderApp('/users/imap-generator');

        const search = await screen.findByPlaceholderText('Name or email');
        fireEvent.change(search, { target: { value: 'abd' } });

        await waitFor(() => {
            expect(fetchUsers).toHaveBeenCalled();
        });

        const suggestion = await screen.findByRole('button', { name: /Abdullah Fauzi/i });
        fireEvent.click(suggestion);

        await waitFor(() => {
            expect(getImapWorkbench).toHaveBeenCalledWith('user-42');
        });

        const passwordInput = screen.getByLabelText(/Provider password/i);
        fireEvent.change(passwordInput, { target: { value: 'HostIssued#99' } });

        fireEvent.click(screen.getByRole('button', { name: /Save IMAP password/i }));

        await waitFor(() => {
            expect(saveImapPassword).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: 'user-42',
                    password: 'HostIssued#99',
                    setActive: true
                })
            );
        });
    });
});
