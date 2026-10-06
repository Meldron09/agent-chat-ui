import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
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
const streamOptions = vi.hoisted(() => ({
  current: {} as { onFinish?: () => void },
}));
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

describe("Skill UI", () => {
  const renderUi = () =>
    render(
      <SkillRunScreen
        apiUrl={apiUrl}
        assistantId="agent"
        skill="reconcile"
        hasUi
      />,
    );
  const frame = () =>
    screen.getByTitle("reconcile screen") as HTMLIFrameElement;
  const send = (
    data: unknown,
    source: MessageEventSource | null = frame().contentWindow,
  ) =>
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, source }));
    });
  const submitFromUi = (data: unknown = {}) =>
    send({ type: "submit", ...(data as object) });
  /** The status events the frame has been sent so far. */
  const statuses = () => {
    const post = vi.spyOn(frame().contentWindow!, "postMessage");
    return () => post.mock.calls.map(([m]) => m);
  };

  it("shows the Skill's own ui in a sandboxed frame, not the fallback screen", () => {
    renderUi();

    expect(frame()).toHaveAttribute(
      "src",
      `${apiUrl}/skills/reconcile/ui/index.html`,
    );
    expect(frame().getAttribute("sandbox")).toBe("allow-scripts");
    expect(frame().getAttribute("sandbox")).not.toMatch(/allow-same-origin/);
    expect(screen.queryByLabelText("Input")).not.toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("uploads the named files and starts the Run with fields and files keyed by name", async () => {
    renderUi();
    fireEvent.click(screen.getByRole("switch"));
    submitFromUi({
      fields: { period: "Q1", strict: true },
      files: {
        ledger: new File(["a"], "ledger.xlsx"),
        bank: new File(["b"], "bank.pdf"),
      },
    });

    await waitFor(() => expect(stream.current.submit).toHaveBeenCalledTimes(1));
    const [input, options] = stream.current.submit.mock.calls[0];
    expect(input.messages).toHaveLength(1);
    expect(options.metadata).toEqual({ skill_run: true });
    expect(options.streamResumable).toBe(true);
    expect(options.config.configurable).toEqual({
      enable_web_search: true,
      skill_run: {
        name: "reconcile",
        fields: { period: "Q1", strict: true },
        files: {
          ledger: [{ key: "k1.pdf", filename: "ledger.xlsx" }],
          bank: [{ key: "k1.pdf", filename: "bank.pdf" }],
        },
      },
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenCalledWith(`${apiUrl}/files`, expect.anything());
  });

  it("shows the result panel and sends the UI its status", async () => {
    renderUi();
    const sent = statuses();
    submitFromUi({ fields: { period: "Q1" } });

    expect(await screen.findByTestId("skill-run-result")).toBeInTheDocument();
    expect(frame()).toBeInTheDocument(); // the UI stays up to show progress
    expect(sent()).toContainEqual({ type: "status", state: "running" });

    act(() => streamOptions.current.onFinish?.());
    expect(sent().at(-1)).toEqual({ type: "status", state: "done" });
  });

  it("sends the UI a failed status when the Run fails", async () => {
    renderUi();
    const sent = statuses();
    submitFromUi();
    await screen.findByTestId("skill-run-result");
    setStream({ error: new Error("model unreachable") });
    act(() => streamOptions.current.onFinish?.());

    expect(sent().at(-1)).toEqual({ type: "status", state: "failed" });
  });

  it("refuses an unsupported file with a message, starts nothing, and tells the UI", async () => {
    renderUi();
    const sent = statuses();
    submitFromUi({ files: { ledger: new File(["x"], "photo.png") } });

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError.mock.calls[0][0]).toMatch(/photo\.png.*Supported/);
    expect(fetch).not.toHaveBeenCalled();
    expect(stream.current.submit).not.toHaveBeenCalled();
    expect(sent().at(-1)).toMatchObject({
      type: "status",
      state: "failed",
      message: expect.stringMatching(/photo\.png/),
    });

    // and the UI can submit again
    submitFromUi({ files: { ledger: new File(["x"], "ledger.xlsx") } });
    await waitFor(() => expect(stream.current.submit).toHaveBeenCalledTimes(1));
  });

  it("ignores messages that do not come from its own frame", async () => {
    renderUi();
    send({ type: "submit", fields: {} }, window);
    send({ type: "submit", fields: {} }, null);
    send({ type: "other" });
    await act(async () => {});

    expect(stream.current.submit).not.toHaveBeenCalled();
  });

  it("starts only one Run however often the UI submits", async () => {
    renderUi();
    submitFromUi();
    submitFromUi();
    await waitFor(() => expect(stream.current.submit).toHaveBeenCalled());
    submitFromUi();
    await act(async () => {});

    expect(stream.current.submit).toHaveBeenCalledTimes(1);
  });
});
