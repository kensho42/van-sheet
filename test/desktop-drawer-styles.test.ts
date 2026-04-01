import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readStylesheet = () =>
  readFileSync(join(process.cwd(), "src/style.css"), "utf8");

describe("desktop drawer styles", () => {
  it("ships a desktop media query for right-side drawer layout", () => {
    const cssText = readStylesheet();

    expect(cssText).toContain("@media (min-width: 768px)");
    expect(cssText).toContain("width: min(430px, 100vw)");
    expect(cssText).toContain("border-radius: 20px 0 0 20px");
    expect(cssText).toContain("transform: translateX(100%)");
  });
});
