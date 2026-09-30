/** Client for deepagent-aegra's `/mcp/connections` settings API (contract in
 * deepagent-aegra/agent/mcp/app.py's module docstring). Errors are always
 * `{"error": message}`; we surface the message and never parse further. */
export interface McpConnection {
  enabled: boolean;
  login: string;
  scopes: string[];
  toolCount: number;
  lastError: string | null;
}

export interface McpServer {
  server: string;
  title: string;
  description: string;
  /** `null` means never connected. */
  connection: McpConnection | null;
}

async function failure(res: Response): Promise<Error> {
  try {
    const { error } = (await res.json()) as { error?: string };
    if (error) return new Error(error);
  } catch {
    // body wasn't JSON -- fall through to the status
  }
  return new Error(`Request failed (${res.status})`);
}

async function call(apiUrl: string, path: string, init?: RequestInit) {
  const res = await fetch(`${apiUrl}/mcp/connections${path}`, init);
  if (!res.ok) throw await failure(res);
  return res;
}

export async function listMcpServers(apiUrl: string): Promise<McpServer[]> {
  return (await call(apiUrl, "")).json();
}

export async function setMcpEnabled(
  apiUrl: string,
  server: string,
  enabled: boolean,
): Promise<void> {
  await call(apiUrl, `/${server}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled }),
  });
}

export async function disconnectMcp(
  apiUrl: string,
  server: string,
): Promise<void> {
  await call(apiUrl, `/${server}`, { method: "DELETE" });
}
