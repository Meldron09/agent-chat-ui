import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { WebSearchToggle } from "./web-search-toggle";
import { webSearchConfigForRun } from "@/lib/web-search";

describe("WebSearchToggle", () => {
  it("reflects an off toggle as unchecked", () => {
    render(
      <WebSearchToggle
        checked={false}
        onCheckedChange={() => {}}
      />,
    );

    expect(screen.getByRole("switch", { name: /web search/i })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("reflects an on toggle as checked", () => {
    render(
      <WebSearchToggle
        checked={true}
        onCheckedChange={() => {}}
      />,
    );

    expect(screen.getByRole("switch", { name: /web search/i })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("calls onCheckedChange(true) when clicked while off", () => {
    const onCheckedChange = vi.fn();
    render(
      <WebSearchToggle
        checked={false}
        onCheckedChange={onCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /web search/i }));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it("calls onCheckedChange(false) when clicked while on", () => {
    const onCheckedChange = vi.fn();
    render(
      <WebSearchToggle
        checked={true}
        onCheckedChange={onCheckedChange}
      />,
    );

    fireEvent.click(screen.getByRole("switch", { name: /web search/i }));

    expect(onCheckedChange).toHaveBeenCalledWith(false);
  });
});

// `WebSearchToggle`'s own tests above cover it in isolation, and
// `src/lib/web-search.test.ts` covers `webSearchConfigForRun` in isolation --
// this reproduces the actual composition `index.tsx`'s `handleSubmit` does
// (`enableWebSearch` state -> `checked`/`onCheckedChange` -> `config:
// webSearchConfigForRun(enableWebSearch ?? false)`), so a click on the
// switch is proven to change what the *next* submission would carry, not
// just that the two pieces work independently.
function ComposerHarness({
  onSubmit,
}: {
  onSubmit: (config: ReturnType<typeof webSearchConfigForRun>) => void;
}) {
  const [enableWebSearch, setEnableWebSearch] = useState(false);
  return (
    <div>
      <WebSearchToggle
        checked={enableWebSearch}
        onCheckedChange={setEnableWebSearch}
      />
      <button
        type="button"
        onClick={() => onSubmit(webSearchConfigForRun(enableWebSearch))}
      >
        Send
      </button>
    </div>
  );
}

describe("toggling the switch and submitting", () => {
  it("a submission after toggling on carries enable_web_search: true", () => {
    const onSubmit = vi.fn();
    render(<ComposerHarness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("switch", { name: /web search/i }));
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      configurable: { enable_web_search: true },
    });
  });

  it("a submission with no toggle click carries enable_web_search: false", () => {
    const onSubmit = vi.fn();
    render(<ComposerHarness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      configurable: { enable_web_search: false },
    });
  });

  it("a second submission after toggling back off carries enable_web_search: false", () => {
    const onSubmit = vi.fn();
    render(<ComposerHarness onSubmit={onSubmit} />);
    const toggle = screen.getByRole("switch", { name: /web search/i });
    const send = screen.getByRole("button", { name: /send/i });

    fireEvent.click(toggle); // on
    fireEvent.click(send);
    fireEvent.click(toggle); // back off
    fireEvent.click(send);

    expect(onSubmit).toHaveBeenNthCalledWith(1, {
      configurable: { enable_web_search: true },
    });
    expect(onSubmit).toHaveBeenNthCalledWith(2, {
      configurable: { enable_web_search: false },
    });
  });
});
