import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SkillHistory } from "./skill-history";
import { SkillsPage } from "./skills-page";
import type { SkillRunRecord } from "@/lib/skill-runs";

const apiUrl = "http://localhost:2024";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const run = (over: Partial<SkillRunRecord> = {}): SkillRunRecord => ({
  id: "t-1",
  skill: "reconcile",
  startedAt: "2026-10-06T10:00:00+00:00",
  installedAt: "2026-10-01T10:00:00+00:00",
  fields: { period: "Q1" },
  files: { ledger: [{ key: "up1.xlsx", filename: "q1.xlsx" }] },
  status: "done",
  finalMessage: "Reconciled 12 rows.",
  outputs: [{ key: "out1.xlsx", filename: "diff.xlsx" }],
  skillState: null,
  ...over,
});

/** Routes by `METHOD /path`; unmatched calls fail the test loudly. */
function mockFetch(routes: Record<string, () => Response>) {
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

describe("SkillHistory list", () => {
  it("lists the Skill's past Runs, each linking to its detail, marked when the Skill changed", async () => {
    mockFetch({
      "GET /skill-runs?skill=reconcile": () =>
        json([
          run({ id: "t-2", status: "failed", skillState: "updated" }),
          run({ id: "t-1" }),
        ]),
    });
    render(
      <SkillHistory
        apiUrl={apiUrl}
        skill="reconcile"
      />,
    );

    const links = await screen.findAllByRole("link", { name: /Done|Failed/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Failed");
    expect(within(links[0]).getByText("updated")).toBeInTheDocument();
    expect(within(links[1]).queryByText("updated")).toBeNull();
    expect(links[1]).toHaveAttribute(
      "href",
      `/skills/history?apiUrl=${encodeURIComponent(apiUrl)}&skill=reconcile&run=t-1`,
    );
  });

  it("marks the Runs of a deleted Skill as removed", async () => {
    mockFetch({
      "GET /skill-runs?skill=reconcile": () =>
        json([run({ skillState: "removed" })]),
    });
    render(
      <SkillHistory
        apiUrl={apiUrl}
        skill="reconcile"
      />,
    );

    expect(await screen.findByText("removed")).toBeInTheDocument();
  });

  it("says so when there are no Runs", async () => {
    mockFetch({ "GET /skill-runs?skill=reconcile": () => json([]) });
    render(
      <SkillHistory
        apiUrl={apiUrl}
        skill="reconcile"
      />,
    );

    expect(await screen.findByText(/no runs yet/i)).toBeInTheDocument();
  });
});

describe("SkillHistory detail", () => {
  it("shows what was submitted, the final message, and downloadable Outputs", async () => {
    mockFetch({ "GET /skill-runs/t-1": () => json(run()) });
    render(
      <SkillHistory
        apiUrl={apiUrl}
        skill="reconcile"
        runId="t-1"
      />,
    );

    const detail = await screen.findByTestId("skill-run-detail");
    expect(within(detail).getByText(/"period": "Q1"/)).toBeInTheDocument();
    expect(within(detail).getByText("ledger: q1.xlsx")).toBeInTheDocument();
    expect(within(detail).getByText("Reconciled 12 rows.")).toBeInTheDocument();
    expect(
      within(detail).getByRole("link", { name: /diff\.xlsx/ }),
    ).toHaveAttribute("href", `${apiUrl}/files/out1.xlsx`);
  });

  it("shows why a Run could not be loaded", async () => {
    mockFetch({
      "GET /skill-runs/gone": () =>
        json({ error: "No Skill Run with id 'gone'" }, 404),
    });
    render(
      <SkillHistory
        apiUrl={apiUrl}
        skill="reconcile"
        runId="gone"
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No Skill Run with id 'gone'",
    );
  });
});

describe("SkillsPage history links", () => {
  const reconcile = { name: "reconcile", description: "d", hasUi: false };

  it("links each Skill to its history, and lists a deleted Skill with Runs as removed", async () => {
    mockFetch({
      "GET /skills": () => json([reconcile]),
      "GET /skill-runs": () =>
        json([
          run({ skill: "gone-skill", skillState: "removed" }),
          run({ id: "t-2", skill: "gone-skill", skillState: "removed" }),
          run({ id: "t-3", skillState: "updated" }),
        ]),
    });
    render(<SkillsPage apiUrl={apiUrl} />);

    const links = await screen.findAllByRole("link", { name: /history/i });
    const hrefs = links.map((l) => l.getAttribute("href"));
    const base = `/skills/history?apiUrl=${encodeURIComponent(apiUrl)}&skill=`;
    expect(hrefs).toEqual([`${base}reconcile`, `${base}gone-skill`]);
    expect(screen.getByText("Removed Skills")).toBeInTheDocument();
  });
});
