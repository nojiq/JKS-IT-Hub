/**
 * Credential Export Button Component Tests
 * 
 * Tests for Story 3.1: Single-User Credential Export
 * - Component renders correctly
 * - Loading state during export
 * - Error handling with user-friendly messages
 * - Export function called correctly
 */

import { describe, it, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CredentialExportButton } from '../../apps/web/src/features/exports/components/CredentialExportButton.jsx';

vi.mock('../../apps/web/src/features/exports/api/exports.js', () => ({
  exportCredentials: vi.fn()
}));

describe('CredentialExportButton', () => {
  let mockExportCredentials;
  const userId = 'test-user-123';
  const username = 'testuser';

  beforeEach(async () => {
    const { exportCredentials } = await import('../../apps/web/src/features/exports/api/exports.js');
    mockExportCredentials = exportCredentials;
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render the export button with correct text', () => {
    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Export Credentials');
  });

  it('should show loading state during export', async () => {
    mockExportCredentials.mockImplementation(() => new Promise(() => {}));

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Exporting...');
  });

  it('should show success notification after successful export', async () => {
    mockExportCredentials.mockResolvedValue({ success: true });

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);

    await waitFor(() => {
      const notification = screen.getByText('Credentials exported successfully');
      expect(notification).toBeInTheDocument();
    });
  });

  it('should show error notification on export failure', async () => {
    mockExportCredentials.mockRejectedValue(new Error('Network error'));

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);

    await waitFor(() => {
      const notification = screen.queryByText(/network error/i);
      expect(notification).toBeInTheDocument();
    });
  });

  it('should show specific error message from API', async () => {
    const errorMessage = 'IT role required';
    mockExportCredentials.mockRejectedValue(new Error(errorMessage));

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);

    await waitFor(() => {
      const notification = screen.getByText(errorMessage);
      expect(notification).toBeInTheDocument();
    });
  });

  it('should re-enable button after export completes', async () => {
    mockExportCredentials.mockResolvedValue({ success: true });

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);
    expect(button).toBeDisabled();

    await waitFor(() => {
      expect(button).not.toBeDisabled();
      expect(button).toHaveTextContent('Export Credentials');
    });
  });

  it('should call export function with correct userId', async () => {
    mockExportCredentials.mockResolvedValue({ success: true });

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockExportCredentials).toHaveBeenCalledWith(userId, 'standard');
    });
  });

  it('should have appropriate title attribute for accessibility', () => {
    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    expect(button).toHaveAttribute('title', 'Download credentials for secure delivery');
  });

  it('should dismiss notification when close button clicked', async () => {
    mockExportCredentials.mockResolvedValue({ success: true });

    render(<CredentialExportButton userId={userId} username={username} />);

    const button = screen.getByRole('button', { name: /export credentials/i });
    fireEvent.click(button);

    await waitFor(() => {
      const notification = screen.getByText('Credentials exported successfully');
      expect(notification).toBeInTheDocument();
    });

    const closeButton = screen.getByRole('button', { name: '×' });
    fireEvent.click(closeButton);

    await waitFor(() => {
      const notification = screen.queryByText('Credentials exported successfully');
      expect(notification).not.toBeInTheDocument();
    });
  });
});
