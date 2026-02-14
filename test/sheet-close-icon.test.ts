import van from "vanjs-core";
import { describe, expect, it, vi } from "vitest";
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

describe("createSheet close icon behavior", () => {
  it("renders built-in SVG icon when closeIcon is not provided", async () => {
    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
    });

    await flush();

    const closeButton = sheet.element.querySelector(".vsheet-close");
    const svg = closeButton?.querySelector("svg");
    expect(svg).not.toBeNull();

    sheet.destroy();
  });

  it("renders default SVG with expected geometry and two paths", async () => {
    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
    });

    await flush();

    const svg = sheet.element.querySelector(".vsheet-close svg");
    expect(svg?.getAttribute("width")).toBe("12");
    expect(svg?.getAttribute("height")).toBe("12");
    expect(svg?.getAttribute("viewBox")).toBe("0 0 12 12");

    const paths = sheet.element.querySelectorAll(".vsheet-close svg path");
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute("stroke")).toBe("#999999");
    expect(paths[0].getAttribute("stroke-width")).toBe("3");
    expect(paths[1].getAttribute("stroke")).toBe("#999999");
    expect(paths[1].getAttribute("stroke-width")).toBe("3");

    sheet.destroy();
  });

  it("uses custom closeIcon when provided", async () => {
    const custom = document.createElement("span");
    custom.setAttribute("data-testid", "custom-close-icon");

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      closeIcon: custom,
    });

    await flush();

    const customIcon = sheet.element.querySelector(
      ".vsheet-close [data-testid='custom-close-icon']",
    );
    const defaultIcon = sheet.element.querySelector(".vsheet-close svg");
    expect(customIcon).not.toBeNull();
    expect(defaultIcon).toBeNull();

    sheet.destroy();
  });

  it("keeps close-button dismissal behavior when floating close button is enabled", async () => {
    const reasons: SheetReason[] = [];
    const state = van.state(true);
    const sheet = createSheet({
      isOpen: state,
      content: "content",
      floatingCloseButton: true,
      onOpenChange: (open, reason) => {
        if (!open) {
          reasons.push(reason);
        }
      },
    });

    await flush();

    expect(sheet.element.dataset.floatingCloseButton).toBe("true");
    const closeButton =
      sheet.element.querySelector<HTMLButtonElement>(".vsheet-close");
    closeButton?.click();
    await flush();
    expect(state.val).toBe(false);
    expect(reasons).toEqual(["close-button"]);

    sheet.destroy();
  });

  it("keeps close button hidden in floating mode when showCloseButton is false", async () => {
    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      floatingCloseButton: true,
      showCloseButton: false,
    });

    await flush();

    const closeButton =
      sheet.element.querySelector<HTMLButtonElement>(".vsheet-close");
    expect(closeButton?.hidden).toBe(true);

    sheet.destroy();
  });

  it("keeps close interactions intact for backdrop, escape, and button", async () => {
    const reasons: SheetReason[] = [];
    const state = van.state(true);
    const sheet = createSheet({
      isOpen: state,
      content: "content",
      onOpenChange: (open, reason) => {
        if (!open) {
          reasons.push(reason);
        }
      },
    });

    await flush();

    const closeButton =
      sheet.element.querySelector<HTMLButtonElement>(".vsheet-close");
    closeButton?.click();
    await flush();

    state.val = true;
    await flush();
    const backdrop =
      sheet.element.querySelector<HTMLButtonElement>(".vsheet-backdrop");
    backdrop?.click();
    await flush();

    state.val = true;
    await flush();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();

    expect(reasons).toEqual(["close-button", "backdrop", "escape"]);

    sheet.destroy();
  });

  it("respects closeOnEscape and closeOnBackdrop switches", async () => {
    const onOpenChange = vi.fn();
    const state = van.state(true);
    const sheet = createSheet({
      isOpen: state,
      content: "content",
      closeOnEscape: false,
      closeOnBackdrop: false,
      onOpenChange,
    });

    await flush();

    const backdrop =
      sheet.element.querySelector<HTMLButtonElement>(".vsheet-backdrop");
    backdrop?.click();
    await flush();
    expect(state.val).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await flush();
    expect(state.val).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalledWith(false, "backdrop");
    expect(onOpenChange).not.toHaveBeenCalledWith(false, "escape");

    sheet.destroy();
  });

  it("undims backdrop in proportion to drag distance", async () => {
    const state = van.state(true);
    const sheet = createSheet({
      isOpen: state,
      content: "content",
    });

    await flush();

    const panel = sheet.element.querySelector<HTMLElement>(".vsheet-panel");
    expect(panel).not.toBeNull();
    vi.spyOn(panel as HTMLElement, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 300,
      bottom: 400,
      width: 300,
      height: 400,
      toJSON: () => ({}),
    } as DOMRect);

    dispatchTouchEvent(panel as HTMLElement, "touchstart", [
      { identifier: 1, clientY: 100 },
    ]);
    dispatchTouchEvent(panel as HTMLElement, "touchmove", [
      { identifier: 1, clientY: 300 },
    ]);

    expect(
      Number(
        sheet.element.style.getPropertyValue("--vsheet-backdrop-open-opacity"),
      ),
    ).toBeCloseTo(0.5, 5);

    dispatchTouchEvent(panel as HTMLElement, "touchend", []);
    await flush();

    expect(state.val).toBe(false);
    expect(
      sheet.element.style.getPropertyValue("--vsheet-backdrop-open-opacity"),
    ).toBe("");

    sheet.destroy();
  });
});
