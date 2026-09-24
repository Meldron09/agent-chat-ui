import { describe, expect, it } from "vitest";
import { attachmentsForRun, isSupportedAttachment } from "./attachments";

describe("isSupportedAttachment", () => {
  it("accepts each of the five file-reader formats", () => {
    expect(isSupportedAttachment("report.pdf")).toBe(true);
    expect(isSupportedAttachment("revenue.xlsx")).toBe(true);
    expect(isSupportedAttachment("revenue.xls")).toBe(true);
    expect(isSupportedAttachment("memo.docx")).toBe(true);
    expect(isSupportedAttachment("deck.pptx")).toBe(true);
    expect(isSupportedAttachment("notes.txt")).toBe(true);
    expect(isSupportedAttachment("notes.md")).toBe(true);
  });

  it("rejects an image, since file-reader has no tool for one", () => {
    expect(isSupportedAttachment("photo.png")).toBe(false);
  });

  it("rejects an unrelated extension", () => {
    expect(isSupportedAttachment("archive.zip")).toBe(false);
  });
});

describe("attachmentsForRun", () => {
  it("returns undefined for an empty selection", () => {
    expect(attachmentsForRun([])).toBeUndefined();
  });

  it("passes the exact {key, filename} pairs straight through", () => {
    const attachments = [
      { key: "a1b2.xlsx", filename: "revenue.xlsx" },
      { key: "c3d4.pdf", filename: "report.pdf" },
    ];

    expect(attachmentsForRun(attachments)).toEqual(attachments);
  });
});
