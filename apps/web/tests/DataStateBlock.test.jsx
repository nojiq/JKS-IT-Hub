import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataStateBlock } from '../src/shared/workspace/DataStateBlock.jsx';

describe('DataStateBlock', () => {
    it('uses a polite status region for loading states', () => {
        render(
            <DataStateBlock
                variant="loading"
                title="Loading users"
                description="Fetching directory data."
            />
        );

        const status = screen.getByRole('status');
        expect(status).toHaveAttribute('aria-live', 'polite');
        expect(status).toHaveTextContent('Loading users');
    });

    it('uses an alert region for errors and keeps the retry action clickable', () => {
        const onRetry = vi.fn();

        render(
            <DataStateBlock
                variant="error"
                title="Unable to load users"
                description="Retry after reconnecting."
                actionLabel="Retry"
                onAction={onRetry}
            />
        );

        const alert = screen.getByRole('alert');
        expect(alert).toHaveTextContent('Unable to load users');

        fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});
