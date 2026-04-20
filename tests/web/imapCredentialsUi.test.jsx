import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ItOnlyBadge } from "../../apps/web/src/features/credentials/components/ItOnlyBadge.jsx";
import GenerationCredentialList from "../../apps/web/src/features/credentials/generation/CredentialList.jsx";
import CredentialHistoryCard from "../../apps/web/src/features/credentials/history/CredentialHistoryCard.jsx";
import { ExportPreview } from "../../apps/web/src/features/exports/components/ExportPreview.jsx";
import SystemConfigForm from "../../apps/web/src/features/system-configs/components/SystemConfigForm.jsx";
import CredentialOverrideModal from "../../apps/web/src/features/credentials/override/CredentialOverrideModal.jsx";

vi.mock('../../apps/web/src/features/credentials/history/CredentialRevealer.jsx', () => ({
    default: ({ versionId }) => <div data-testid="credential-revealer">revealer:{versionId}</div>
}));

describe("IMAP credentials UI", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders IT-only badge label", () => {
        render(<ItOnlyBadge />);
        expect(screen.getByText("🔒 IT-Only")).toBeInTheDocument();
    });

    it("shows export preview exclusion message and count", () => {
        render(
            <ExportPreview
                credentials={[
                    { id: "a", systemConfig: { isItOnly: true } },
                    { id: "b", systemConfig: { isItOnly: false } }
                ]}
            />
        );

        expect(screen.getByText(/IMAP credentials are excluded from exports for security/i)).toBeInTheDocument();
        expect(screen.getByText(/1 IT-only credential\(s\) excluded\. 1 credential\(s\) will be exported\./i)).toBeInTheDocument();
    });

    it("disables IT-only toggle when editing the built-in IMAP system", () => {
        render(
            <SystemConfigForm
                initialData={{
                    id: "sys-imap",
                    systemId: "imap",
                    usernameLdapField: "mail",
                    description: "IMAP",
                    isItOnly: true
                }}
                availableFields={["mail"]}
                isSubmitting={false}
                onSubmit={vi.fn()}
                onCancel={vi.fn()}
            />
        );

        const toggle = screen.getByRole("checkbox", { name: /IT-Only Access/i });
        expect(toggle).toBeDisabled();
        expect(screen.getByText(/cannot be changed for the built-in IMAP configuration/i)).toBeInTheDocument();
    });

    it("renders an IMAP-specific action in the credential list", () => {
        const onOverride = vi.fn();

        render(
            <GenerationCredentialList
                credentials={[
                    {
                        id: 'cred-imap',
                        system: 'imap',
                        username: 'person@example.com',
                        password: 'secret-value',
                        templateVersion: 1,
                        generatedAt: '2026-04-19T10:00:00.000Z',
                        isActive: true
                    }
                ]}
                onOverride={onOverride}
            />
        );

        const action = screen.getByRole('button', { name: /generate imap password/i });
        fireEvent.click(action);

        expect(onOverride).toHaveBeenCalledWith(expect.objectContaining({ system: 'imap' }));
    });

    it("shows deterministic IMAP inputs and live preview in the override modal", async () => {
        const onPreview = vi.fn().mockResolvedValue({
            data: {
                previewToken: 'preview-imap-1',
                currentCredential: {
                    username: 'person@example.com',
                    password: 'current-secret'
                },
                proposedCredential: {
                    username: 'person@example.com',
                    password: 'StablePass1234XY'
                },
                changes: {
                    usernameChanged: false,
                    passwordChanged: true,
                    changedFields: ['phone']
                },
                metadata: {
                    mode: 'imap_deterministic',
                    selectedFields: ['email', 'phone'],
                    changedFields: ['phone'],
                    origins: {
                        email: 'ldap',
                        phone: 'manual'
                    }
                }
            }
        });

        render(
            <CredentialOverrideModal
                isOpen
                onClose={vi.fn()}
                credential={{
                    id: 'cred-imap',
                    system: 'imap',
                    username: 'person@example.com',
                    metadata: {
                        mode: 'imap_deterministic',
                        selectedFields: ['email'],
                        changedFields: [],
                        origins: { email: 'ldap' }
                    }
                }}
                userId="user-1"
                userStatus="active"
                onPreview={onPreview}
                onConfirm={vi.fn()}
                isLoading={false}
                ldapFields={{
                    mail: 'person@example.com',
                    givenName: 'Alya',
                    sn: 'Rahman',
                    cn: 'Alya Rahman',
                    telephoneNumber: '012-333-4444',
                    birthDate: '1995-10-03'
                }}
            />
        );

        expect(screen.getByRole('heading', { name: /generate deterministic imap password/i })).toBeInTheDocument();
        expect(screen.getByRole('textbox', { name: /^email$/i })).toHaveValue('person@example.com');
        expect(screen.getByRole('checkbox', { name: /use phone number/i })).not.toBeChecked();

        fireEvent.click(screen.getByRole('checkbox', { name: /use phone number/i }));
        fireEvent.change(screen.getByRole('textbox', { name: /phone number/i }), { target: { value: '012-999-0000' } });

        await waitFor(() => {
            expect(onPreview).toHaveBeenCalledWith(
                'user-1',
                'imap',
                expect.objectContaining({
                    mode: 'imap_deterministic',
                    inputs: expect.objectContaining({
                        email: 'person@example.com',
                        phone: '012-999-0000'
                    }),
                    selectedFields: expect.objectContaining({
                        email: true,
                        phone: true
                    }),
                    origins: expect.objectContaining({
                        email: 'ldap',
                        phone: 'manual'
                    })
                })
            );
        });

        expect(screen.getByText(/stablepass1234xy/i)).toBeInTheDocument();
        expect(screen.getByText(/information changed/i)).toBeInTheDocument();
        expect(screen.getByText(/^Phone Number$/i, { selector: '.imap-changed-fields' })).toBeInTheDocument();
    });

    it("shows changed information names for deterministic IMAP history without raw values", () => {
        render(
            <CredentialHistoryCard
                entry={{
                    id: 'version-22',
                    system: 'imap',
                    reason: 'override',
                    timestamp: '2026-04-19T12:00:00.000Z',
                    username: 'person@example.com',
                    templateVersion: null,
                    createdBy: { name: 'IT Admin' },
                    metadata: {
                        mode: 'imap_deterministic',
                        changedFields: ['email', 'phone']
                    }
                }}
                isSelected={false}
                onSelect={vi.fn()}
                canSelect
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /show details/i }));

        expect(screen.getByTestId('credential-revealer')).toHaveTextContent('revealer:version-22');
        expect(screen.getByText(/information changed/i)).toBeInTheDocument();
        expect(screen.getByText('Email address')).toBeInTheDocument();
        expect(screen.getByText('Phone number')).toBeInTheDocument();
        expect(screen.queryByText('new@example.com')).not.toBeInTheDocument();
    });
});
