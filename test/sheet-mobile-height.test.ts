import van from "vanjs-core";
import { afterEach, describe, expect, it, vi } from "vitest";
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

type LayoutMetrics = {
  headerHeight: number;
  sectionsOffsetHeight: number;
  scrollOffsetHeight: number;
  scrollScrollHeight: number;
};

const flush = async () => {
  await Promise.resolve();
};

const dispatchPanelTransformTransitionEnd = (root: HTMLElement) => {
  const panel = root.querySelector<HTMLElement>(".vsheet-panel");
  const transitionEnd = new Event("transitionend");
  Object.defineProperty(transitionEnd, "propertyName", {
    value: "transform",
  });
  panel?.dispatchEvent(transitionEnd);
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
const originalOffsetHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetHeight",
);
const originalScrollHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "scrollHeight",
);
const originalClientHeight = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "clientHeight",
);
const globalWithResizeObserver = globalThis as Omit<
  typeof globalThis,
  "ResizeObserver"
> & {
  ResizeObserver?: typeof ResizeObserver;
};
const originalResizeObserver = globalWithResizeObserver.ResizeObserver;

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

const installLayoutMetricsMock = (metrics: LayoutMetrics) => {
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      if (this.classList.contains("vsheet-header")) {
        return metrics.headerHeight;
      }

      if (this.classList.contains("vsheet-sections")) {
        return metrics.sectionsOffsetHeight;
      }

      if (this.classList.contains("vsheet-content")) {
        return metrics.scrollOffsetHeight;
      }

      return originalOffsetHeight?.get
        ? originalOffsetHeight.get.call(this)
        : 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "scrollHeight", {
    configurable: true,
    get() {
      if (this.classList.contains("vsheet-content")) {
        return metrics.scrollScrollHeight;
      }

      return originalScrollHeight?.get
        ? originalScrollHeight.get.call(this)
        : 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    get() {
      if (this.classList.contains("vsheet-content")) {
        return metrics.scrollOffsetHeight;
      }

      return originalClientHeight?.get
        ? originalClientHeight.get.call(this)
        : 0;
    },
  });
};

const restoreLayoutMetricsMock = () => {
  if (originalOffsetHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      "offsetHeight",
      originalOffsetHeight,
    );
  }

  if (originalScrollHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      "scrollHeight",
      originalScrollHeight,
    );
  }

  if (originalClientHeight) {
    Object.defineProperty(
      HTMLElement.prototype,
      "clientHeight",
      originalClientHeight,
    );
  }
};

afterEach(() => {
  restoreLayoutMetricsMock();
  globalWithResizeObserver.ResizeObserver = originalResizeObserver;
  vi.restoreAllMocks();

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

  it("applies mobile height updates when floating close button is enabled", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      floatingCloseButton: true,
    });

    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    expect(sheet.element.dataset.floatingCloseButton).toBe("true");

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
    const panel = sheet.element.querySelector<HTMLElement>(".vsheet-panel");
    const transitionEnd = new Event("transitionend");
    Object.defineProperty(transitionEnd, "propertyName", {
      value: "transform",
    });
    panel?.dispatchEvent(transitionEnd);
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "",
    );
    expect(panel?.style.bottom).toBe("");

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
    ).toBe("");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-sections-extra-bottom"),
    ).toBe("");
    const panel = sheet.element.querySelector<HTMLElement>(".vsheet-panel");
    expect(panel?.style.bottom).toBe("300px");
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
    ).toBe("");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-sections-extra-bottom"),
    ).toBe("");
    expect(panel?.style.bottom).toBe("0px");
    expect(sheet.element.style.getPropertyValue("--vsheet-root-offset-y")).toBe(
      "0px",
    );
    expect(sheet.element.dataset.keyboardOpen).toBeUndefined();

    sheet.destroy();
  });

  it("lifts panel above keyboard without adding extra fixed-section inset", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    const visualViewport = createVisualViewportMock(1000, 0);
    setVisualViewport(visualViewport);

    const sheet = createSheet({
      isOpen: van.state(true),
      sections: [
        { content: "top" },
        { content: "middle", scroll: true },
        { content: "bottom" },
      ],
    });

    await flush();

    visualViewport.height = 700;
    visualViewport.emit("resize");
    await flush();

    expect(
      sheet.element.style.getPropertyValue("--vsheet-content-extra-bottom"),
    ).toBe("");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-sections-extra-bottom"),
    ).toBe("");
    const panel = sheet.element.querySelector<HTMLElement>(".vsheet-panel");
    expect(panel?.style.bottom).toBe("300px");
    expect(sheet.element.dataset.keyboardOpen).toBe("true");

    visualViewport.height = 1000;
    visualViewport.emit("resize");
    await flush();

    expect(
      sheet.element.style.getPropertyValue("--vsheet-content-extra-bottom"),
    ).toBe("");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-sections-extra-bottom"),
    ).toBe("");
    expect(panel?.style.bottom).toBe("0px");
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
    ).toBe("");
    expect(
      sheet.element.style.getPropertyValue("--vsheet-sections-extra-bottom"),
    ).toBe("");
    expect(sheet.element.style.getPropertyValue("--vsheet-root-offset-y")).toBe(
      "120px",
    );
    const panel = sheet.element.querySelector<HTMLElement>(".vsheet-panel");
    expect(panel?.style.bottom).toBe("300px");

    sheet.destroy();
  });
});

describe("createSheet adjustable mobile height", () => {
  it("fits sheet height to content when content is below the mobile cap", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    globalWithResizeObserver.ResizeObserver = undefined;

    const metrics: LayoutMetrics = {
      headerHeight: 80,
      sectionsOffsetHeight: 420,
      scrollOffsetHeight: 280,
      scrollScrollHeight: 260,
    };
    installLayoutMetricsMock(metrics);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      adjustableHeight: true,
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    expect(sheet.element.dataset.adjustableTracking).toBeUndefined();

    dispatchPanelTransformTransitionEnd(sheet.element);
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "480px",
    );
    expect(sheet.element.dataset.adjustableTracking).toBe("true");

    sheet.destroy();
  });

  it("keeps the 95% mobile cap and preserves internal scroll section overflow", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    globalWithResizeObserver.ResizeObserver = undefined;

    const metrics: LayoutMetrics = {
      headerHeight: 80,
      sectionsOffsetHeight: 1200,
      scrollOffsetHeight: 240,
      scrollScrollHeight: 1200,
    };
    installLayoutMetricsMock(metrics);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      adjustableHeight: true,
    });

    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    dispatchPanelTransformTransitionEnd(sheet.element);
    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    const scrollSection = sheet.element.querySelector<HTMLElement>(
      "[data-vsheet-scroll='true']",
    );
    expect(scrollSection).not.toBeNull();
    expect(scrollSection?.classList.contains("vsheet-content")).toBe(true);

    sheet.destroy();
  });

  it("updates adjustable height when scroll content mutates while open", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    globalWithResizeObserver.ResizeObserver = undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    const metrics: LayoutMetrics = {
      headerHeight: 80,
      sectionsOffsetHeight: 420,
      scrollOffsetHeight: 280,
      scrollScrollHeight: 260,
    };
    installLayoutMetricsMock(metrics);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      adjustableHeight: true,
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    dispatchPanelTransformTransitionEnd(sheet.element);
    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "480px",
    );

    metrics.scrollScrollHeight = 560;
    const scrollSection = sheet.element.querySelector<HTMLElement>(
      "[data-vsheet-scroll='true']",
    );
    scrollSection?.append(document.createElement("div"));
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "780px",
    );

    sheet.destroy();
  });

  it("updates adjustable height from mutation even when ResizeObserver exists", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);

    class ResizeObserverMock {
      observe(): void {}
      disconnect(): void {}
      unobserve(): void {}
    }
    globalWithResizeObserver.ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 0;
    });

    const metrics: LayoutMetrics = {
      headerHeight: 80,
      sectionsOffsetHeight: 420,
      scrollOffsetHeight: 280,
      scrollScrollHeight: 260,
    };
    installLayoutMetricsMock(metrics);

    const sheet = createSheet({
      isOpen: van.state(true),
      content: "content",
      adjustableHeight: true,
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    dispatchPanelTransformTransitionEnd(sheet.element);
    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "480px",
    );

    metrics.scrollScrollHeight = 560;
    const scrollSection = sheet.element.querySelector<HTMLElement>(
      "[data-vsheet-scroll='true']",
    );
    scrollSection?.append(document.createElement("div"));
    await flush();
    await flush();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "780px",
    );

    sheet.destroy();
  });

  it("clears adjustable mobile height state after close", async () => {
    setInnerHeight(1000);
    setMatchMedia(true);
    globalWithResizeObserver.ResizeObserver = undefined;

    const metrics: LayoutMetrics = {
      headerHeight: 80,
      sectionsOffsetHeight: 420,
      scrollOffsetHeight: 280,
      scrollScrollHeight: 260,
    };
    installLayoutMetricsMock(metrics);

    const isOpen = van.state(true);
    const sheet = createSheet({
      isOpen,
      content: "content",
      adjustableHeight: true,
    });

    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "950px",
    );
    dispatchPanelTransformTransitionEnd(sheet.element);
    await flush();
    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "480px",
    );

    vi.useFakeTimers();
    isOpen.val = false;
    await flush();
    vi.advanceTimersByTime(600);
    await flush();
    vi.useRealTimers();

    expect(sheet.element.style.getPropertyValue("--vsheet-mobile-height")).toBe(
      "",
    );

    sheet.destroy();
  });
});
