import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Interrupt } from "@langchain/langgraph-sdk";
import { ThreadView } from "./index";
import type { HITLRequest } from "./types";

const submit = vi.fn();

vi.mock("@/providers/Stream", () => ({
  useStreamContext: () => ({ submit, values: {} }),
}));
vi.mock("nuqs", () => ({ useQueryState: () => [null, vi.fn()] }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

// Payload shape captured in docs/research/mcp-hitl-spike.md (Q4): stock HITL
// request from inside the `mcp` subagent, approve/reject only.
const interrupt = (id: string, tool: string): Interrupt<HITLRequest> => ({
  id,
  value: {
    action_requests: [
      {
        name: tool,
        args: { name: "x" },
        description: `Tool execution requires approval\n\nTool: ${tool}`,
      },
    ],
    review_configs: [
      { action_name: tool, allowed_decisions: ["approve", "reject"] },
    ],
  },
});

beforeEach(() => submit.mockClear());

describe("ThreadView resume", () => {
  it("resumes a single pending interrupt with a bare decisions value", () => {
    render(<ThreadView interrupt={interrupt("a", "gh_write_thing")} />);

    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(submit).toHaveBeenCalledWith(
      {},
      { command: { resume: { decisions: [{ type: "approve" }] } } },
    );
  });

  it("keys the resume by interrupt id when several are pending, leaving the others alone", () => {
    render(
      <ThreadView
        interrupt={[
          interrupt("id-1", "gh_write_thing"),
          interrupt("id-2", "gh_delete_thing"),
        ]}
      />,
    );

    // Decide the second interrupt first.
    fireEvent.click(screen.getByRole("button", { name: "gh_delete_thing" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledWith(
      {},
      {
        command: {
          resume: { "id-2": { decisions: [{ type: "approve" }] } },
        },
      },
    );

    // The first is still its own tab and resumes under its own id.
    fireEvent.click(screen.getByRole("button", { name: "gh_write_thing" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(submit).toHaveBeenLastCalledWith(
      {},
      {
        command: {
          resume: { "id-1": { decisions: [{ type: "approve" }] } },
        },
      },
    );
  });

  it("keys Approve All and Submit all by interrupt id too", () => {
    const multiAction = interrupt("id-1", "gh_write_thing");
    multiAction.value!.action_requests.push({
      name: "gh_delete_thing",
      args: {},
      description: "d",
    });
    multiAction.value!.review_configs.push({
      action_name: "gh_delete_thing",
      allowed_decisions: ["approve", "reject"],
    });

    render(
      <ThreadView interrupt={[multiAction, interrupt("id-2", "gh_other")]} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Approve All" }));

    expect(submit).toHaveBeenCalledWith(
      {},
      {
        command: {
          resume: {
            "id-1": { decisions: [{ type: "approve" }, { type: "approve" }] },
          },
        },
      },
    );
  });
});
