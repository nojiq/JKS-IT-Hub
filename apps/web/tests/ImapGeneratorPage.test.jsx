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

vi.mock('../src/features/credentials/api/credentials.js', () => ({
    getImapWorkbench: vi.fn(),
    previewImapPassword: vi.fn(),
    saveImapPassword: vi.fn(),
    getPreviousImapPasswords: vi.fn(),
    reviewImapConflicts: vi.fn()
}));

import { fetchSession } from '../src/features/users/auth-api';
import {
    getImapWorkbench,
    previewImapPassword,
    saveImapPassword
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
                        { path: 'locked', element: <div>Locked Credentials Content</div> },
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

describe('ImapGeneratorPage', () => {
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
            subjectKey: 'user-42',
            fields: {
                email: { value: 'abdullah.fauzi@jkseng.com', source: 'ldap' },
                firstName: { value: 'Abdullah', source: 'ldap' },
                lastName: { value: 'Fauzi', source: 'ldap' },
                fullName: { value: 'Abu', source: 'system' },
                dob: { value: '2021-01-21', source: 'empty' },
                phone: { value: '123', source: 'system' }
            }
        });

        previewImapPassword.mockResolvedValue({
            proposedCredential: {
                username: 'abdullah.fauzi@jkseng.com',
                password: 'StablePass123456'
            },
            metadata: {
                subjectKey: 'user-42',
                selectedFields: ['phone'],
                sources: {
                    email: 'ldap',
                    firstName: 'ldap',
                    lastName: 'ldap',
                    fullName: 'manual',
                    dob: 'manual',
                    phone: 'manual'
                }
            }
        });

        saveImapPassword.mockResolvedValue({
            record: {
                id: 'cred-1',
                isActive: false
            }
        });
    });

    it('renders the IMAP generator route inside the users module shell', async () => {
        renderApp();

        expect(await screen.findByRole('heading', { name: 'Users & Credentials' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'IMAP Generator' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'IMAP Generator' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'User Resolver' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Live Preview' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save IMAP Password' })).toBeInTheDocument();
    });

    it('reads the attached user from the query string', async () => {
        renderApp('/users/imap-generator?userId=user-42');

        expect(await screen.findByRole('heading', { name: 'IMAP Generator' })).toBeInTheDocument();
        expect(screen.getByText('Attached user: user-42')).toBeInTheDocument();
    });

    it('shows manual identity fields and blocks save until they are filled', async () => {
        renderApp();

        expect(await screen.findByRole('heading', { name: 'IMAP Generator' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Manual Entry' }));

        expect(screen.getByRole('textbox', { name: 'Manual Full Name' })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: 'Manual Email' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Create User' })).toBeInTheDocument();

        const saveButton = screen.getByRole('button', { name: 'Save IMAP Password' });
        expect(saveButton).toBeDisabled();

        fireEvent.change(screen.getByRole('textbox', { name: 'Manual Full Name' }), {
            target: { value: 'Abu' }
        });
        fireEvent.change(screen.getByRole('textbox', { name: 'Manual Email' }), {
            target: { value: 'abu@example.com' }
        });

        expect(saveButton).not.toBeDisabled();
    });

    it('loads source-aware field values for a preselected user', async () => {
        renderApp('/users/imap-generator?userId=user-42');

        expect(await screen.findByDisplayValue('abdullah.fauzi@jkseng.com')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Abdullah')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Abu')).toBeInTheDocument();
        expect(screen.getAllByText('LDAP').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('SYSTEM').length).toBeGreaterThanOrEqual(1);
    });

    it('flips an ldap-derived field to SYSTEM after manual edit', async () => {
        renderApp('/users/imap-generator?userId=user-42');

        expect(await screen.findByDisplayValue('Abdullah')).toBeInTheDocument();
        const beforeSystemCount = screen.getAllByText('SYSTEM').length;

        fireEvent.change(screen.getByRole('textbox', { name: 'First Name' }), {
            target: { value: 'Abu' }
        });

        await waitFor(() => {
            expect(screen.getAllByText('SYSTEM').length).toBe(beforeSystemCount + 1);
        });
    });

    it('requests a live preview when a selected field changes', async () => {
        renderApp('/users/imap-generator?userId=user-42');

        expect(await screen.findByDisplayValue('123')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('checkbox', { name: 'Use' })[5]);
        fireEvent.change(screen.getByRole('textbox', { name: 'Phone' }), {
            target: { value: '999' }
        });

        await waitFor(() => {
            expect(previewImapPassword).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-42',
                selectedFields: expect.objectContaining({
                    phone: true
                }),
                inputs: expect.objectContaining({
                    phone: '999'
                })
            }));
        });

        expect(screen.getByText('StablePass123456')).toBeInTheDocument();
    });

    it('saves the current generator state', async () => {
        renderApp('/users/imap-generator?userId=user-42');

        expect(await screen.findByDisplayValue('123')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('checkbox', { name: 'Use' })[5]);
        fireEvent.change(screen.getByRole('textbox', { name: 'Phone' }), {
            target: { value: '999' }
        });
        fireEvent.click(screen.getByRole('button', { name: 'Save IMAP Password' }));

        await waitFor(() => {
            expect(saveImapPassword).toHaveBeenCalledWith(expect.objectContaining({
                userId: 'user-42',
                inputs: expect.objectContaining({
                    phone: '999'
                })
            }));
        });
    });
});
