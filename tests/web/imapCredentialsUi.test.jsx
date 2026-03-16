import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ItOnlyBadge } from "../../apps/web/src/features/credentials/components/ItOnlyBadge.jsx";
import { ExportPreview } from "../../apps/web/src/features/exports/components/ExportPreview.jsx";
import SystemConfigForm from "../../apps/web/src/features/system-configs/components/SystemConfigForm.jsx";

describe("IMAP credentials UI", () => {
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
});

