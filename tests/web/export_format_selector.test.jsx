import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CredentialExportButton } from '../../apps/web/src/features/exports/components/CredentialExportButton.jsx';
import { BatchCredentialExportButton } from '../../apps/web/src/features/exports/components/BatchCredentialExportButton.jsx';
import * as exportsApi from '../../apps/web/src/features/exports/api/exports.js';

describe('CredentialExportButton - Format Selection', () => {
    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        // Mock the export API
        vi.spyOn(exportsApi, 'exportCredentials').mockResolvedValue('success');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render format dropdown with standard and compressed options', () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        expect(dropdown).toBeInTheDocument();

        // Check options
        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveTextContent(/Standard.*Human-readable/i);
        expect(options[1]).toHaveTextContent(/Compressed.*CSV-style/i);
    });

    it('should default to standard format', () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        expect(dropdown.value).toBe('standard');
    });

    it('should load saved format preference from localStorage', () => {
        localStorage.setItem('export-format-preference', 'compressed');

        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        expect(dropdown.value).toBe('compressed');
    });

    it('should save format selection to localStorage when changed', async () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        fireEvent.change(dropdown, { target: { value: 'compressed' } });

        await waitFor(() => {
            expect(localStorage.getItem('export-format-preference')).toBe('compressed');
        });
    });

    it('should pass format parameter to export API when standard format selected', async () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const exportButton = screen.getByRole('button', { name: /export credentials/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(exportsApi.exportCredentials).toHaveBeenCalledWith('test-user-123', 'standard');
        });
    });

    it('should pass format parameter to export API when compressed format selected', async () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        fireEvent.change(dropdown, { target: { value: 'compressed' } });

        const exportButton = screen.getByRole('button', { name: /export credentials/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(exportsApi.exportCredentials).toHaveBeenCalledWith('test-user-123', 'compressed');
        });
    });

    it('should request standard format (txt export path)', async () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const exportButton = screen.getByRole('button', { name: /export credentials/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(exportsApi.exportCredentials).toHaveBeenCalledWith('test-user-123', 'standard');
        });
    });

    it('should request compressed format (csv export path)', async () => {
        render(<CredentialExportButton userId="test-user-123" username="testuser" />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        fireEvent.change(dropdown, { target: { value: 'compressed' } });

        const exportButton = screen.getByRole('button', { name: /export credentials/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(exportsApi.exportCredentials).toHaveBeenCalledWith('test-user-123', 'compressed');
        });
    });
});

describe('BatchCredentialExportButton - Format Selection', () => {
    const testUserIds = ['user-1', 'user-2', 'user-3'];

    beforeEach(() => {
        localStorage.clear();
        vi.spyOn(exportsApi, 'exportBatchCredentials').mockResolvedValue('success');
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render format dropdown with standard and compressed options', () => {
        render(<BatchCredentialExportButton userIds={testUserIds} />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        expect(dropdown).toBeInTheDocument();

        const options = screen.getAllByRole('option');
        expect(options).toHaveLength(2);
        expect(options[0]).toHaveTextContent(/Standard.*Human-readable/i);
        expect(options[1]).toHaveTextContent(/Compressed.*CSV-style/i);
    });

    it('should share format preference with single-user export', () => {
        localStorage.setItem('export-format-preference', 'compressed');

        render(<BatchCredentialExportButton userIds={testUserIds} />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        expect(dropdown.value).toBe('compressed');
    });

    it('should pass format parameter to batch export API', async () => {
        render(<BatchCredentialExportButton userIds={testUserIds} />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        fireEvent.change(dropdown, { target: { value: 'compressed' } });

        const exportButton = screen.getByRole('button', { name: /export selected credentials/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(exportsApi.exportBatchCredentials).toHaveBeenCalledWith(testUserIds, 'compressed');
        });
    });

    it('should request compressed batch format (csv export path)', async () => {
        render(<BatchCredentialExportButton userIds={testUserIds} />);

        const dropdown = screen.getByRole('combobox', { name: /format/i });
        fireEvent.change(dropdown, { target: { value: 'compressed' } });

        const exportButton = screen.getByRole('button', { name: /export selected credentials/i });
        fireEvent.click(exportButton);

        await waitFor(() => {
            expect(exportsApi.exportBatchCredentials).toHaveBeenCalledWith(testUserIds, 'compressed');
        });
    });
});
