import van from "vanjs-core";
import { afterEach, describe, expect, it } from "vitest";
import { createSheet } from "../src/create-sheet";

const flush = async () => {
  await Promise.resolve();
};

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createSheet sections layout", () => {
  it("renders fixed and scrollable sections as siblings in order", async () => {
    const top = document.createElement("div");
    top.dataset.testid = "top";
    top.textContent = "Top";

    const middle = document.createElement("div");
    middle.dataset.testid = "middle";
    middle.textContent = "Middle";

    const bottom = document.createElement("div");
    bottom.dataset.testid = "bottom";
    bottom.textContent = "Bottom";

    const sheet = createSheet({
      isOpen: van.state(true),
      sections: [
        {
          className: "top-section",
          content: top,
        },
        {
          className: "middle-section",
          scroll: true,
          content: middle,
        },
        {
          className: "bottom-section",
          content: bottom,
        },
      ],
    });

    await flush();

    const sections = Array.from(
      sheet.element.querySelectorAll<HTMLElement>(".vsheet-section"),
    );
    expect(sections).toHaveLength(3);
    expect(sections[0].querySelector("[data-testid='top']")).not.toBeNull();
    expect(sections[1].querySelector("[data-testid='middle']")).not.toBeNull();
    expect(sections[2].querySelector("[data-testid='bottom']")).not.toBeNull();

    const scrollableSections = Array.from(
      sheet.element.querySelectorAll<HTMLElement>(".vsheet-content"),
    );
    expect(scrollableSections).toHaveLength(1);
    expect(scrollableSections[0]).toBe(sections[1]);
    expect(scrollableSections[0].dataset.vsheetScroll).toBe("true");

    expect(sections[0].contains(sections[1])).toBe(false);
    expect(sections[0].contains(sections[2])).toBe(false);
    expect(sections[1].contains(sections[2])).toBe(false);

    sheet.destroy();
  });

  it("throws when content and sections are both provided", () => {
    expect(() =>
      createSheet({
        isOpen: van.state(true),
        content: "content",
        sections: [{ scroll: true, content: "section-content" }],
      }),
    ).toThrowError(/either `content` or `sections`/);
  });

  it("throws when neither content nor sections are provided", () => {
    expect(() =>
      createSheet({
        isOpen: van.state(true),
      }),
    ).toThrowError(/provide `content` or `sections`/);
  });

  it("throws when sections do not include a scrollable section", () => {
    expect(() =>
      createSheet({
        isOpen: van.state(true),
        sections: [{ content: "top" }, { content: "bottom" }],
      }),
    ).toThrowError(/exactly one section with `scroll: true`; received 0/);
  });

  it("throws when sections include multiple scrollable sections", () => {
    expect(() =>
      createSheet({
        isOpen: van.state(true),
        sections: [
          { content: "one", scroll: true },
          { content: "two", scroll: true },
        ],
      }),
    ).toThrowError(/exactly one section with `scroll: true`; received 2/);
  });
});
