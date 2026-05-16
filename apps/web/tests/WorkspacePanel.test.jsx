import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkspacePanel } from '../src/shared/workspace/WorkspacePanel.jsx';

describe('WorkspacePanel', () => {
    it('renders header band when title metadata provided', () => {
        render(
            <WorkspacePanel
                variant="metric"
                eyebrow="Overview"
                title="Users in Directory"
                meta="248 users"
                actions={<button type="button">Refresh</button>}
            >
                <p>Body content</p>
            </WorkspacePanel>
        );

        expect(screen.getByText('Overview')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Users in Directory' })).toBeInTheDocument();
        expect(screen.getByText('248 users')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    });

    it('renders body and footer wrappers with variant class', () => {
        const { container } = render(
            <WorkspacePanel variant="metric" footer={<div>Footer content</div>}>
                <p>Body content</p>
            </WorkspacePanel>
        );

        expect(screen.getByText('Body content')).toBeInTheDocument();
        expect(screen.getByText('Footer content')).toBeInTheDocument();
        expect(container.querySelector('.workspace-panel')).toHaveClass('workspace-panel-metric');
        expect(container.querySelector('.workspace-panel-body')).not.toBeNull();
        expect(container.querySelector('.workspace-panel-footer')).not.toBeNull();
    });

    it('shows title hint on hover instead of meta line', () => {
        render(
            <WorkspacePanel
                variant="detail"
                title="Recent Access Actions"
                titleHint="See recent account changes in history."
            >
                <p>Body content</p>
            </WorkspacePanel>
        );

        expect(screen.getByRole('heading', { name: 'Recent Access Actions' })).toBeInTheDocument();
        expect(screen.getByText('See recent account changes in history.')).toHaveClass('workspace-panel-title-hint-popup');
        expect(screen.queryByText('See recent account changes in history.', { selector: 'p' })).not.toBeInTheDocument();
    });

    it('applies detail and table modifier classes', () => {
        const { container: detailContainer } = render(
            <WorkspacePanel variant="detail">
                <p>Detail panel</p>
            </WorkspacePanel>
        );
        const { container: tableContainer } = render(
            <WorkspacePanel variant="table">
                <p>Table panel</p>
            </WorkspacePanel>
        );

        expect(detailContainer.querySelector('.workspace-panel')).toHaveClass('workspace-panel-detail');
        expect(tableContainer.querySelector('.workspace-panel')).toHaveClass('workspace-panel-table');
    });
});
