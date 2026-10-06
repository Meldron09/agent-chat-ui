import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SkillRunScreen } from "./skill-run-screen";

const toastError = vi.hoisted(() => vi.fn());
vi.mock("sonner", () => ({ toast: { error: toastError } }));

const stream = vi.hoisted(() => ({
  current: {
    messages: [] as unknown[],
    values: {} as Record<string, unknown>,
    isLoading: false,
    error: undefined as unknown,
    submit: vi.fn(),
  },
}));
const useStream = vi.hoisted(() => vi.fn());
const streamOptions = vi.hoisted(() => ({ current: {} as { onFinish?: () => void } }));
vi.mock("@langchain/langgraph-sdk/react", () => ({ useStream }));

const apiUrl = "http://localhost:2024";

const setStream = (patch: Partial<typeof stream.current>) =>
  Object.assign(stream.current, patch);
const renderScreen = () =>
  render(
    <SkillRunScreen
      apiUrl={apiUrl}
      assistantId="agent"
      skill="reconcile"
    />,
  );
const pick = (...files: File[]) =>
  fireEvent.change(screen.getByLabelText("Files"), { target: { files } });

beforeEach(() => {
  stream.current = {
    messages: [],
    values: {},
    isLoading: false,
    error: undefined,
    submit: vi.fn(),
  };
  useStream.mockImplementation((options) => {
    streamOptions.current = options;
    return stream.current;
  });
  toastError.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ key: "k1.pdf" }))),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("fallback screen", () => {
  it("has a text box, a file picker and a web search switch that is off", () => {
    renderScreen();

    expect(screen.getByLabelText("Input")).toBeInTheDocument();
    expect(screen.getByLabelText("Files")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("lists an uploaded file before submit", async () => {
    renderScreen();
    pick(new File(["x"], "q1.pdf"));

    expect(await screen.findByText("q1.pdf")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`${apiUrl}/files`, expect.anything());
  });

  it("rejects an unsupported file type with a message, without uploading", async () => {
    renderScreen();
    pick(new File(["x"], "photo.png"));

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/photo\.png.*Supported/);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByText("photo.png")).not.toBeInTheDocument();
  });
});

describe("launch", () => {
  it("submits a Skill Run on a hidden thread with the fields, files and web search choice", async () => {
    renderScreen();
    fireEvent.change(screen.getByLabelText("Input"), {
      target: { value: "Compare Q1 " },
    });
    pick(new File(["x"], "q1.pdf"));
    await screen.findByText("q1.pdf");
    fireEvent.click(screen.getByRole("switch"));
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    expect(stream.current.submit).toHaveBeenCalledTimes(1);
    const [input, options] = stream.current.submit.mock.calls[0];
    expect(input.messages).toHaveLength(1);
    expect(options.metadata).toEqual({ skill_run: true });
    // Resumable, so leaving the page does not cancel the Run.
    expect(options.streamResumable).toBe(true);
    expect(options.config.configurable).toEqual({
      enable_web_search: true,
      skill_run: {
        name: "reconcile",
        fields: { text: "Compare Q1 " },
        files: { files: [{ key: "k1.pdf", filename: "q1.pdf" }] },
      },
    });
  });

  it("swaps the launch panel for the result panel once started", () => {
    renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /run/i }));

    expect(screen.queryByLabelText("Input")).not.toBeInTheDocument();
    expect(screen.getByTestId("skill-run-result")).toBeInTheDocument();
  });
});

describe("result panel", () => {
  const start = () => {
    const view = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /run/i }));
    return view;
  };
  const finish = () => act(() => streamOptions.current.onFinish?.());

  it("shows running while the Run is in progress, not done before it streams", () => {
    setStream({ isLoading: false });
    start();

    expect(screen.getByRole("status")).toHaveTextContent("Running");
  });

  it("shows done with the final message and downloadable Outputs", () => {
    setStream({
      messages: [
        { type: "human", content: "Run the Skill" },
        { type: "ai", content: "Found 3 mismatches." },
      ],
      values: { outputs: [{ key: "o1.xlsx", filename: "report.xlsx" }] },
    });
    start();
    finish();

    expect(screen.getByRole("status")).toHaveTextContent("Done");
    expect(screen.getByText("Found 3 mismatches.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /report\.xlsx/ })).toHaveAttribute(
      "href",
      `${apiUrl}/files/o1.xlsx`,
    );
  });

  it("shows failed with the error", () => {
    setStream({ error: new Error("model unreachable") });
    start();

    expect(screen.getByRole("status")).toHaveTextContent("Failed");
    expect(screen.getByRole("alert")).toHaveTextContent("model unreachable");
  });
});
