import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import InvoiceDisplay from '../../apps/web/src/features/requests/components/InvoiceDisplay';

describe('InvoiceDisplay', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('opens full-size image in a new tab when clicking "View Full Size"', () => {
        const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

        render(
            <InvoiceDisplay
                invoiceUrl="https://example.com/invoice.png"
                fileName="invoice.png"
            />
        );

        fireEvent.click(screen.getByRole('button', { name: 'View Full Size' }));

        expect(openSpy).toHaveBeenCalledWith(
            'https://example.com/invoice.png',
            '_blank',
            'noopener,noreferrer'
        );
    });

    it('shows loading state for image previews and hides it after image load', () => {
        render(
            <InvoiceDisplay
                invoiceUrl="https://example.com/invoice.jpg"
                fileName="invoice.jpg"
            />
        );

        expect(screen.getByText('Loading invoice preview...')).toBeInTheDocument();

        fireEvent.load(screen.getByAltText('Invoice'));

        expect(screen.queryByText('Loading invoice preview...')).not.toBeInTheDocument();
    });
});
