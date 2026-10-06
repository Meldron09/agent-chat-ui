import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillsLink } from "./skills-link";

describe("SkillsLink", () => {
  it("opens /skills on the same backend", () => {
    render(<SkillsLink apiUrl="http://localhost:2024" />);

    expect(screen.getByRole("link", { name: "Skills" })).toHaveAttribute(
      "href",
      "/skills?apiUrl=http%3A%2F%2Flocalhost%3A2024",
    );
  });
});
