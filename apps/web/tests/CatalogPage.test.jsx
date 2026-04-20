import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogPage } from '../src/features/onboarding/pages/CatalogPage.jsx';

vi.mock('../src/features/onboarding/onboarding-api.js', () => ({
    fetchCatalogItems: vi.fn(),
    fetchDepartmentBundles: vi.fn(),
    createCatalogItem: vi.fn(),
    createDepartmentBundle: vi.fn(),
    deleteCatalogItem: vi.fn(),
    deleteDepartmentBundle: vi.fn(),
    updateCatalogItem: vi.fn(),
    updateDepartmentBundle: vi.fn()
}));

import {
    fetchCatalogItems,
    fetchDepartmentBundles,
    createCatalogItem,
    createDepartmentBundle,
    deleteCatalogItem,
    deleteDepartmentBundle,
    updateCatalogItem,
    updateDepartmentBundle
} from '../src/features/onboarding/onboarding-api.js';

const renderPage = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 }
        }
    });

    return render(
        <QueryClientProvider client={queryClient}>
            <CatalogPage />
        </QueryClientProvider>
    );
};

describe('CatalogPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        fetchCatalogItems.mockResolvedValue([]);
        fetchDepartmentBundles.mockResolvedValue([]);
        createCatalogItem.mockResolvedValue({});
        createDepartmentBundle.mockResolvedValue({});
        deleteCatalogItem.mockResolvedValue({});
        deleteDepartmentBundle.mockResolvedValue({});
        updateCatalogItem.mockResolvedValue({});
        updateDepartmentBundle.mockResolvedValue({});
    });

    it('renders compact switches, directive placeholders, and structured empty states', async () => {
        renderPage();

        expect(await screen.findByRole('heading', { name: 'Catalog Items' })).toBeInTheDocument();
        expect(screen.getByText('0 apps')).toBeInTheDocument();
        expect(screen.getByText('0 active bundles')).toBeInTheDocument();
        expect(document.querySelector('.catalog-page-shell')).toBeInTheDocument();
        expect(document.querySelector('.catalog-page-grid')).toBeInTheDocument();
        expect(document.querySelectorAll('.catalog-panel')).toHaveLength(2);
        expect(document.querySelectorAll('.catalog-form-footer')).toHaveLength(2);

        expect(screen.getByRole('switch', { name: /IT-only credential/i })).toBeInTheDocument();
        expect(screen.getByRole('switch', { name: /Bundle active/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Add Item' }).closest('.catalog-form-footer')).not.toBeNull();
        expect(screen.getByRole('button', { name: 'Add Bundle' }).closest('.catalog-form-footer')).not.toBeNull();

        expect(screen.getByPlaceholderText('e.g. sigma')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('App name shown to IT and onboarding')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('https://app.example.com/sign-in')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Add setup or provisioning notes for IT handoff')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('e.g. Marketing')).toBeInTheDocument();

        expect(await screen.findByRole('heading', { name: 'No catalog items yet' })).toBeInTheDocument();
        expect(screen.getByText('Create the application entries IT can provision during onboarding.')).toBeInTheDocument();
        expect(await screen.findByRole('heading', { name: 'No department bundles yet' })).toBeInTheDocument();
        expect(screen.getByText('Build reusable department access bundles so app selection starts from a clean default.')).toBeInTheDocument();
    });
});
