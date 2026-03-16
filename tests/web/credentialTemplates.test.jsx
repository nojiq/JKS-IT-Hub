import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
const { default: TemplatePreview } = await import("../../apps/web/src/features/credentials/templates/TemplatePreview.jsx");

describe("TemplatePreview", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders normalized preview values and system tags", () => {
        const template = {
            structure: {
                systems: ["email", "vpn"],
                fields: [
                    {
                        name: "username",
                        ldapSource: "mail",
                        normalization: ["uppercase", "removeSpaces"]
                    },
                    {
                        name: "password",
                        type: "generated",
                        pattern: "{firstname:3}{lastname:3}{random:4}"
                    }
                ]
            }
        };

        render(<TemplatePreview template={template} />);

        expect(screen.getByText("Live Preview")).toBeInTheDocument();
        expect(screen.getByText("email")).toBeInTheDocument();
        expect(screen.getByText("vpn")).toBeInTheDocument();

        const previewText = screen.getByText((content) => content.includes("JOHN.DOE"));
        expect(previewText).toBeInTheDocument();
    });
});
