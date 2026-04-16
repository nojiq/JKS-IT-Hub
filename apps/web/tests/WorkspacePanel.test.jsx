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
