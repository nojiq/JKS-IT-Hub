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

        const action = screen.getByRole('button', { name: /record imap password/i });
        fireEvent.click(action);

        expect(onOverride).toHaveBeenCalledWith(expect.objectContaining({ system: 'imap' }));
    });

    it("IMAP override modal uses manual provider username/password like other systems", async () => {
        const onPreview = vi.fn().mockResolvedValue({
            data: {
                previewToken: 'preview-imap-1',
                currentCredential: {
                    username: 'person@example.com',
                    password: 'current-secret'
                },
                proposedCredential: {
                    username: 'person@example.com',
                    password: 'AppPasswordFromHost99'
                },
                changes: {
                    usernameChanged: false,
                    passwordChanged: true
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
                    metadata: { mode: 'provider_recorded' }
                }}
                userId="user-1"
                userStatus="active"
                onPreview={onPreview}
                onConfirm={vi.fn()}
                isLoading={false}
                ldapFields={{
                    mail: 'person@example.com'
                }}
            />
        );

        expect(screen.getByRole('heading', { name: /override credential: imap/i })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText(/^Password:/i), {
            target: { value: 'AppPasswordFromHost99' }
        });
        fireEvent.change(screen.getByPlaceholderText(/minimum 10 characters required/i), {
            target: { value: 'User received new app password from Yahoo; recording for mailbox access' }
        });

        fireEvent.click(screen.getByRole('button', { name: /preview changes/i }));

        await waitFor(() => {
            expect(onPreview).toHaveBeenCalledWith(
                'user-1',
                'imap',
                expect.objectContaining({
                    password: 'AppPasswordFromHost99',
                    reason: 'User received new app password from Yahoo; recording for mailbox access'
                })
            );
        });

        expect(screen.getByText(/AppPasswordFromHost99/i)).toBeInTheDocument();
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

    it("shows provider-recorded note for IMAP history entries", () => {
        render(
            <CredentialHistoryCard
                entry={{
                    id: 'version-33',
                    system: 'imap',
                    reason: 'override',
                    timestamp: '2026-04-19T12:00:00.000Z',
                    username: 'person@example.com',
                    templateVersion: null,
                    createdBy: { name: 'IT Admin' },
                    metadata: {
                        mode: 'provider_recorded',
                        saveMode: 'active'
                    }
                }}
                isSelected={false}
                onSelect={vi.fn()}
                canSelect
            />
        );

        fireEvent.click(screen.getByRole('button', { name: /show details/i }));
        expect(screen.getByText(/Password recorded by IT from the email provider/i)).toBeInTheDocument();
    });
});
