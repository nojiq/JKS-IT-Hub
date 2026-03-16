import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ResponsiveCard } from '../../apps/web/src/shared/ui/ResponsiveCard/ResponsiveCard';

// Mock useIsMobile hook
vi.mock('../../apps/web/src/shared/hooks', () => ({
    useIsMobile: vi.fn()
}));

import { useIsMobile } from '../../apps/web/src/shared/hooks';

describe('ResponsiveCard', () => {
    const mockData = {
        id: 1,
        name: 'John Doe',
        email: 'john@example.com',
        department: 'IT'
    };

    const mockColumns = [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        {
            key: 'department',
            label: 'Department',
            render: (value) => <span className="dept-badge">{value}</span>
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders as card on mobile', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
            />
        );

        expect(screen.getByText('Name')).toBeInTheDocument();
        expect(screen.getByText('John Doe')).toBeInTheDocument();
        expect(screen.getByText('Email')).toBeInTheDocument();
        expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });

    it('returns null on desktop (table mode)', () => {
        useIsMobile.mockReturnValue(false);

        const { container } = render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
            />
        );

        expect(container.firstChild).toBeNull();
    });

    it('renders custom column render function', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
            />
        );

        const deptBadge = screen.getByText('IT');
        expect(deptBadge).toHaveClass('dept-badge');
    });

    it('renders actions when provided', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                actions={<button>Edit</button>}
            />
        );

        expect(screen.getByText('Edit')).toBeInTheDocument();
    });

    it('calls onClick when card is clicked', () => {
        useIsMobile.mockReturnValue(true);
        const handleClick = vi.fn();

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                onClick={handleClick}
            />
        );

        const card = screen.getByRole('button');
        fireEvent.click(card);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('has button role when onClick is provided', () => {
        useIsMobile.mockReturnValue(true);

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                onClick={() => { }}
            />
        );

        expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('supports keyboard interaction when clickable', () => {
        useIsMobile.mockReturnValue(true);
        const handleClick = vi.fn();

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                onClick={handleClick}
            />
        );

        const card = screen.getByRole('button');
        fireEvent.keyDown(card, { key: 'Enter' });

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('supports space key for activation', () => {
        useIsMobile.mockReturnValue(true);
        const handleClick = vi.fn();

        render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                onClick={handleClick}
            />
        );

        const card = screen.getByRole('button');
        fireEvent.keyDown(card, { key: ' ' });

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('applies custom className', () => {
        useIsMobile.mockReturnValue(true);

        const { container } = render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                className="custom-class"
            />
        );

        const card = container.querySelector('.responsive-card');
        expect(card).toHaveClass('custom-class');
    });

    it('applies clickable class when onClick is provided', () => {
        useIsMobile.mockReturnValue(true);

        const { container } = render(
            <ResponsiveCard
                data={mockData}
                columns={mockColumns}
                onClick={() => { }}
            />
        );

        const card = container.querySelector('.responsive-card');
        expect(card).toHaveClass('clickable');
    });
});
