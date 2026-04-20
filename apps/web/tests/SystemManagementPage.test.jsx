import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SystemManagementPage from '../src/features/system-configs/SystemManagementPage.jsx';

vi.mock('../src/features/system-configs/hooks/useSystemConfigs.js', () => ({
    useSystemConfigs: vi.fn(),
    useCreateSystemConfig: vi.fn(),
    useUpdateSystemConfig: vi.fn(),
    useDeleteSystemConfig: vi.fn(),
    useAvailableLdapFields: vi.fn()
}));

vi.mock('../src/features/normalization-rules/hooks/useNormalizationRules.js', () => ({
    useNormalizationRules: vi.fn(),
    useCreateNormalizationRule: vi.fn(),
    useUpdateNormalizationRule: vi.fn(),
    useDeleteNormalizationRule: vi.fn(),
    useReorderNormalizationRules: vi.fn()
}));

vi.mock('../src/shared/hooks/useToast.js', () => ({
    useToast: () => ({
        success: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('../src/features/normalization-rules/components/NormalizationPreviewer.jsx', () => ({
    default: () => <div>Normalization Preview Stub</div>
}));

import {
    useAvailableLdapFields,
    useCreateSystemConfig,
    useDeleteSystemConfig,
    useSystemConfigs,
    useUpdateSystemConfig
} from '../src/features/system-configs/hooks/useSystemConfigs.js';
import {
    useCreateNormalizationRule,
    useDeleteNormalizationRule,
    useNormalizationRules,
    useReorderNormalizationRules,
    useUpdateNormalizationRule
} from '../src/features/normalization-rules/hooks/useNormalizationRules.js';

const createMutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false
});

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <SystemManagementPage />
        </QueryClientProvider>
    );
};

describe('SystemManagementPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        useSystemConfigs.mockReturnValue({
            data: {
                data: [
                    {
                        id: 'sys-1',
                        systemId: 'corporate-vpn',
                        usernameLdapField: 'mail',
                        description: 'VPN access',
                        isItOnly: true
                    }
                ]
            },
            isLoading: false
        });

        useAvailableLdapFields.mockReturnValue({
            data: {
                data: ['mail', 'uid']
            }
        });

        useNormalizationRules.mockReturnValue({
            data: {
                data: {
                    global: [
                        {
                            id: 'rule-1',
                            ruleType: 'lowercase',
                            ruleConfig: {},
                            isActive: true,
                            priority: 0
                        }
                    ],
                    systems: {}
                }
            },
            isLoading: false
        });

        useCreateSystemConfig.mockReturnValue(createMutation());
        useUpdateSystemConfig.mockReturnValue(createMutation());
        useDeleteSystemConfig.mockReturnValue(createMutation());
        useCreateNormalizationRule.mockReturnValue(createMutation());
        useUpdateNormalizationRule.mockReturnValue(createMutation());
        useDeleteNormalizationRule.mockReturnValue(createMutation());
        useReorderNormalizationRules.mockReturnValue(createMutation());
    });

    it('renders the systems admin page with shared workspace framing', () => {
        const { container } = renderPage();

        expect(screen.getByRole('heading', { name: 'Systems' })).toBeInTheDocument();
        expect(screen.getByText('Manage system mappings, username sources, and normalization rules.')).toBeInTheDocument();
        expect(container.querySelector('.workspace-page-header')).not.toBeNull();
        expect(container.querySelectorAll('.workspace-panel').length).toBeGreaterThanOrEqual(2);
        expect(screen.getByRole('heading', { name: 'System Catalog' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Normalization Rules' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'System Management' })).not.toBeInTheDocument();
    });
});
