import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthWindow } from "./auth-window";
import type { McpServer } from "@/lib/mcp-connections";

const apiUrl = "http://localhost:2024";
const TOKEN = "ghp_supersecret123";

const field = (over: object = {}) => ({
  name: "Authorization",
  description: "Authorization header with authentication token",
  isRequired: true,
  isSecret: true,
  ...over,
});
const server = (credentialFields = [field()]): McpServer => ({
  server: "github",
  title: "GitHub",
  description: "Search code.",
  credentialFields,
  connection: null,
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

function mockFetch(reply: () => Response | Promise<Response>) {
  const fn = vi.fn(async () => reply());
  vi.stubGlobal("fetch", fn);
  return fn;
}

function setup(
  s = server(),
  reply: () => Response | Promise<Response> = () => json({}),
) {
  const fetchMock = mockFetch(reply);
  const onClose = vi.fn();
  const onConnected = vi.fn();
  render(
    <AuthWindow
      apiUrl={apiUrl}
      server={s}
      onClose={onClose}
      onConnected={onConnected}
    />,
  );
  return { fetchMock, onClose, onConnected };
}

const connect = () => screen.getByRole("button", { name: "Connect" });
const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

afterEach(() => vi.unstubAllGlobals());

describe("AuthWindow fields", () => {
  it("renders one input per credential field from the schema", () => {
    setup(
      server([
        field(),
        field({
          name: "GITHUB_HOST",
          description: "Only for Enterprise.",
          isRequired: false,
          isSecret: false,
        }),
      ]),
    );

    expect(screen.getByLabelText("Authorization")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByLabelText(/GITHUB_HOST/)).toHaveProperty("type", "text");
    expect(screen.getByText("Only for Enterprise.")).toBeInTheDocument();
    expect(screen.getByText(/optional/i)).toBeInTheDocument();
  });

  it("keeps Connect disabled until every required field is filled", () => {
    setup(
      server([
        field(),
        field({ name: "GITHUB_HOST", isRequired: false, isSecret: false }),
      ]),
    );
    expect(connect()).toBeDisabled();

    type(/GITHUB_HOST/, "https://ghe.example.com"); // optional alone isn't enough
    expect(connect()).toBeDisabled();

    type("Authorization", "   "); // whitespace isn't a value
    expect(connect()).toBeDisabled();

    type("Authorization", TOKEN);
    expect(connect()).toBeEnabled();
  });
});

describe("AuthWindow submit", () => {
  it("PUTs the credentials keyed by field name, omitting blank optionals", async () => {
    const { fetchMock } = setup(
      server([
        field(),
        field({ name: "GITHUB_HOST", isRequired: false, isSecret: false }),
      ]),
      () =>
        json({
          login: "octocat",
          scopes: ["repo"],
          toolCount: 3,
          enabled: true,
        }),
    );
    type("Authorization", TOKEN);

    fireEvent.click(connect());

    await screen.findByText(/Connected as @octocat/);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${apiUrl}/mcp/connections/github/credentials`);
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toEqual({ Authorization: TOKEN });
  });

  it("trims pasted whitespace before sending", async () => {
    const { fetchMock } = setup(server(), () =>
      json({ login: "octocat", scopes: [], toolCount: 0, enabled: true }),
    );
    type("Authorization", `  ${TOKEN}\n`);

    fireEvent.click(connect());

    await screen.findByText(/Connected as/);
    const [, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(init.body as string)).toEqual({ Authorization: TOKEN });
  });

  it("disables the form while pending", async () => {
    let finish!: (r: Response) => void;
    setup(server(), () => new Promise<Response>((r) => (finish = r)));
    type("Authorization", TOKEN);

    fireEvent.click(connect());

    expect(await screen.findByLabelText("Authorization")).toBeDisabled();
    expect(screen.getByRole("button", { name: /Verifying/ })).toBeDisabled();
    finish(json({ login: "octocat", scopes: [], toolCount: 0, enabled: true }));
    await screen.findByText(/Connected as/);
  });

  it("on success shows login, scopes and tool count, drops the secret, and notifies", async () => {
    const { onConnected } = setup(server(), () =>
      json({
        login: "octocat",
        scopes: ["repo", "read:org"],
        toolCount: 41,
        enabled: true,
      }),
    );
    type("Authorization", TOKEN);

    fireEvent.click(connect());

    expect(
      await screen.findByText(/Connected as @octocat/),
    ).toBeInTheDocument();
    expect(screen.getByText(/repo, read:org/)).toBeInTheDocument();
    expect(screen.getByText(/41 tools/)).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    expect(screen.queryByLabelText("Authorization")).not.toBeInTheDocument();
    expect(onConnected).toHaveBeenCalledOnce();
  });

  it.each([
    [422, "GitHub rejected this token (401 Bad credentials)"],
    [
      502,
      "Token is valid but the GitHub MCP server could not be reached: timeout",
    ],
  ])("renders a %i error body inline, verbatim", async (status, error) => {
    const { onConnected } = setup(server(), () => json({ error }, status));
    type("Authorization", TOKEN);

    fireEvent.click(connect());

    expect(await screen.findByText(error)).toBeInTheDocument();
    expect(onConnected).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain(TOKEN);
    // secret was dropped; form is usable again once it's re-entered
    expect(screen.getByLabelText("Authorization")).toHaveValue("");
    type("Authorization", TOKEN);
    expect(connect()).toBeEnabled();
  });

  it("shows a network failure inline", async () => {
    setup(server(), () => {
      throw new Error("network down");
    });
    type("Authorization", TOKEN);

    fireEvent.click(connect());

    expect(await screen.findByText("network down")).toBeInTheDocument();
  });

  it("Cancel closes without a request", () => {
    const { fetchMock, onClose } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("AuthWindow from the MCP tab", () => {
  it("opens on Connect, and refreshes the list after success", async () => {
    const { McpTab } = await import("./mcp-tab");
    let connected = false;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${url.replace(apiUrl, "")}`;
      if (key === "PUT /mcp/connections/github/credentials") {
        connected = true;
        return json({
          login: "octocat",
          scopes: ["repo"],
          toolCount: 5,
          enabled: true,
        });
      }
      if (key === "GET /mcp/connections")
        return json([
          {
            ...server(),
            connection: connected
              ? {
                  enabled: true,
                  login: "octocat",
                  scopes: ["repo"],
                  toolCount: 5,
                  lastError: null,
                }
              : null,
          },
        ]);
      throw new Error(`unexpected fetch: ${key}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<McpTab apiUrl={apiUrl} />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    fireEvent.change(await screen.findByLabelText("Authorization"), {
      target: { value: TOKEN },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() =>
      expect(screen.getByText(/Connected as octocat/)).toBeInTheDocument(),
    );
  });

  it("keeps the window open and reports it when the refresh fails", async () => {
    const { McpTab } = await import("./mcp-tab");
    let puts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          puts++;
          return json({
            login: "octocat",
            scopes: [],
            toolCount: 1,
            enabled: true,
          });
        }
        return puts ? json({ error: "store down" }, 500) : json([server()]);
      }),
    );
    render(<McpTab apiUrl={apiUrl} />);

    fireEvent.click(await screen.findByRole("button", { name: "Connect" }));
    fireEvent.change(await screen.findByLabelText("Authorization"), {
      target: { value: TOKEN },
    });
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    expect(
      await screen.findByText(/Connected as @octocat/),
    ).toBeInTheDocument();
    expect(await screen.findByText("store down")).toBeInTheDocument();
    expect(screen.getByText(/Connected as @octocat/)).toBeInTheDocument();
  });
});
