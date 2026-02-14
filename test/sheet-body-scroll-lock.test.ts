import van from "vanjs-core";
import { afterEach, describe, expect, it } from "vitest";
import { createSheet } from "../src/create-sheet";

const flush = async () => {
  await Promise.resolve();
};

const mountedSheets: ReturnType<typeof createSheet>[] = [];

const mountSheet = (isOpen: ReturnType<typeof van.state<boolean>>) => {
  const sheet = createSheet({
    isOpen,
    content: "content",
  });
  mountedSheets.push(sheet);
  return sheet;
};

type TouchPoint = {
  identifier: number;
  clientX?: number;
  clientY: number;
};

const dispatchTouchEvent = (
  target: EventTarget,
  type: string,
  touches: TouchPoint[],
) => {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  }) as TouchEvent;
  Object.defineProperty(event, "touches", {
    configurable: true,
    value: touches.map((touch) => ({ clientX: 0, ...touch })),
  });
  target.dispatchEvent(event);
  return event;
};

afterEach(() => {
  for (const sheet of mountedSheets.splice(0)) {
    sheet.destroy();
  }
  document.body.innerHTML = "";
  document.body.style.cssText = "";
  document.documentElement.style.cssText = "";
});

describe("createSheet document body scroll lock", () => {
  it("locks background scroll while open and restores inline styles when closed", async () => {
    document.documentElement.style.overflow = "clip";
    document.body.style.overflow = "auto";
    document.body.style.position = "relative";
    document.body.style.top = "12px";
    document.body.style.left = "2px";
    document.body.style.right = "8px";
    document.body.style.width = "80%";

    const isOpen = van.state(true);
    mountSheet(isOpen);

    await flush();

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.width).toBe("100%");
    expect(document.body.style.top).not.toBe("12px");

    isOpen.val = false;
    await flush();

    expect(document.documentElement.style.overflow).toBe("clip");
    expect(document.body.style.overflow).toBe("auto");
    expect(document.body.style.position).toBe("relative");
    expect(document.body.style.top).toBe("12px");
    expect(document.body.style.left).toBe("2px");
    expect(document.body.style.right).toBe("8px");
    expect(document.body.style.width).toBe("80%");
  });

  it("keeps background scroll locked until the last stacked sheet closes", async () => {
    const firstOpen = van.state(true);
    const secondOpen = van.state(true);
    mountSheet(firstOpen);
    mountSheet(secondOpen);

    await flush();

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");

    secondOpen.val = false;
    await flush();

    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.position).toBe("fixed");

    firstOpen.val = false;
    await flush();

    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.position).toBe("");
  });

  it("prevents vertical touchmove on backdrop to avoid document drag/refresh", async () => {
    const isOpen = van.state(true);
    const sheet = mountSheet(isOpen);
    await flush();

    const backdrop =
      sheet.element.querySelector<HTMLButtonElement>(".vsheet-backdrop");
    expect(backdrop).not.toBeNull();

    dispatchTouchEvent(backdrop as HTMLButtonElement, "touchstart", [
      { identifier: 1, clientX: 120, clientY: 100 },
    ]);
    const moveEvent = dispatchTouchEvent(
      backdrop as HTMLButtonElement,
      "touchmove",
      [{ identifier: 1, clientX: 120, clientY: 130 }],
    );

    expect(moveEvent.defaultPrevented).toBe(true);
  });

  it("prevents overscroll chaining at vertical boundaries inside sheet content", async () => {
    const isOpen = van.state(true);
    const sheet = mountSheet(isOpen);
    await flush();

    const scrollContent = sheet.element.querySelector<HTMLElement>(
      "[data-vsheet-scroll='true']",
    );
    expect(scrollContent).not.toBeNull();

    if (scrollContent) {
      Object.defineProperty(scrollContent, "clientHeight", {
        configurable: true,
        value: 100,
      });
      Object.defineProperty(scrollContent, "scrollHeight", {
        configurable: true,
        value: 300,
      });
      scrollContent.scrollTop = 0;
    }

    dispatchTouchEvent(scrollContent as HTMLElement, "touchstart", [
      { identifier: 1, clientX: 100, clientY: 120 },
    ]);
    const moveFromTop = dispatchTouchEvent(
      scrollContent as HTMLElement,
      "touchmove",
      [{ identifier: 1, clientX: 100, clientY: 150 }],
    );
    expect(moveFromTop.defaultPrevented).toBe(true);

    if (scrollContent) {
      scrollContent.scrollTop = 200;
    }
    dispatchTouchEvent(scrollContent as HTMLElement, "touchstart", [
      { identifier: 2, clientX: 100, clientY: 200 },
    ]);
    const moveFromBottom = dispatchTouchEvent(
      scrollContent as HTMLElement,
      "touchmove",
      [{ identifier: 2, clientX: 100, clientY: 170 }],
    );
    expect(moveFromBottom.defaultPrevented).toBe(true);
  });
});
