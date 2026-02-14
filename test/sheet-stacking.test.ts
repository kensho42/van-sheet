import van from "vanjs-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createSheet } from "../src/create-sheet";
import type { SheetReason } from "../src/types";

const flush = async () => {
  await Promise.resolve();
};

type TouchPoint = {
  identifier: number;
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
    value: touches,
  });
  target.dispatchEvent(event);
};

const mountedSheets: ReturnType<typeof createSheet>[] = [];

const mountSheet = (
  isOpen: ReturnType<typeof van.state<boolean>>,
  content: string,
) => {
  const sheet = createSheet({
    isOpen,
    content,
  });
  mountedSheets.push(sheet);
  return sheet;
};

afterEach(() => {
  for (const sheet of mountedSheets.splice(0)) {
    sheet.destroy();
  }
  document.body.innerHTML = "";
});

describe("createSheet stacked instances", () => {
  it("updates stack depth and top-sheet markers as sheets open and close", async () => {
    const firstOpen = van.state(true);
    const secondOpen = van.state(false);
    const firstSheet = mountSheet(firstOpen, "first");
    const secondSheet = mountSheet(secondOpen, "second");

    await flush();

    expect(firstSheet.element.dataset.stackTop).toBe("true");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("0");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("0px");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-scale"),
    ).toBe("1");

    secondOpen.val = true;
    await flush();

    expect(secondSheet.element.dataset.stackTop).toBe("true");
    expect(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("1");
    expect(firstSheet.element.dataset.stackTop).toBe("false");
    expect(firstSheet.element.dataset.stackDepth).toBe("1");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("0");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("-12px");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-scale"),
    ).toBe("0.96");

    secondOpen.val = false;
    await flush();

    const secondPanel =
      secondSheet.element.querySelector<HTMLElement>(".vsheet-panel");
    secondPanel?.dispatchEvent(new Event("transitionend"));
    await flush();

    expect(secondSheet.element.dataset.stackTop).toBeUndefined();
    expect(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("");
    expect(firstSheet.element.dataset.stackTop).toBe("true");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("0px");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-scale"),
    ).toBe("1");
  });

  it("closes only the top sheet on Escape", async () => {
    const firstReasons: SheetReason[] = [];
    const secondReasons: SheetReason[] = [];
    const firstOpen = van.state(true);
    const secondOpen = van.state(true);

    mountedSheets.push(
      createSheet({
        isOpen: firstOpen,
        content: "first",
        onOpenChange: (open, reason) => {
          if (!open) {
            firstReasons.push(reason);
          }
        },
      }),
    );
    mountedSheets.push(
      createSheet({
        isOpen: secondOpen,
        content: "second",
        onOpenChange: (open, reason) => {
          if (!open) {
            secondReasons.push(reason);
          }
        },
      }),
    );

    await flush();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();

    expect(secondOpen.val).toBe(false);
    expect(firstOpen.val).toBe(true);
    expect(secondReasons).toEqual(["escape"]);
    expect(firstReasons).toEqual([]);
  });

  it("promotes a later reopened sheet to top stack layer", async () => {
    const firstOpen = van.state(false);
    const secondOpen = van.state(true);
    const firstSheet = mountSheet(firstOpen, "first");
    const secondSheet = mountSheet(secondOpen, "second");

    await flush();
    expect(secondSheet.element.dataset.stackTop).toBe("true");

    firstOpen.val = true;
    await flush();

    expect(firstSheet.element.dataset.stackTop).toBe("true");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("1");
    expect(secondSheet.element.dataset.stackTop).toBe("false");
    expect(secondSheet.element.dataset.stackDepth).toBe("1");
    expect(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("0");
  });

  it("keeps all stacked sheets visible when many are open", async () => {
    const states = Array.from({ length: 4 }, () => van.state(true));
    const sheets = states.map((state, index) =>
      mountSheet(state, `sheet-${index}`),
    );

    await flush();

    expect(
      sheets[3].element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("0px");
    expect(
      sheets[2].element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("-12px");
    expect(
      sheets[1].element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("-24px");
    expect(
      sheets[0].element.style.getPropertyValue("--vsheet-stack-offset-y"),
    ).toBe("-36px");
    expect(
      sheets[0].element.style.getPropertyValue("--vsheet-stack-scale"),
    ).toBe("0.88");
  });

  it("moves background sheets while dragging the active sheet", async () => {
    const firstSheet = mountSheet(van.state(true), "first");
    const secondSheet = mountSheet(van.state(true), "second");
    const thirdSheet = mountSheet(van.state(true), "third");

    await flush();

    const secondStart = Number.parseFloat(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    );
    const firstStart = Number.parseFloat(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    );
    expect(secondStart).toBeCloseTo(-12, 3);
    expect(firstStart).toBeCloseTo(-24, 3);

    const topPanel =
      thirdSheet.element.querySelector<HTMLElement>(".vsheet-panel");
    expect(topPanel).not.toBeNull();

    dispatchTouchEvent(topPanel as HTMLElement, "touchstart", [
      { identifier: 1, clientY: 120 },
    ]);
    dispatchTouchEvent(topPanel as HTMLElement, "touchmove", [
      { identifier: 1, clientY: 180 },
    ]);

    const secondDragged = Number.parseFloat(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    );
    const firstDragged = Number.parseFloat(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    );
    expect(secondDragged).toBeGreaterThan(secondStart);
    expect(firstDragged).toBeGreaterThan(firstStart);
    expect(secondSheet.element.dataset.stackDragging).toBe("true");
    expect(firstSheet.element.dataset.stackDragging).toBe("true");

    dispatchTouchEvent(topPanel as HTMLElement, "touchend", []);
    await flush();

    expect(
      Number.parseFloat(
        secondSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
      ),
    ).toBeCloseTo(-12, 3);
    expect(
      Number.parseFloat(
        firstSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
      ),
    ).toBeCloseTo(-24, 3);
    expect(secondSheet.element.dataset.stackDragging).toBeUndefined();
    expect(firstSheet.element.dataset.stackDragging).toBeUndefined();
  });

  it("keeps background sheet below active position until drag nears full panel height", async () => {
    mountSheet(van.state(true), "first");
    const secondSheet = mountSheet(van.state(true), "second");
    const thirdSheet = mountSheet(van.state(true), "third");

    await flush();

    const topPanel =
      thirdSheet.element.querySelector<HTMLElement>(".vsheet-panel");
    expect(topPanel).not.toBeNull();

    vi.spyOn(topPanel as HTMLElement, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 320,
      bottom: 600,
      width: 320,
      height: 600,
      toJSON: () => ({}),
    } as DOMRect);

    dispatchTouchEvent(topPanel as HTMLElement, "touchstart", [
      { identifier: 1, clientY: 100 },
    ]);
    // Matches close threshold distance, but still only 25% of panel height.
    dispatchTouchEvent(topPanel as HTMLElement, "touchmove", [
      { identifier: 1, clientY: 250 },
    ]);

    const secondAtThresholdDistance = Number.parseFloat(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    );
    expect(secondAtThresholdDistance).toBeLessThan(-8);

    // Drag to full panel height; now background sheet can align with active slot.
    dispatchTouchEvent(topPanel as HTMLElement, "touchmove", [
      { identifier: 1, clientY: 700 },
    ]);

    const secondAtFullDistance = Number.parseFloat(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-offset-y"),
    );
    expect(secondAtFullDistance).toBeCloseTo(0, 3);

    dispatchTouchEvent(topPanel as HTMLElement, "touchend", []);
    await flush();
  });

  it("retains stack layer until close transition completes with 3+ open sheets", async () => {
    const firstSheet = mountSheet(van.state(true), "first");
    const secondSheet = mountSheet(van.state(true), "second");
    const thirdOpen = van.state(true);
    const thirdSheet = mountSheet(thirdOpen, "third");

    await flush();
    expect(
      thirdSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("2");

    thirdOpen.val = false;
    await flush();

    expect(
      thirdSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("2");
    expect(
      firstSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("0");
    expect(
      secondSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("1");

    const thirdPanel =
      thirdSheet.element.querySelector<HTMLElement>(".vsheet-panel");
    thirdPanel?.dispatchEvent(new Event("transitionend"));
    await flush();

    expect(
      thirdSheet.element.style.getPropertyValue("--vsheet-stack-layer"),
    ).toBe("");
  });
});
