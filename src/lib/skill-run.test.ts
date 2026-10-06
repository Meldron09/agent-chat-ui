import { describe, expect, it } from "vitest";
import {
  isChatThread,
  skillRunInput,
  skillRunStatus,
  SKILL_RUN_METADATA,
} from "./skill-run";

describe("skillRunInput", () => {
  it("builds the run's message and the configurable deepagent-aegra's SkillRunMiddleware reads", () => {
    const files = [{ key: "k1.pdf", filename: "q1.pdf" }];
    const { input, options } = skillRunInput({
      skill: "reconcile",
      fields: { text: " Compare Q1 " },
      files: { files },
      enableWebSearch: true,
    });

    expect(input.messages[0]).toMatchObject({
      type: "human",
      content: 'Run the Skill "reconcile".',
    });
    expect(options.config.configurable).toEqual({
      enable_web_search: true,
      skill_run: {
        name: "reconcile",
        fields: { text: " Compare Q1 " }, // verbatim, not trimmed
        files: { files },
      },
    });
    expect(options.metadata).toEqual(SKILL_RUN_METADATA);
  });

  it("omits a file name with nothing uploaded", () => {
    const { options } = skillRunInput({
      skill: "s",
      fields: {},
      files: { first: [], second: [] },
      enableWebSearch: false,
    });
    expect(options.config.configurable.skill_run.files).toEqual({});
    expect(options.config.configurable.enable_web_search).toBe(false);
  });
});

describe("isChatThread", () => {
  it("hides Skill Run threads from the chat list", () => {
    expect(isChatThread({ metadata: { skill_run: true } })).toBe(false);
    expect(isChatThread({ metadata: { graph_id: "agent" } })).toBe(true);
    expect(isChatThread({})).toBe(true);
  });
});

describe("skillRunStatus", () => {
  it("is running until the stream finishes, even before isLoading turns true", () => {
    expect(
      skillRunStatus({ isLoading: true, started: true, finished: false }),
    ).toBe("running");
    expect(
      skillRunStatus({ isLoading: false, started: true, finished: false }),
    ).toBe("running");
  });
  it("is failed on an error and done once finished", () => {
    expect(
      skillRunStatus({
        isLoading: false,
        error: new Error("x"),
        started: true,
        finished: false,
      }),
    ).toBe("failed");
    expect(
      skillRunStatus({ isLoading: false, started: true, finished: true }),
    ).toBe("done");
  });
  it("is idle before the Run starts", () => {
    expect(
      skillRunStatus({ isLoading: false, started: false, finished: false }),
    ).toBe("idle");
  });
});
