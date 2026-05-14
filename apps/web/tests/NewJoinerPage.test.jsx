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
    fetchUsersForOnboarding: vi.fn()
}));

vi.mock('../src/features/credentials/api/credentials.js', () => ({
    previewActualPassword: vi.fn()
}));

import {
    confirmOnboardingSetup,
    fetchCatalogItems,
    fetchDepartmentBundles,
    fetchPulseOrgHierarchy,
    fetchUsersForOnboarding,
    previewOnboardingSetup
} from '../src/features/onboarding/onboarding-api.js';
import { previewActualPassword } from '../src/features/credentials/api/credentials.js';

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
            userId: 'user-new',
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
    });

    it('offers all category classification options', () => {
        renderPage();

        const categorySelect = screen.getByLabelText('Category');

        expect(Array.from(categorySelect.options).map((option) => option.value)).toEqual([
            '',
            'Staff',
            'Group',
            'Partner',
            'Unknown'
        ]);
    });

    it('derives Active Directory value from work email', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'abu.ali' } });

        expect(screen.getByLabelText('Active Directory')).toHaveValue('Abuali@7189');
    });

    it('shows a fixed JKS email domain while storing the full work email', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Haziq Afendi' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'haziq.afendi' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1995-06-15' } });
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'TempYahoo#1' } });

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

    it('fills actual password from live preview as inputs change', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'temp-vendor' } });

        await waitFor(
            () => {
                expect(screen.getByLabelText('Actual password')).toHaveValue('DeterministicPreview#1');
            },
            { timeout: 3000 }
        );

        const callsBefore = previewActualPassword.mock.calls.length;
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'temp-vendor-2' } });

        await waitFor(() => {
            expect(previewActualPassword.mock.calls.length).toBeGreaterThan(callsBefore);
        });
    });

    it('updates the visible actual password while name, email, and Yahoo temp are still being typed', async () => {
        previewActualPassword.mockImplementation(async (payload) => ({
            data: {
                password: [
                    payload.fullName || 'blank-name',
                    payload.email || 'blank-email',
                    payload.temporaryPassword || 'blank-temp'
                ].join('|'),
                metadata: { mode: 'yahoo-actual' }
            }
        }));

        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Live User' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('Live User|blank-email|blank-temp');
        });

        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'live.user' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('Live User|live.user@jkseng.com|blank-temp');
        });

        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), {
            target: { value: 'TypingYahoo#1' }
        });

        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('Live User|live.user@jkseng.com|TypingYahoo#1');
        });
    });

    it('uses pasted Yahoo temporary password text for the visible actual password preview', async () => {
        previewActualPassword.mockImplementation(async (payload) => ({
            data: {
                password: payload.temporaryPassword === 'PastedYahoo#1'
                    ? 'ActualFromPaste#1'
                    : 'UnexpectedPreview#1',
                metadata: { mode: 'yahoo-actual' }
            }
        }));

        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Paste User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'paste.user' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), {
            target: { value: 'PastedYahoo#1' }
        });

        await waitFor(() => {
            expect(previewActualPassword).toHaveBeenCalledWith(
                expect.objectContaining({
                    temporaryPassword: 'PastedYahoo#1'
                })
            );
            expect(screen.getByLabelText('Actual password')).toHaveValue('ActualFromPaste#1');
        });
    });

    it('auto-selects recommended apps from the chosen department and keeps them editable', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Application access' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Onboarding package' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Draft recovery' })).not.toBeInTheDocument();
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

    it('requires identity fields and Yahoo temp before preview, actual password, and Add User (manual)', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Add New User' })).toBeInTheDocument();

        const previewBtn = screen.getByRole('button', { name: 'Preview setup sheet' });
        const addBtn = screen.getByRole('button', { name: 'Add User' });
        expect(previewBtn).toBeDisabled();
        expect(addBtn).toBeDisabled();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user@jkseng.com' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });

        expect(previewBtn).toBeDisabled();
        expect(addBtn).toBeDisabled();
        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('DeterministicPreview#1');
        });

        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'TempYahoo#1' } });

        expect(previewBtn).not.toBeDisabled();
        expect(addBtn).toBeDisabled();
        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('DeterministicPreview#1');
            expect(addBtn).not.toBeDisabled();
        });
    });

    it('previews and saves when Add User is clicked before manual preview', async () => {
        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'TempYahoo#1' } });
        fireEvent.change(await screen.findByLabelText('Division (JKSPulse, optional)'), {
            target: { value: 'div-corp' }
        });
        fireEvent.change(screen.getByLabelText('Department (JKSPulse, optional)'), {
            target: { value: 'dept-mkt' }
        });
        fireEvent.change(screen.getByLabelText('Section (JKSPulse, optional)'), {
            target: { value: 'sec-1' }
        });
        fireEvent.change(screen.getByLabelText(/Android password/), { target: { value: 'Android#1' } });
        fireEvent.change(screen.getByLabelText(/iPhone mail/), { target: { value: 'iPhone Mail OK' } });
        fireEvent.change(screen.getByLabelText(/iPad mail/), { target: { value: 'iPad Mail OK' } });
        fireEvent.change(screen.getByLabelText(/Mac mail/), { target: { value: 'Mac Mail OK' } });
        fireEvent.change(screen.getByLabelText(/Outlook iOS/), { target: { value: 'Outlook iOS OK' } });
        fireEvent.change(screen.getByLabelText(/Outlook Android/), { target: { value: 'Outlook Android OK' } });
        fireEvent.change(screen.getByLabelText('Outlook desktop'), { target: { value: 'Outlook Desktop OK' } });
        fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Active' } });
        fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Staff' } });
        fireEvent.change(screen.getByLabelText(/Remarks/), { target: { value: 'Ready for onboarding' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('DeterministicPreview#1');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Add User' }));

        await waitFor(() => {
            expect(previewOnboardingSetup).toHaveBeenCalledWith(
                expect.objectContaining({
                    mode: 'manual',
                    manualIdentity: expect.objectContaining({
                        fullName: 'Test User',
                        email: 'test.user@jkseng.com',
                        dob: '1998-04-30',
                        pulseOrg: {
                            division: { id: 'div-corp', name: 'Corporate' },
                            department: { id: 'dept-mkt', name: 'Marketing' },
                            section: { id: 'sec-1', name: 'Brand' }
                        }
                    }),
                    supplementalCredentials: expect.objectContaining({
                        actualPassword: 'DeterministicPreview#1',
                        profileFields: {
                            name: 'Test User',
                            email: 'test.user@jkseng.com',
                            date: '1998-04-30',
                            'temporary-password': 'TempYahoo#1',
                            'actual-password': 'DeterministicPreview#1',
                            'android-password': 'Android#1',
                            'iphone-mail': 'iPhone Mail OK',
                            'ipad-mail': 'iPad Mail OK',
                            'mac-mail': 'Mac Mail OK',
                            'outlook-ios': 'Outlook iOS OK',
                            'outlook-android': 'Outlook Android OK',
                            'outlook-desktop': 'Outlook Desktop OK',
                            'active-directory': 'Testuser@7189',
                            status: 'Active',
                            category: 'Staff',
                            remarks: 'Ready for onboarding'
                        }
                    })
                }),
                expect.anything()
            );
            expect(previewOnboardingSetup.mock.calls[0][0].supplementalCredentials).not.toHaveProperty('imap');
            expect(confirmOnboardingSetup.mock.calls[0][0]).toEqual({
                confirmed: true,
                previewToken: 'preview-1'
            });
        });

        expect(await screen.findByText('User added')).toBeInTheDocument();
        expect(screen.getByText('The user and onboarding credentials were saved successfully.')).toBeInTheDocument();
    });

    it('shows a failed Add User toast with the backend reason', async () => {
        previewOnboardingSetup.mockRejectedValueOnce(new Error('No catalog items configured for onboarding'));

        renderPage();

        fireEvent.change(screen.getByLabelText('Name (required)'), { target: { value: 'Test User' } });
        fireEvent.change(screen.getByLabelText('Work email (required)'), { target: { value: 'test.user' } });
        fireEvent.change(screen.getByLabelText(/Date of birth/), { target: { value: '1998-04-30' } });
        fireEvent.change(screen.getByLabelText(/Yahoo temporary password/), { target: { value: 'TempYahoo#1' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Actual password')).toHaveValue('DeterministicPreview#1');
            expect(screen.getByRole('button', { name: 'Add User' })).not.toBeDisabled();
        });

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

    it('does not render draft recovery controls', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Add New User' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Draft recovery' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Open draft' })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Link to directory user' })).not.toBeInTheDocument();
    });
});
