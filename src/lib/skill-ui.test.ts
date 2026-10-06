import { afterEach, describe, expect, it, vi } from "vitest";
import { parseSubmit, statusMessage, uploadSkillFiles } from "./skill-ui";

describe("parseSubmit", () => {
  it("reads fields and named files, a single File counting as a list of one", () => {
    const a = new File(["a"], "a.pdf");
    const b = new File(["b"], "b.pdf");
    const c = new File(["c"], "c.xlsx");

    expect(
      parseSubmit({
        type: "submit",
        fields: { note: "hi", n: 2 },
        files: { first: a, second: [b, c] },
      }),
    ).toEqual({
      fields: { note: "hi", n: 2 },
      files: { first: [a], second: [b, c] },
    });
  });

  it("drops an empty slot instead of refusing the submit", () => {
    const a = new File(["a"], "a.pdf");
    expect(
      parseSubmit({
        type: "submit",
        files: { first: a, second: undefined, third: null, fourth: [] },
      }),
    ).toEqual({ fields: {}, files: { first: [a] } });
  });

  it("defaults missing fields and files to empty", () => {
    expect(parseSubmit({ type: "submit" })).toEqual({ fields: {}, files: {} });
  });

  it("ignores other messages and malformed submits", () => {
    expect(parseSubmit("submit")).toBeNull();
    expect(parseSubmit(null)).toBeNull();
    expect(parseSubmit({ type: "status" })).toBeNull();
    expect(parseSubmit({ type: "submit", fields: "x" })).toBeNull();
    expect(parseSubmit({ type: "submit", fields: [] })).toBeNull();
    expect(
      parseSubmit({ type: "submit", files: { a: "not a file" } }),
    ).toBeNull();
    expect(
      parseSubmit({ type: "submit", files: { a: [new File([], "a.pdf"), 1] } }),
    ).toBeNull();
  });
});

describe("statusMessage", () => {
  it("is the status event the UI receives", () => {
    expect(statusMessage("running")).toEqual({
      type: "status",
      state: "running",
    });
    expect(statusMessage("failed", "Unsupported file")).toEqual({
      type: "status",
      state: "failed",
      message: "Unsupported file",
    });
  });
});

describe("uploadSkillFiles", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ key: `k${fetchMock.mock.calls.length}` }),
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  };

  it("uploads each file and returns Attachments keyed by field name", async () => {
    stub();
    const out = await uploadSkillFiles("http://api", {
      first: [new File(["a"], "a.pdf")],
      second: [new File(["b"], "b.xlsx"), new File(["c"], "c.docx")],
    });

    expect(out).toEqual({
      first: [{ key: "k1", filename: "a.pdf" }],
      second: [
        { key: "k2", filename: "b.xlsx" },
        { key: "k3", filename: "c.docx" },
      ],
    });
  });

  it("uploads a copy of each File, not the one posted from the sandboxed frame", async () => {
    const fetchMock = stub();
    const original = new File(["hello"], "a.pdf", { type: "application/pdf" });

    await uploadSkillFiles("http://api", { first: [original] });

    const sent = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
      .body as FormData;
    const copy = sent.get("file") as File;
    expect(copy).not.toBe(original);
    expect([copy.name, copy.type]).toEqual(["a.pdf", "application/pdf"]);
    expect(await copy.text()).toBe("hello");
  });

  it("refuses an unsupported type before uploading anything", async () => {
    const fetchMock = stub();

    await expect(
      uploadSkillFiles("http://api", {
        a: [new File(["x"], "ok.pdf")],
        b: [new File(["x"], "photo.png")],
      }),
    ).rejects.toThrow(/photo\.png.*Supported/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails when an upload fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 500 })),
    );
    await expect(
      uploadSkillFiles("http://api", { a: [new File(["x"], "a.pdf")] }),
    ).rejects.toThrow(/a\.pdf/);
  });
});
