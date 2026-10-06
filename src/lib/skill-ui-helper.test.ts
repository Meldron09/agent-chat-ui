// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseSubmit, statusMessage } from "./skill-ui";

// The copy-paste helper from the author guide (deepagent-aegra/docs), run in a
// fake sandboxed frame and checked against the host's real message parsing.
const helperPath = path.resolve(
  import.meta.dirname,
  "../../../deepagent-aegra/docs/examples/two-file-skill/ui/skill-ui.js",
);

describe.skipIf(!existsSync(helperPath))("the guide's copy-paste helper", () => {
  function loadHelper() {
    const parent = { postMessage: vi.fn() };
    let listener: (e: unknown) => void = () => {};
    const source = readFileSync(helperPath, "utf8").replace(/export /g, "");
    const api = new Function(
      "parent",
      "addEventListener",
      `${source}; return { submit, onStatus };`,
    )(parent, (_: string, l: (e: unknown) => void) => (listener = l));
    return { ...api, parent, deliver: (e: unknown) => listener(e) };
  }

  it("submit posts what the host's parseSubmit accepts", () => {
    const { submit, parent } = loadHelper();
    const ledger = new File(["l"], "ledger.xlsx");
    const bank = new File(["b"], "bank.pdf");

    submit({ period: "Q1" }, { ledger, bank });

    const [message, target] = parent.postMessage.mock.calls[0];
    expect(target).toBe("*");
    expect(parseSubmit(message)).toEqual({
      fields: { period: "Q1" },
      files: { ledger: [ledger], bank: [bank] },
    });
  });

  it("onStatus receives the host's status events from the parent only", () => {
    const { onStatus, parent, deliver } = loadHelper();
    const seen = vi.fn();
    onStatus(seen);

    deliver({ source: {}, data: statusMessage("done") });
    deliver({ source: parent, data: { type: "other" } });
    deliver({ source: parent, data: statusMessage("failed", "Unsupported") });

    expect(seen).toHaveBeenCalledOnce();
    expect(seen).toHaveBeenCalledWith({
      type: "status",
      state: "failed",
      message: "Unsupported",
    });
  });
});
