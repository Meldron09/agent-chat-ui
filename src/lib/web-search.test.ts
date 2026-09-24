import { describe, expect, it } from "vitest";
import { webSearchConfigForRun } from "./web-search";

describe("webSearchConfigForRun", () => {
  it("carries enable_web_search: true when the toggle is on", () => {
    expect(webSearchConfigForRun(true)).toEqual({
      configurable: { enable_web_search: true },
    });
  });

  it("carries enable_web_search: false when the toggle is off", () => {
    expect(webSearchConfigForRun(false)).toEqual({
      configurable: { enable_web_search: false },
    });
  });
});
