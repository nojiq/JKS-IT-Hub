import { describe, expect, it } from 'vitest';
import { resolveWorkspaceGroups } from '../src/shared/workspace/workspaceModules.js';

const flattenItems = (groups) => groups.flatMap((group) => group.items);
const itemIdsFor = (role) => flattenItems(resolveWorkspaceGroups({ role })).map((item) => item.id);
const childLabelsFor = (role, itemId) => {
    const item = flattenItems(resolveWorkspaceGroups({ role })).find((entry) => entry.id === itemId);
    return item?.children?.map((child) => child.label) ?? [];
};

describe('workspace module access', () => {
    it.each(['dev', 'it', 'admin', 'head_it'])('shows formerly dev-only modules to %s role', (role) => {
        expect(itemIdsFor(role)).toEqual(expect.arrayContaining(['requests', 'maintenance', 'systems', 'approvals']));
        expect(childLabelsFor(role, 'requests')).toEqual(expect.arrayContaining(['Review Queue', 'Approvals']));
    });

    it.each(['dev', 'it', 'admin', 'head_it'])('shows IP List module to %s role beside Assets', (role) => {
        const ids = itemIdsFor(role);
        expect(ids).toEqual(expect.arrayContaining(['assets', 'ip-list']));
        const assetsIndex = ids.indexOf('assets');
        const ipListIndex = ids.indexOf('ip-list');
        expect(ipListIndex).toBeGreaterThan(assetsIndex);
    });

    it('does not expose IP List to plain users without IT roles', () => {
        expect(itemIdsFor('user')).not.toContain('ip-list');
    });
});
