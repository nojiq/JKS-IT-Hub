import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MaintenanceSearchCombobox } from '../src/features/maintenance/components/MaintenanceSearchCombobox.jsx';

describe('MaintenanceSearchCombobox', () => {
    it('shows grouped suggestions and selects a cycle', async () => {
        const onSelect = vi.fn();
        const onChange = vi.fn();

        render(
            <MaintenanceSearchCombobox
                value=""
                onChange={onChange}
                onSelect={onSelect}
                cycles={[{ id: 'cycle-1', name: 'Quarterly PM' }]}
                windows={[{
                    id: 'win-1',
                    status: 'OVERDUE',
                    scheduledStartDate: '2026-05-11T14:45:00.000Z',
                    cycleConfig: { name: 'Quarterly PM' }
                }]}
            />
        );

        const input = screen.getByRole('combobox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'quarter' } });

        expect(await screen.findByText('Cycles')).toBeInTheDocument();
        expect(screen.getByText('Windows')).toBeInTheDocument();

        const [cycleOption] = screen.getAllByRole('option', { name: /Quarterly PM/i });
        fireEvent.click(cycleOption);

        await waitFor(() => {
            expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({
                type: 'cycle',
                id: 'cycle-1',
                label: 'Quarterly PM'
            }));
        });
    });

    it('supports keyboard navigation', () => {
        const onSelect = vi.fn();

        render(
            <MaintenanceSearchCombobox
                onSelect={onSelect}
                cycles={[{ id: 'cycle-1', name: 'Quarterly PM' }]}
                windows={[]}
            />
        );

        const input = screen.getByRole('combobox');
        fireEvent.focus(input);
        fireEvent.change(input, { target: { value: 'quarter' } });
        fireEvent.keyDown(input, { key: 'ArrowDown' });
        fireEvent.keyDown(input, { key: 'Enter' });

        expect(onSelect).toHaveBeenCalled();
    });
});
