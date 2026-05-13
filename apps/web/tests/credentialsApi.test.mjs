import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/shared/utils/api-client.js", () => ({
    buildApiUrl: vi.fn((path) => `https://it-api.jkseng.com${path}`)
}));

describe("credentials API client", () => {
    let previewActualPassword;
    let buildApiUrl;

    beforeEach(async () => {
        vi.resetModules();
        global.fetch = vi.fn();
        ({ buildApiUrl } = await import("../src/shared/utils/api-client.js"));
        ({ previewActualPassword } = await import("../src/features/credentials/api/credentials.js"));
    });

    it("uses the configured API base URL for actual-password preview", async () => {
        fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ data: { password: "Generated#1" } })
        });

        await previewActualPassword({
            fullName: "Test User",
            email: "test@example.com",
            dateOfBirth: "2000-01-01"
        });

        expect(buildApiUrl).toHaveBeenCalledWith("/api/v1/credentials/actual-password/preview");
        expect(fetch).toHaveBeenCalledWith(
            "https://it-api.jkseng.com/api/v1/credentials/actual-password/preview",
            expect.objectContaining({
                method: "POST",
                credentials: "include"
            })
        );
    });

    it("throws a useful error when the server returns HTML instead of JSON", async () => {
        fetch.mockResolvedValue({
            ok: false,
            status: 405,
            statusText: "Method Not Allowed",
            headers: {
                get: () => "text/html"
            },
            text: async () => "<html><h1>405 Not Allowed</h1></html>",
            json: async () => {
                throw new SyntaxError("Unexpected token '<'");
            }
        });

        await expect(previewActualPassword({
            fullName: "Test User",
            email: "test@example.com",
            dateOfBirth: "2000-01-01"
        })).rejects.toThrow("Request failed with 405 Method Not Allowed");
    });
});
