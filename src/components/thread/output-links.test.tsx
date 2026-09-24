import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OutputLinks } from "./output-links";

describe("OutputLinks", () => {
  it("renders nothing when there are no outputs", () => {
    const { container } = render(
      <OutputLinks
        outputs={undefined}
        apiUrl="http://localhost:2024"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing for an empty outputs list", () => {
    const { container } = render(
      <OutputLinks
        outputs={[]}
        apiUrl="http://localhost:2024"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a download link per Output, pointing at GET /files/{key}", () => {
    render(
      <OutputLinks
        outputs={[{ key: "a1b2c3d4.xlsx", filename: "demo-workbook.xlsx" }]}
        apiUrl="http://localhost:2024"
      />,
    );

    const link = screen.getByRole("link", { name: /demo-workbook\.xlsx/ });
    expect(link).toHaveAttribute(
      "href",
      "http://localhost:2024/files/a1b2c3d4.xlsx",
    );
    expect(link).toHaveAttribute("download", "demo-workbook.xlsx");
  });

  it("renders one link per Output when a run produced more than one", () => {
    render(
      <OutputLinks
        outputs={[
          { key: "k1.pptx", filename: "board-deck.pptx" },
          { key: "k2.txt", filename: "run-notes.txt" },
        ]}
        apiUrl="http://localhost:2024"
      />,
    );

    expect(
      screen.getByRole("link", { name: /board-deck\.pptx/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /run-notes\.txt/ }),
    ).toBeInTheDocument();
  });
});
