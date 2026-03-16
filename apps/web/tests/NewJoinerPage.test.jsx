import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NewJoinerPage } from '../src/features/onboarding/pages/NewJoinerPage.jsx';

vi.mock('../src/features/onboarding/onboarding-api.js', () => ({
    fetchCatalogItems: vi.fn(),
    fetchDepartmentBundles: vi.fn(),
    previewOnboardingSetup: vi.fn(),
    confirmOnboardingSetup: vi.fn(),
    fetchUsersForOnboarding: vi.fn(),
    fetchOnboardingDrafts: vi.fn(),
    linkAndPromoteOnboardingDraft: vi.fn()
}));

import {
    confirmOnboardingSetup,
    fetchCatalogItems,
    fetchOnboardingDrafts,
    fetchDepartmentBundles,
    fetchUsersForOnboarding,
    linkAndPromoteOnboardingDraft,
    previewOnboardingSetup
} from '../src/features/onboarding/onboarding-api.js';

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <NewJoinerPage />
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

        fetchUsersForOnboarding.mockResolvedValue([
            {
                id: 'user-1',
                username: 'haziq.afendi',
                displayName: 'Haziq Afendi',
                email: 'haziq.afendi@jkseng.com',
                department: 'Business Development'
            }
        ]);

        fetchOnboardingDrafts.mockResolvedValue([
            {
                id: 'draft-1',
                fullName: 'Haziq Afendi',
                email: 'haziq.afendi@jkseng.com',
                department: 'Business Development',
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

    it('auto-selects recommended apps from the chosen department and keeps them editable', async () => {
        renderPage();

        expect(await screen.findByLabelText('Department')).toBeInTheDocument();
        expect(await screen.findByRole('option', { name: 'Marketing' })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText('Department'), {
            target: { value: 'Marketing' }
        });

        await waitFor(() => {
            expect(screen.getByLabelText('Canva')).toBeChecked();
            expect(screen.getByLabelText('Basecamp')).toBeChecked();
        });

        fireEvent.click(screen.getByLabelText('Basecamp'));
        expect(screen.getByLabelText('Basecamp')).not.toBeChecked();
    });

    it('builds a setup sheet for an existing user based on department bundle defaults', async () => {
        renderPage();

        fireEvent.click(screen.getByLabelText('Existing Directory User'));
        await screen.findByLabelText('Existing User');
        expect(await screen.findByRole('option', { name: 'Haziq Afendi' })).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Existing User'), { target: { value: 'user-1' } });

        await waitFor(() => {
            expect(screen.getByLabelText('Sigma')).toBeChecked();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Preview Setup Sheet' }));

        expect(await screen.findByText('Haziqafendi@7189')).toBeInTheDocument();
        expect(screen.getByText('https://sigma.example')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Save Onboarding Credentials' }));

        await waitFor(() => {
            expect(confirmOnboardingSetup).toHaveBeenCalled();
            expect(confirmOnboardingSetup.mock.calls[0][0]).toEqual({
                confirmed: true,
                previewToken: 'preview-1'
            });
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

        expect(await screen.findByRole('heading', { name: 'Saved Drafts' })).toBeInTheDocument();
        expect(await screen.findByText((content) => content.includes('haziq.afendi@jkseng.com'))).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Open Draft' }));

        await waitFor(() => {
            expect(screen.getByLabelText('Full Name')).toHaveValue('Haziq Afendi');
            expect(screen.getByLabelText('Email')).toHaveValue('haziq.afendi@jkseng.com');
            expect(screen.getByLabelText('Sigma')).toBeChecked();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Copy Setup Sheet' }));

        await waitFor(() => {
            expect(window.navigator.clipboard.writeText).toHaveBeenCalled();
            expect(window.navigator.clipboard.writeText.mock.calls[0][0]).toContain('Sigma');
            expect(window.navigator.clipboard.writeText.mock.calls[0][0]).toContain('Haziqafendi@7189');
        });

        fireEvent.click(screen.getByRole('button', { name: 'Link to Directory User' }));
        fireEvent.change(screen.getByLabelText('Link Draft To User'), { target: { value: 'user-1' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirm Link & Promote' }));

        await waitFor(() => {
            expect(linkAndPromoteOnboardingDraft).toHaveBeenCalledWith('draft-1', 'user-1');
        });

        expect(await screen.findByText('Completed')).toBeInTheDocument();
    });
});
