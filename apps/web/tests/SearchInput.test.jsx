import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SearchInput } from '../src/shared/components/SearchInput/SearchInput.jsx';

describe('SearchInput', () => {
    it('uses namespaced classes so shared search styling does not collide with generic search inputs', () => {
        render(
            <SearchInput
                value=""
                onChange={vi.fn()}
                placeholder="Search users"
            />
        );

        const input = screen.getByRole('textbox', { name: 'Search users' });

        expect(input).toHaveClass('shared-search-input__field');
        expect(input).not.toHaveClass('search-input');
        expect(input.closest('.shared-search-input')).toBeInTheDocument();
        expect(document.querySelector('.shared-search-input__icon')).toBeInTheDocument();
    });
});
