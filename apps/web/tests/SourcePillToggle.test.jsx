import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SourcePillToggle } from "../src/features/ip-list/components/SourcePillToggle.jsx";

describe("SourcePillToggle", () => {
  it("calls onChange when a pill is selected", () => {
    const onChange = vi.fn();
    render(<SourcePillToggle value="" onChange={onChange} />);

    fireEvent.click(screen.getByRole("radio", { name: "Asset" }));
    expect(onChange).toHaveBeenCalledWith("asset");
  });
});
