import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useFileUpload } from "./use-file-upload";

function makeFile(name: string, type = "text/plain"): File {
  return new File(["hello"], name, { type });
}

function changeEventFor(files: File[]) {
  return {
    target: { files, value: "" },
  } as unknown as React.ChangeEvent<HTMLInputElement>;
}

describe("useFileUpload", () => {
  const apiUrl = "http://localhost:2024";

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ key: "a1b2c3d4.txt" }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POSTs a selected file to /files and stores {key, filename}, not base64 content", async () => {
    const { result } = renderHook(() => useFileUpload({ apiUrl }));

    await act(async () => {
      await result.current.handleFileUpload(
        changeEventFor([makeFile("notes.txt")]),
      );
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe(`${apiUrl}/files`);
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);

    expect(result.current.attachments).toEqual([
      { key: "a1b2c3d4.txt", filename: "notes.txt" },
    ]);
  });

  it("rejects an unsupported file type without uploading it", async () => {
    const { result } = renderHook(() => useFileUpload({ apiUrl }));

    await act(async () => {
      await result.current.handleFileUpload(
        changeEventFor([makeFile("image.png", "image/png")]),
      );
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.attachments).toEqual([]);
  });

  it("rejects a duplicate filename without a second upload call", async () => {
    const { result } = renderHook(() => useFileUpload({ apiUrl }));

    await act(async () => {
      await result.current.handleFileUpload(
        changeEventFor([makeFile("notes.txt")]),
      );
    });
    await act(async () => {
      await result.current.handleFileUpload(
        changeEventFor([makeFile("notes.txt")]),
      );
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(result.current.attachments).toHaveLength(1);
  });

  it("removeAttachment drops the attachment at the given index", async () => {
    const { result } = renderHook(() => useFileUpload({ apiUrl }));

    await act(async () => {
      await result.current.handleFileUpload(
        changeEventFor([makeFile("notes.txt")]),
      );
    });
    act(() => {
      result.current.removeAttachment(0);
    });

    expect(result.current.attachments).toEqual([]);
  });
});
