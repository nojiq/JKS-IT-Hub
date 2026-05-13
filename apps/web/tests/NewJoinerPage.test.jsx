import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewJoinerPage } from '../src/features/onboarding/pages/NewJoinerPage.jsx';
import { ToastProvider } from '../src/shared/components/Toast/ToastProvider.jsx';

vi.mock('../src/features/onboarding/onboarding-api.js', () => ({
    fetchCatalogItems: vi.fn(),
    fetchDepartmentBundles: vi.fn(),
    fetchPulseOrgHierarchy: vi.fn(),
    previewOnboardingSetup: vi.fn(),
    confirmOnboardingSetup: vi.fn(),
    fetchUsersForOnboarding: vi.fn(),
    fetchOnboardingDrafts: vi.fn(),
    linkAndPromoteOnboardingDraft: vi.fn()
}));

vi.mock('../src/features/credentials/api/credentials.js', () => ({
    previewActualPassword: vi.fn(),
    previewImapPassword: vi.fn()
}));

import {
    confirmOnboardingSetup,
    fetchCatalogItems,
    fetchOnboardingDrafts,
    fetchDepartmentBundles,
    fetchPulseOrgHierarchy,
    fetchUsersForOnboarding,
    linkAndPromoteOnboardingDraft,
    previewOnboardingSetup
} from '../src/features/onboarding/onboarding-api.js';
import { previewActualPassword, previewImapPassword } from '../src/features/credentials/api/credentials.js';

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false, gcTime: 0 }
        }
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <NewJoinerPage />
            </ToastProvider>
        </QueryClientProvider>
    );
};

describe('NewJoinerPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window.navigator, 'clipboard', {
            configurable: true,
            value: {
                writeText: vi.fn().mockResolvedValue()
            }
        });

        fetchCatalogItems.mockResolvedValue([
            { id: 'sigma', itemKey: 'sigma', label: 'Sigma', loginUrl: 'https://sigma.example', notes: 'Analytics app' },
            { id: 'basecamp', itemKey: 'basecamp', label: 'Basecamp', loginUrl: 'https://basecamp.example', notes: 'Project app' },
            { id: 'canva', itemKey: 'canva', label: 'Canva', loginUrl: 'https://canva.example', notes: 'Marketing design' }
        ]);

        fetchDepartmentBundles.mockResolvedValue([
            { id: 'marketing', department: 'Marketing', catalogItemKeys: ['canva', 'basecamp'], isActive: true },
            { id: 'bd', department: 'Business Development', catalogItemKeys: ['sigma'], isActive: true }
        ]);

        fetchPulseOrgHierarchy.mockResolvedValue({
            enabled: true,
            divisions: [{ id: 'div-corp', name: 'Corporate' }],
            departments: [
                { id: 'dept-mkt', divisionId: 'div-corp', name: 'Marketing' },
                { id: 'dept-bd', divisionId: 'div-corp', name: 'Business Development' }
            ],
            sections: [{ id: 'sec-1', departmentId: 'dept-mkt', name: 'Brand' }]
        });

        previewActualPassword.mockResolvedValue({
            data: {
                password: 'DeterministicPreview#1',
                metadata: { mode: 'yahoo-actual' }
            }
        });

        previewImapPassword.mockResolvedValue({
            data: {
                proposedCredential: {
                    username: 'haziq.afendi',
                    password: 'ImapPreview#1'
                }
            }
        });

        fetchUsersForOnboarding.mockResolvedValue([
            {
                id: 'user-1',
                username: 'haziq.afendi',
                displayName: 'Haziq Afendi',
                email: 'haziq.afendi@jkseng.com',
                department: 'Business Development',
                pulseOrg: {
                    division: 'Corporate',
                    department: 'Business Development',
                    section: 'Field Ops'
                }
            }
        ]);

        fetchOnboardingDrafts.mockResolvedValue([
            {
                id: 'draft-1',
                fullName: 'Haziq Afendi',
                email: 'haziq.afendi@jkseng.com',
                department: 'Business Development',
                dob: '1995-06-15',
                createdAt: '2026-03-14T09:30:00.000Z',
                linkedUserId: null,
                linkedAt: null,
                status: 'draft',
                selectedCatalogItemKeys: ['sigma'],
                setupSheet: {
                    entries: [
                        {
                            systemId: 'sigma',
                            label: 'Sigma',
                            loginUrl: 'https://sigma.example',
                            username: 'haziq.afendi',
                            password: 'Haziqafendi@7189',
                            notes: 'Analytics app'
                        }
                    ]
                }
            }
        ]);

        previewOnboardingSetup.mockResolvedValue({
            previewToken: 'preview-1',
            recommendedItemKeys: ['sigma'],
            setupSheet: {
                entries: [
                    {
                        systemId: 'sigma',
                        label: 'Sigma',
                        loginUrl: 'https://sigma.example',
                        username: 'haziq.afendi',
                        password: 'Haziqafendi@7189',
                        notes: 'Analytics app'
                    }
                ]
            }
        });

        confirmOnboardingSetup.mockResolvedValue({
            draftId: 'draft-1',
            setupSheet: {
                entries: [
                    {
                        systemId: 'sigma',
                        label: 'Sigma',
                        loginUrl: 'https://sigma.example',
                        username: 'haziq.afendi',
                        password: 'Haziqafendi@7189',
                        notes: 'Analytics app'
                    }
                ]
            }
        });

        linkAndPromoteOnboardingDraft.mockResolvedValue({
            draft: {
                id: 'draft-1',
                status: 'completed',
                linkedUserId: 'user-1',
                linkedAt: '2026-03-14T10:15:00.000Z'
            },
            targetUser: {
                id: 'user-1',
                username: 'haziq.afendi'
            },
            promotedCredentials: [
                {
                    systemId: 'sigma',
                    username: 'haziq.afendi'
                }
            ]
        });
    });

    it('derives Active Directory value from work email', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'abu.ali' } });

        expect(screen.getByLabelText('Active Directory (samAccountName)')).toHaveValue('Abuali@7189');
    });

    it('shows a fixed JKS email domain while storing the full work email', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Haziq Afendi' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'haziq.afendi' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1995-06-15' } });

        expect(screen.getByLabelText('Work email (required)')).toHaveValue('haziq.afendi');
        expect(screen.getByText('@jkseng.com')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Preview setup sheet' }));

        await waitFor(() => {
            expect(previewOnboardingSetup.mock.calls[0][0]).toEqual(
                expect.objectContaining({
                    manualIdentity: expect.objectContaining({
                        email: 'haziq.afendi@jkseng.com'
                    })
                })
            );
        });
    });

    it('strips the JKS domain when a full work email is pasted', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Work email (required)'), {
            target: { value: 'haziq.afendi@jkseng.com' }
        });

        expect(screen.getByLabelText('Work email (required)')).toHaveValue('haziq.afendi');
        expect(screen.queryByText('Only @jkseng.com email addresses are allowed.')).not.toBeInTheDocument();
    });

    it('warns when a pasted work email uses another domain', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Work email (required)'), {
            target: { value: 'haziq.afendi@example.com' }
        });

        expect(screen.getByLabelText('Work email (required)')).toHaveValue('haziq.afendi');
        expect(screen.getByText('Only @jkseng.com email addresses are allowed.')).toBeInTheDocument();
    });

    it('shows a live IMAP app password preview based on identity and Yahoo temporary password', async () => {
        previewImapPassword.mockImplementation(async (payload) => ({
            data: {
                proposedCredential: {
                    username: 'haziq.afendi',
                    password: payload.inputs.temporaryPassword === 'TempYahoo#2' ? 'ImapPreview#2' : 'ImapPreview#1'
                }
            }
        }));

        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Haziq Afendi' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'haziq.afendi' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1995-06-15' } });
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'TempYahoo#1' } });

        await waitFor(() => {
            expect(previewImapPassword.mock.calls[0][0]).toEqual(
                expect.objectContaining({
                    manualIdentity: expect.objectContaining({
                        email: 'haziq.afendi@jkseng.com'
                    }),
                    inputs: expect.objectContaining({
                        email: 'haziq.afendi@jkseng.com',
                        fullName: 'Haziq Afendi',
                        dob: '1995-06-15',
                        temporaryPassword: 'TempYahoo#1'
                    }),
                    selectedFields: expect.objectContaining({
                        email: true,
                        fullName: true,
                        dob: true,
                        temporaryPassword: true
                    })
                })
            );
        });

        expect(await screen.findByLabelText('IMAP app password')).toHaveValue('ImapPreview#1');
        expect(screen.queryByRole('button', { name: /Generate IMAP password/ })).not.toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'TempYahoo#2' } });

        await waitFor(() => {
            expect(previewImapPassword.mock.calls.at(-1)[0].inputs.temporaryPassword).toBe('TempYahoo#2');
            expect(screen.getByLabelText('IMAP app password')).toHaveValue('ImapPreview#2');
        });
    });

    it('fills actual password from live preview as inputs change', async () => {
        renderPage();

        await waitFor(
            () => {
                expect(screen.getByLabelText('Actual password')).toHaveValue('DeterministicPreview#1');
            },
            { timeout: 3000 }
        );

        const callsBefore = previewActualPassword.mock.calls.length;
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'temp-vendor' } });

        await waitFor(() => {
            expect(previewActualPassword.mock.calls.length).toBeGreaterThan(callsBefore);
        });
    });

    it('auto-selects recommended apps from the chosen department and keeps them editable', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Application access' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Onboarding package' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Draft recovery' })).toBeInTheDocument();
        expect(await screen.findByLabelText('Division (JKSPulse, optional)')).toBeInTheDocument();
        expect(await screen.findByRole('option', { name: 'Marketing' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Division (JKSPulse, optional)'), {
            target: { value: 'div-corp' }
        });
        fireEvent.change(screen.getByLabelText('Department (JKSPulse, optional)'), {
            target: { value: 'dept-mkt' }
        });

        await waitFor(() => {
            expect(screen.getByLabelText('Canva')).toBeChecked();
            expect(screen.getByLabelText('Basecamp')).toBeChecked();
        });

        fireEvent.click(screen.getByLabelText('Basecamp'));
        expect(screen.getByLabelText('Basecamp')).not.toBeChecked();
    });

    it('requires only name, work email, and date of birth before Preview setup sheet (manual)', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Add New User' })).toBeInTheDocument();

        const previewBtn = screen.getByRole('button', { name: 'Preview setup sheet' });
        const addBtn = screen.getByRole('button', { name: 'Add User' });
        expect(previewBtn).toBeDisabled();
        expect(addBtn).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user@jkseng.com' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });

        expect(previewBtn).not.toBeDisabled();
        expect(addBtn).not.toBeDisabled();
    });

    it('previews and saves when Add User is clicked before manual preview', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });

        fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

        await waitFor(() => {
            expect(previewOnboardingSetup).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'manual',
                    manualIdentity: expect.objectContaining({
                        fullName: 'Test User',
                        email: 'test.user@jkseng.com',
                        dob: '1998-04-30'
                    })
                }),
                expect.anything()
            );
            expect(confirmOnboardingSetup.mock.calls[0][0]).toEqual({
                confirmed: true,
                previewToken: 'preview-1'
            });
        });

        expect(await screen.findByText('User added')).toBeInTheDocument();
        expect(screen.getByText('The onboarding draft was saved successfully.')).toBeInTheDocument();
    });

    it('shows a failed Add User toast with the backend reason', async () => {
        previewOnboardingSetup.mockRejectedValueOnce(new Error('No catalog items configured for onboarding'));

        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });

        fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

        expect(await screen.findByText('Add user failed')).toBeInTheDocument();
        expect(screen.getAllByText('No catalog items configured for onboarding').length).toBeGreaterThan(0);
        expect(confirmOnboardingSetup).not.toHaveBeenCalled();
    });

    it('builds a setup sheet for an existing user based on department bundle defaults', async () => {
        renderPage();

        fireEvent.click(screen.getByRole('radio', { name: 'Directory user' }));
        await screen.findByLabelText('Linked account');
        expect(await screen.findByRole('option', { name: 'Haziq Afendi' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Linked account'), { target: { value: 'user-1' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Sigma')).toBeChecked();
        });

        expect(document.getElementById('nj-pulse-division')).toHaveTextContent('Corporate');
        expect(document.getElementById('nj-pulse-section')).toHaveTextContent('Field Ops');

        fireEvent.click(screen.getByRole('button', { name: 'Preview setup sheet' }));

        expect(await screen.findByText('Haziqafendi@7189')).toBeInTheDocument();
        expect(screen.getByText('https://sigma.example')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

        await waitFor(() => {
            expect(confirmOnboardingSetup).toHaveBeenCalled();
            expect(confirmOnboardingSetup.mock.calls[0][0]).toEqual({
                confirmed: true,
                previewToken: 'preview-1'
            });
        });
    });

    it('allows existing-user preview without selected apps', async () => {
        renderPage();

        fireEvent.click(screen.getByRole('radio', { name: 'Directory user' }));
        await screen.findByLabelText('Linked account');
        expect(await screen.findByRole('option', { name: 'Haziq Afendi' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Linked account'), { target: { value: 'user-1' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Sigma')).toBeChecked();
        });

        fireEvent.click(screen.getByLabelText('Sigma'));
        expect(screen.getByLabelText('Sigma')).not.toBeChecked();

        const previewBtn = screen.getByRole('button', { name: 'Preview setup sheet' });
        expect(previewBtn).not.toBeDisabled();

        fireEvent.click(previewBtn);

        await waitFor(() => {
            expect(previewOnboardingSetup.mock.calls[0][0]).toEqual(
                expect.objectContaining({
                    mode: 'existing_user',
                    userId: 'user-1',
                    selectedCatalogItemKeys: []
                })
            );
        });
    });

    it('renders saved drafts, opens a draft into the form, copies the setup sheet, and links it to a directory user', async () => {
        fetchOnboardingDrafts
            .mockResolvedValueOnce([
                {
                    id: 'draft-1',
                    fullName: 'Haziq Afendi',
                    email: 'haziq.afendi@jkseng.com',
                    department: 'Business Development',
                    dob: '1995-06-15',
                    createdAt: '2026-03-14T09:30:00.000Z',
                    linkedUserId: null,
                    linkedAt: null,
                    status: 'draft',
                    selectedCatalogItemKeys: ['sigma'],
                    setupSheet: {
                        entries: [
                            {
                                systemId: 'sigma',
                                label: 'Sigma',
                                loginUrl: 'https://sigma.example',
                                username: 'haziq.afendi',
                                password: 'Haziqafendi@7189',
                                notes: 'Analytics app'
                            }
                        ]
                    }
                }
            ])
            .mockResolvedValueOnce([
                {
                    id: 'draft-1',
                    fullName: 'Haziq Afendi',
                    email: 'haziq.afendi@jkseng.com',
                    department: 'Business Development',
                    dob: '1995-06-15',
                    createdAt: '2026-03-14T09:30:00.000Z',
                    linkedUserId: 'user-1',
                    linkedAt: '2026-03-14T10:15:00.000Z',
                    status: 'completed',
                    selectedCatalogItemKeys: ['sigma'],
                    setupSheet: {
                        entries: [
                            {
                                systemId: 'sigma',
                                label: 'Sigma',
                                loginUrl: 'https://sigma.example',
                                username: 'haziq.afendi',
                                password: 'Haziqafendi@7189',
                                notes: 'Analytics app'
                            }
                        ]
                    }
                }
            ]);

        renderPage();

        expect(await screen.findByRole('heading', { name: 'Draft recovery' })).toBeInTheDocument();
        expect(await screen.findByText((content) => content.includes('haziq.afendi@jkseng.com'))).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open draft' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Name (required)')).toHaveValue('Haziq Afendi');
            expect(screen.getByLabelText('Work email (required)')).toHaveValue('haziq.afendi');
            expect(screen.getByLabelText(/Date of birth/)).toHaveValue('1995-06-15');
            expect(screen.getByLabelText('Sigma')).toBeChecked();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Copy setup sheet' }));

        await waitFor(() => {
            expect(window.navigator.clipboard.writeText).toHaveBeenCalled();
            expect(window.navigator.clipboard.writeText.mock.calls[0][0]).toContain('Sigma');
            expect(window.navigator.clipboard.writeText.mock.calls[0][0]).toContain('Haziqafendi@7189');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Link to directory user' }));
        fireEvent.change(screen.getByLabelText('Link draft to user'), { target: { value: 'user-1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm link & promote' }));

        await waitFor(() => {
            expect(linkAndPromoteOnboardingDraft).toHaveBeenCalledWith('draft-1', 'user-1');
        });

        expect(await screen.findByText('Completed')).toBeInTheDocument();
    });
});
