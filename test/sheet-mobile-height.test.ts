import van from "vanjs-core";
import { afterEach, describe, expect, it } from "vitest";
import { createSheet } from "../src/create-sheet";

type ViewportListener = (event: Event) => void;
type ViewportEvent = "resize" | "scroll";
type VisualViewportMock = {
  width: number;
  height: number;
  scale: number;
  offsetLeft: number;
  offsetTop: number;
  pageLeft: number;
  pageTop: number;
  onresize: ((this: VisualViewport, event: Event) => void) | null;
  onscroll: ((this: VisualViewport, event: Event) => void) | null;
  addEventListener: (type: ViewportEvent, listener: ViewportListener) => void;
  removeEventListener: (
    type: ViewportEvent,
    listener: ViewportListener,
  ) => void;
  dispatchEvent: (event: Event) => boolean;
  emit: (type: ViewportEvent) => void;
};

const flush = async () => {
  await Promise.resolve();
};

const originalInnerHeight = Object.getOwnPropertyDescriptor(
  window,
  "innerHeight",
);
const originalMatchMedia = window.matchMedia;
const originalVisualViewport = Object.getOwnPropertyDescriptor(
  window,
  "visualViewport",
);

const setInnerHeight = (height: number) => {
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    writable: true,
    value: height,
  });
};

const setMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () =>
      ({
        matches,
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList,
  });
};

const setVisualViewport = (viewport: VisualViewportMock | undefined) => {
  Object.defineProperty(window, "visualViewport", {
    configurable: true,
    writable: true,
    value: viewport,
  });
};

const createVisualViewportMock = (
  height: number,
  offsetTop = 0,
): VisualViewportMock => {
  const listeners: Record<ViewportEvent, Set<ViewportListener>> = {
    resize: new Set(),
    scroll: new Set(),
  };

  const mock: VisualViewportMock = {
    width: 0,
    height,
    scale: 1,
    offsetLeft: 0,
    offsetTop,
    pageLeft: 0,
    pageTop: 0,
    onresize: null,
    onscroll: null,
    addEventListener: (type, listener) => {
      listeners[type].add(listener);
    },
    removeEventListener: (type, listener) => {
      listeners[type].delete(listener);
    },
    dispatchEvent: (_event) => false,
    emit: (type) => {
      const event = new Event(type);
      for (const listener of listeners[type]) {
        listener(event);
      }
    },
  };

  return mock;
};

afterEach(() => {
  if (originalInnerHeight) {
    Object.defineProperty(window, "innerHeight", originalInnerHeight);
  }

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });

  if (originalVisualViewport) {
    Object.defineProperty(window, "visualViewport", originalVisualViewport);
    return;
  }

  setVisualViewport(undefined);
});

describe("createSheet mobile height snapshot", () => {
  it("sets mobile sheet height from viewport when opened", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
    });

    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );

    sheet.destroy();
  });

  it("does not apply mobile sheet height on desktop viewports", async () => {
    setInnerHeight(1000);
    setMatchMedia(false);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
    });

    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "",
    );

    sheet.destroy();
  });

  it("clears mobile sheet height after close", async () => {
    setInnerHeight(900);
    setMatchMedia(true);

    const isOpen = van.state(true);
    const sheet = createSheet({
      isOpen,
      content: "content",
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "855px",
    );

    isOpen.val = false;
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "",
    );

    sheet.destroy();
  });

  it("reactively shrinks and restores height on keyboard open/close", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    const visualViewport = createVisualViewportMock(1000, 0);
    setVisualViewport(visualViewport);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );

    visualViewport.height = 700;
    visualViewport.emit("resize");
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "650px",
    );
    expect(
      sheet.element.style.getPropertyValue("--vsheet-keyboard-height"),
    ).toBe("300px");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-content-extra-bottom"),
    ).toBe("300px");
    expect(sheet.element.style.getPropertyValue("--vsheet-root-offset-y")).toBe(
      "0px",
    );
    expect(sheet.element.dataset.keyboardOpen).toBe("true");

    visualViewport.height = 1000;
    visualViewport.emit("resize");
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    expect(
      sheet.element.style.getPropertyValue("--vsheet-keyboard-height"),
    ).toBe("0px");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-content-extra-bottom"),
    ).toBe("0px");
    expect(sheet.element.style.getPropertyValue("--vsheet-root-offset-y")).toBe(
      "0px",
    );
    expect(sheet.element.dataset.keyboardOpen).toBeUndefined();

    sheet.destroy();
  });

  it("compensates positive visual viewport offset to prevent upward sheet push", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    const visualViewport = createVisualViewportMock(1000, 0);
    setVisualViewport(visualViewport);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-root-offset-y")).toBe(
      "0px",
    );

    visualViewport.height = 700;
    visualViewport.offsetTop = 120;
    visualViewport.emit("resize");
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "770px",
    );
    expect(
      sheet.element.style.getPropertyValue("--vsheet-keyboard-height"),
    ).toBe("180px");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-content-extra-bottom"),
    ).toBe("180px");
    expect(sheet.element.style.getPropertyValue("--vsheet-root-offset-y")).toBe(
      "120px",
    );

    sheet.destroy();
  });
});
