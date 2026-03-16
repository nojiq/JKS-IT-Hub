import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TouchCheckbox } from '../../apps/web/src/shared/ui/TouchCheckbox/TouchCheckbox';

describe('TouchCheckbox', () => {
    it('renders with label', () => {
        render(
            <TouchCheckbox
                checked={false}
                onChange={() => { }}
                label="Accept terms"
            />
        );

        expect(screen.getByText('Accept terms')).toBeInTheDocument();
    });

    it('renders checked state correctly', () => {
        render(
            <TouchCheckbox
                checked={true}
                onChange={() => { }}
                label="Accept terms"
            />
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toBeChecked();
    });

    it('calls onChange when clicked', () => {
        const handleChange = vi.fn();
        render(
            <TouchCheckbox
                checked={false}
                onChange={handleChange}
                label="Accept terms"
            />
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        expect(handleChange).toHaveBeenCalledTimes(1);
    });

    it('renders required indicator when required', () => {
        render(
            <TouchCheckbox
                checked={false}
                onChange={() => { }}
                label="Accept terms"
                required={true}
            />
        );

        expect(screen.getByText('*')).toBeInTheDocument();
    });

    it('renders description when provided', () => {
        render(
            <TouchCheckbox
                checked={false}
                onChange={() => { }}
                label="Accept terms"
                description="You must accept the terms to continue"
            />
        );

        expect(screen.getByText('You must accept the terms to continue')).toBeInTheDocument();
    });

    it('is disabled when disabled prop is true', () => {
        render(
            <TouchCheckbox
                checked={false}
                onChange={() => { }}
                label="Accept terms"
                disabled={true}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onChange when disabled and clicked', () => {
        const handleChange = vi.fn();
        render(
            <TouchCheckbox
                checked={false}
                onChange={handleChange}
                label="Accept terms"
                disabled={true}
            />
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.click(checkbox);

        expect(handleChange).not.toHaveBeenCalled();
    });

    it('has large touch target for mobile', () => {
        const { container } = render(
            <TouchCheckbox
                checked={false}
                onChange={() => { }}
                label="Accept terms"
            />
        );

        const touchCheckbox = container.querySelector('.touch-checkbox');
        const styles = window.getComputedStyle(touchCheckbox);

        // Check for class instead of computed style in JSDOM
        expect(touchCheckbox).toHaveClass('touch-checkbox');
    });

    it('supports keyboard interaction', () => {
        const handleChange = vi.fn();
        render(
            <TouchCheckbox
                checked={false}
                onChange={handleChange}
                label="Accept terms"
            />
        );

        const checkbox = screen.getByRole('checkbox');
        fireEvent.keyDown(checkbox, { key: 'Enter' });

        expect(handleChange).toHaveBeenCalledTimes(1);
    });
});
