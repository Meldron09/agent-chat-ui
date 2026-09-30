import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { McpTab } from "./mcp-tab";

const apiUrl = "http://localhost:2024";

const entry = (connection: unknown) => ({
  server: "github",
  title: "GitHub",
  description: "Search code and work with repositories.",
  credentialFields: [],
  connection,
});
const connected = {
  enabled: true,
  login: "octocat",
  scopes: ["repo"],
  toolCount: 12,
  lastError: null,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

/** Routes by `METHOD /path`; unmatched calls fail the test loudly. */
function mockFetch(routes: Record<string, () => Response | Promise<Response>>) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? "GET"} ${url.replace(apiUrl, "")}`;
    const route = routes[key];
    if (!route) throw new Error(`unexpected fetch: ${key}`);
    return route();
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("McpTab list", () => {
  it("shows a never-connected server with Connect and no switch", async () => {
    mockFetch({ "GET /mcp/connections": () => json([entry(null)]) });
    render(<McpTab apiUrl={apiUrl} />);

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByText("GitHub", { selector: "div" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("shows a connected server with an on switch and Disconnect", async () => {
    mockFetch({ "GET /mcp/connections": () => json([entry(connected)]) });
    render(<McpTab apiUrl={apiUrl} />);

    expect(await screen.findByText(/octocat/)).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /github enabled/i }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("button", { name: "Disconnect" }),
    ).toBeInTheDocument();
  });

  it("shows lastError on the row with a Reconnect action", async () => {
    mockFetch({
      "GET /mcp/connections": () =>
        json([entry({ ...connected, lastError: "token expired" })]),
    });
    render(<McpTab apiUrl={apiUrl} />);

    expect(await screen.findByText("token expired")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reconnect" }),
    ).toBeInTheDocument();
  });

  it("shows the server's error message when the list fails to load", async () => {
    mockFetch({
      "GET /mcp/connections": () => json({ error: "store key unset" }, 500),
    });
    render(<McpTab apiUrl={apiUrl} />);

    expect(await screen.findByText(/store key unset/)).toBeInTheDocument();
  });
});

describe("McpTab enabled switch", () => {
  it("flips optimistically and PATCHes {enabled}", async () => {
    let resolvePatch!: (r: Response) => void;
    const fetchMock = mockFetch({
      "GET /mcp/connections": () => json([entry(connected)]),
      "PATCH /mcp/connections/github": () =>
        new Promise<Response>((r) => (resolvePatch = r)),
    });
    render(<McpTab apiUrl={apiUrl} />);
    const toggle = await screen.findByRole("switch", {
      name: /github enabled/i,
    });

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-checked", "false"); // before the reply
    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init?.body).toBe(JSON.stringify({ enabled: false }));
    resolvePatch(json({ enabled: false }));
    await waitFor(() =>
      expect(toggle).toHaveAttribute("aria-checked", "false"),
    );
  });

  it("rolls back and shows the error when the PATCH fails", async () => {
    mockFetch({
      "GET /mcp/connections": () => json([entry(connected)]),
      "PATCH /mcp/connections/github": () => json({ error: "disk full" }, 500),
    });
    render(<McpTab apiUrl={apiUrl} />);
    const toggle = await screen.findByRole("switch", {
      name: /github enabled/i,
    });

    fireEvent.click(toggle);

    expect(await screen.findByText(/disk full/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("rolls back when the request itself throws", async () => {
    mockFetch({
      "GET /mcp/connections": () => json([entry(connected)]),
      "PATCH /mcp/connections/github": () => {
        throw new Error("network down");
      },
    });
    render(<McpTab apiUrl={apiUrl} />);
    const toggle = await screen.findByRole("switch", {
      name: /github enabled/i,
    });

    fireEvent.click(toggle);

    expect(await screen.findByText(/network down/)).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

describe("McpTab disconnect", () => {
  it("DELETEs and returns the row to never-connected", async () => {
    const fetchMock = mockFetch({
      "GET /mcp/connections": () => json([entry(connected)]),
      "DELETE /mcp/connections/github": () =>
        new Response(null, { status: 204 }),
    });
    render(<McpTab apiUrl={apiUrl} />);

    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText("Not connected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.at(-1)![1]?.method).toBe("DELETE");
  });

  it("keeps the connection and shows the error when DELETE fails", async () => {
    mockFetch({
      "GET /mcp/connections": () => json([entry(connected)]),
      "DELETE /mcp/connections/github": () =>
        json({ error: "read-only volume" }, 500),
    });
    render(<McpTab apiUrl={apiUrl} />);

    fireEvent.click(await screen.findByRole("button", { name: "Disconnect" }));

    expect(await screen.findByText(/read-only volume/)).toBeInTheDocument();
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });
});
