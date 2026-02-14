import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openOptionSheet } from "../src/demo/open-option-sheet";

const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

const finishCloseAnimation = () => {
  const panel = document.querySelector(".vsheet-panel");
  panel?.dispatchEvent(new Event("transitionend"));
};

const requireElement = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Expected to find element: ${selector}`);
  }

  return element;
};

beforeEach(() => {
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 0;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("openOptionSheet", () => {
  it("resolves with the selected option on submit", async () => {
    const resultPromise = openOptionSheet();
    await flush();

    requireElement<HTMLButtonElement>("[data-option='b']").click();
    requireElement<HTMLButtonElement>("[data-submit='true']").click();
    await flush();
    finishCloseAnimation();
    await flush();

    await expect(resultPromise).resolves.toBe("b");
    expect(document.querySelector(".vsheet-root")).toBeNull();
  });

  it("resolves with null when dismissed via backdrop", async () => {
    const resultPromise = openOptionSheet();
    await flush();

    requireElement<HTMLButtonElement>(".vsheet-backdrop").click();
    expect(document.querySelector(".vsheet-root")).not.toBeNull();
    await flush();
    finishCloseAnimation();
    await flush();

    await expect(resultPromise).resolves.toBeNull();
    expect(document.querySelector(".vsheet-root")).toBeNull();
  });

  it("resolves with null when dismissed via escape", async () => {
    const resultPromise = openOptionSheet();
    await flush();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();
    finishCloseAnimation();
    await flush();

    await expect(resultPromise).resolves.toBeNull();
    expect(document.querySelector(".vsheet-root")).toBeNull();
  });

  it("resolves with null when dismissed via close button", async () => {
    const resultPromise = openOptionSheet();
    await flush();

    requireElement<HTMLButtonElement>(".vsheet-close").click();
    await flush();
    finishCloseAnimation();
    await flush();

    await expect(resultPromise).resolves.toBeNull();
    expect(document.querySelector(".vsheet-root")).toBeNull();
  });

  it("keeps submitted value when submit triggers api close callback", async () => {
    const resultPromise = openOptionSheet();
    await flush();

    requireElement<HTMLButtonElement>("[data-option='c']").click();
    requireElement<HTMLButtonElement>("[data-submit='true']").click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();
    finishCloseAnimation();
    await flush();

    await expect(resultPromise).resolves.toBe("c");
    expect(document.querySelector(".vsheet-root")).toBeNull();
  });
});
