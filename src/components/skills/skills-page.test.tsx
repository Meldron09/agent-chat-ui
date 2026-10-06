import { describe, expect, it, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SkillsPage } from "./skills-page";

const apiUrl = "http://localhost:2024";

const reconcile = {
  name: "reconcile",
  description: "Reconcile two spreadsheets",
  hasUi: true,
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

const zip = () =>
  new File(["zip"], "reconcile.zip", { type: "application/zip" });
const pick = (file: File) =>
  fireEvent.change(screen.getByLabelText("Skill zip"), {
    target: { files: [file] },
  });

afterEach(() => vi.unstubAllGlobals());

describe("SkillsPage list", () => {
  it("lists every installed Skill with its name and description", async () => {
    mockFetch({
      "GET /skills": () =>
        json([
          reconcile,
          { name: "summarise", description: "Summarise a doc", hasUi: false },
        ]),
    });
    render(<SkillsPage apiUrl={apiUrl} />);

    expect(await screen.findByText("reconcile")).toBeInTheDocument();
    expect(screen.getByText("Reconcile two spreadsheets")).toBeInTheDocument();
    expect(screen.getByText("summarise")).toBeInTheDocument();
    expect(screen.getByText("Summarise a doc")).toBeInTheDocument();
  });

  it("links each Skill to its run screen on the same backend", async () => {
    mockFetch({ "GET /skills": () => json([reconcile]) });
    render(<SkillsPage apiUrl={apiUrl} />);

    const open = await screen.findByRole("link", { name: /open/i });
    expect(open).toHaveAttribute(
      "href",
      `/skills/run?apiUrl=${encodeURIComponent(apiUrl)}&skill=reconcile`,
    );
  });

  it("says so when no Skill is installed", async () => {
    mockFetch({ "GET /skills": () => json([]) });
    render(<SkillsPage apiUrl={apiUrl} />);

    expect(await screen.findByText(/no skills installed/i)).toBeInTheDocument();
  });

  it("shows why the list could not load", async () => {
    mockFetch({
      "GET /skills": () => json({ error: "disk unavailable" }, 500),
    });
    render(<SkillsPage apiUrl={apiUrl} />);

    expect(await screen.findByText("disk unavailable")).toBeInTheDocument();
  });
});

describe("SkillsPage install", () => {
  it("uploads the zip and shows the new Skill", async () => {
    let installed = false;
    const fetchFn = mockFetch({
      "GET /skills": () => json(installed ? [reconcile] : []),
      "POST /skills": () => {
        installed = true;
        return json(reconcile, 201);
      },
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText(/no skills installed/i);

    pick(zip());

    expect(await screen.findByText("reconcile")).toBeInTheDocument();
    const post = fetchFn.mock.calls.find(([, init]) => init?.method === "POST");
    expect((post![1]!.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("shows the refusal message, naming the failed rule", async () => {
    mockFetch({
      "GET /skills": () => json([]),
      "POST /skills": () =>
        json({ error: "SKILL.md is missing from the zip" }, 422),
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText(/no skills installed/i);

    pick(zip());

    expect(
      await screen.findByText("SKILL.md is missing from the zip"),
    ).toBeInTheDocument();
    expect(screen.getByText(/no skills installed/i)).toBeInTheDocument();
  });

  it("clears an earlier error when the next install works", async () => {
    let attempt = 0;
    mockFetch({
      "GET /skills": () => json([]),
      "POST /skills": () =>
        attempt++ === 0
          ? json({ error: "The upload is not a valid zip file" }, 422)
          : json(reconcile, 201),
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText(/no skills installed/i);

    pick(zip());
    await screen.findByText("The upload is not a valid zip file");
    pick(zip());

    await waitFor(() =>
      expect(
        screen.queryByText("The upload is not a valid zip file"),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("SkillsPage replace", () => {
  const replaceZip = () =>
    fireEvent.change(screen.getByLabelText("Replace reconcile with a zip"), {
      target: { files: [zip()] },
    });

  it("PUTs the zip to the Skill and shows the new description", async () => {
    let description = reconcile.description;
    const fetchFn = mockFetch({
      "GET /skills": () => json([{ ...reconcile, description }]),
      "PUT /skills/reconcile": () => {
        description = "Reconcile N sheets";
        return json({ ...reconcile, description });
      },
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText("Reconcile two spreadsheets");

    replaceZip();

    expect(await screen.findByText("Reconcile N sheets")).toBeInTheDocument();
    const put = fetchFn.mock.calls.find(([, init]) => init?.method === "PUT");
    expect((put![1]!.body as FormData).get("file")).toBeInstanceOf(File);
  });

  it("shows the refusal and keeps the old Skill listed", async () => {
    mockFetch({
      "GET /skills": () => json([reconcile]),
      "PUT /skills/reconcile": () =>
        json({ error: "SKILL.md is missing from the zip" }, 422),
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText("reconcile");

    replaceZip();

    expect(
      await screen.findByText("SKILL.md is missing from the zip"),
    ).toBeInTheDocument();
    expect(screen.getByText("Reconcile two spreadsheets")).toBeInTheDocument();
  });
});

describe("SkillsPage delete", () => {
  const isDelete = ([, init]: [unknown, RequestInit?]) =>
    init?.method === "DELETE";

  it("asks for confirmation, and only deletes once confirmed", async () => {
    let deleted = false;
    const fetchFn = mockFetch({
      "GET /skills": () => json(deleted ? [] : [reconcile]),
      "DELETE /skills/reconcile": () => {
        deleted = true;
        return new Response(null, { status: 204 });
      },
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText("reconcile");

    fireEvent.click(screen.getByRole("button", { name: "Delete reconcile" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("reconcile");
    expect(fetchFn.mock.calls.some(isDelete)).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText(/no skills installed/i)).toBeInTheDocument();
    expect(fetchFn.mock.calls.filter(isDelete)).toHaveLength(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps the Skill when the confirmation is cancelled", async () => {
    const fetchFn = mockFetch({ "GET /skills": () => json([reconcile]) });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText("reconcile");

    fireEvent.click(screen.getByRole("button", { name: "Delete reconcile" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(fetchFn.mock.calls.some(isDelete)).toBe(false);
    expect(screen.getByText("reconcile")).toBeInTheDocument();
  });

  it("shows why a delete failed", async () => {
    mockFetch({
      "GET /skills": () => json([reconcile]),
      "DELETE /skills/reconcile": () =>
        json({ error: "No Skill named 'reconcile'" }, 404),
    });
    render(<SkillsPage apiUrl={apiUrl} />);
    await screen.findByText("reconcile");

    fireEvent.click(screen.getByRole("button", { name: "Delete reconcile" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));

    expect(
      await screen.findByText("No Skill named 'reconcile'"),
    ).toBeInTheDocument();
  });
});
