import van from "vanjs-core";
import { createDefaultCloseIcon } from "./internal/icons";
import type {
  SheetInstance,
  SheetOptions,
  SheetReason,
  SheetRenderable,
  SheetSection,
} from "./types";

const { button, div, header, section } = van.tags;
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const DRAG_CLOSE_THRESHOLD_PX = 150;
const MOBILE_SHEET_HEIGHT_RATIO = 0.95;
const KEYBOARD_CLOSED_EPSILON_PX = 1;

const resolveMountTarget = (mountTo?: HTMLElement | string): HTMLElement => {
  if (!mountTo) {
    return document.body;
  }

  if (typeof mountTo === "string") {
    const target = document.querySelector<HTMLElement>(mountTo);
    return target ?? document.body;
  }

  return mountTo;
};

const resolveContent = (content: SheetRenderable): HTMLElement | string => {
  const resolved = typeof content === "function" ? content() : content;
  return resolved;
};

const normalizeSections = (options: SheetOptions): SheetSection[] => {
  const hasContent = options.content !== undefined;
  const hasSections = options.sections !== undefined;

  if (hasContent && hasSections) {
    throw new Error(
      "createSheet: provide either `content` or `sections`, not both.",
    );
  }

  if (!hasContent && !hasSections) {
    throw new Error("createSheet: provide `content` or `sections`.");
  }

  if (hasContent) {
    return [{ content: options.content as SheetRenderable, scroll: true }];
  }

  const sections = options.sections as SheetSection[];
  const scrollSectionCount = sections.filter(({ scroll }) => scroll).length;
  if (scrollSectionCount !== 1) {
    throw new Error(
      `createSheet: \`sections\` must include exactly one section with \`scroll: true\`; received ${scrollSectionCount}.`,
    );
  }

  return sections;
};

const resolveSectionClassName = (section: SheetSection): string => {
  const classNames = ["vsheet-section"];
  if (section.scroll) {
    classNames.push("vsheet-content");
  }

  const customClassName = section.className?.trim();
  if (customClassName) {
    classNames.push(customClassName);
  }

  return classNames.join(" ");
};

const resolveCloseIcon = (
  closeIcon?: HTMLElement | (() => HTMLElement),
): HTMLElement | SVGSVGElement => {
  if (!closeIcon) {
    return createDefaultCloseIcon();
  }

  return typeof closeIcon === "function" ? closeIcon() : closeIcon;
};

const isElementScrollableY = (element: HTMLElement): boolean => {
  const { overflowY } = window.getComputedStyle(element);
  const allowsScroll = overflowY === "auto" || overflowY === "scroll";
  return allowsScroll && element.scrollHeight > element.clientHeight;
};

const findScrollableAncestor = (
  target: EventTarget | null,
  stopAt: HTMLElement,
): HTMLElement | null => {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  let node: HTMLElement | null = target;
  while (node && node !== stopAt) {
    if (isElementScrollableY(node)) {
      return node;
    }

    node = node.parentElement;
  }

  return null;
};

export const createSheet = (options: SheetOptions): SheetInstance => {
  const resolvedSections = normalizeSections(options);
  const dismissible = options.dismissible ?? true;
  const closeOnBackdrop = options.closeOnBackdrop ?? true;
  const closeOnEscape = options.closeOnEscape ?? true;
  const showBackdrop = options.showBackdrop ?? true;
  const showCloseButton = options.showCloseButton ?? true;

  const closeButton = button(
    {
      type: "button",
      class: "vsheet-close",
      "aria-label": "Close",
      hidden: !showCloseButton,
    },
    resolveCloseIcon(options.closeIcon),
  );

  const headerElement = header({ class: "vsheet-header" }, closeButton);

  let content: HTMLElement | null = null;
  const sectionsElement = div(
    { class: "vsheet-sections" },
    ...resolvedSections.map((sheetSection, index) => {
      const sectionElement = div(
        {
          class: resolveSectionClassName(sheetSection),
          "data-vsheet-section-index": `${index}`,
          "data-vsheet-scroll": sheetSection.scroll ? "true" : "false",
        },
        resolveContent(sheetSection.content),
      );

      if (sheetSection.scroll) {
        content = sectionElement;
      }

      return sectionElement;
    }),
  );

  if (!content) {
    throw new Error(
      "createSheet: unable to resolve a scroll section from `sections`.",
    );
  }
  const scrollContent = content;

  const panel = section(
    {
      class: "vsheet-panel",
      role: "dialog",
      "aria-modal": "true",
    },
    headerElement,
    sectionsElement,
  );

  const backdrop = button({
    type: "button",
    class: "vsheet-backdrop",
    "aria-label": "Close sheet",
    hidden: !showBackdrop,
  });

  const root = div({ class: "vsheet-root" }, backdrop, panel);
  resolveMountTarget(options.mountTo).append(root);

  let pendingReason: SheetReason = "api";
  let previousOpen = options.isOpen.val;
  let dragStartY = 0;
  let dragOffsetY = 0;
  let isTouchTracking = false;
  let isDragging = false;
  let activeDragTouchId: number | null = null;
  let baseMobileViewportHeight = 0;
  let stopViewportTracking: (() => void) | null = null;
  let focusedElementScrollRaf: number | null = null;
  let focusedElementScrollTimeouts: number[] = [];

  const isMobileViewport = () => {
    if (typeof window.matchMedia !== "function") {
      return true;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  };

  const clearMobileHeightState = () => {
    root.style.removeProperty("--vsheet-mobile-height");
    root.style.removeProperty("--vsheet-keyboard-height");
    root.style.removeProperty("--vsheet-content-extra-bottom");
    root.style.removeProperty("--vsheet-root-offset-y");
    delete root.dataset.keyboardOpen;
    baseMobileViewportHeight = 0;
  };

  const clearFocusedElementScrollSchedule = () => {
    if (focusedElementScrollRaf !== null) {
      cancelAnimationFrame(focusedElementScrollRaf);
      focusedElementScrollRaf = null;
    }

    for (const timeoutId of focusedElementScrollTimeouts) {
      clearTimeout(timeoutId);
    }
    focusedElementScrollTimeouts = [];
  };

  const stopReactiveViewportTracking = () => {
    if (!stopViewportTracking) {
      return;
    }

    stopViewportTracking();
    stopViewportTracking = null;
  };

  const getLayoutViewportHeight = () =>
    window.innerHeight || document.documentElement.clientHeight || 0;

  const getDetectedKeyboardHeight = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return 0;
    }

    const visibleViewportBottom = viewport.height + viewport.offsetTop;
    const keyboardHeight = Math.max(
      0,
      Math.round(baseMobileViewportHeight - visibleViewportBottom),
    );
    return keyboardHeight <= KEYBOARD_CLOSED_EPSILON_PX ? 0 : keyboardHeight;
  };

  const getViewportOffsetTop = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return 0;
    }

    return Math.max(0, Math.round(viewport.offsetTop));
  };

  const getVisibleViewportTop = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return 0;
    }

    return Math.round(viewport.offsetTop);
  };

  const getVisibleViewportBottom = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return getLayoutViewportHeight();
    }

    return Math.round(viewport.offsetTop + viewport.height);
  };

  const updateMobileOpenHeight = () => {
    if (!options.isOpen.val || !isMobileViewport()) {
      return;
    }

    if (baseMobileViewportHeight === 0) {
      baseMobileViewportHeight = getLayoutViewportHeight();
    }

    const currentLayoutHeight = getLayoutViewportHeight();
    if (currentLayoutHeight > baseMobileViewportHeight) {
      baseMobileViewportHeight = currentLayoutHeight;
    }

    const keyboardHeight = getDetectedKeyboardHeight();
    const viewportOffsetTop = getViewportOffsetTop();
    const basePanelHeight = Math.round(
      baseMobileViewportHeight * MOBILE_SHEET_HEIGHT_RATIO,
    );
    const panelHeight = Math.max(0, basePanelHeight - keyboardHeight);

    root.style.setProperty("--vsheet-mobile-height", `${panelHeight}px`);
    root.style.setProperty("--vsheet-keyboard-height", `${keyboardHeight}px`);
    root.style.setProperty(
      "--vsheet-content-extra-bottom",
      `${keyboardHeight}px`,
    );
    root.style.setProperty("--vsheet-root-offset-y", `${viewportOffsetTop}px`);
    if (keyboardHeight > 0) {
      root.dataset.keyboardOpen = "true";
      scheduleFocusedElementIntoView();
      return;
    }

    delete root.dataset.keyboardOpen;
  };

  const ensureReactiveViewportTracking = () => {
    const viewport = window.visualViewport;
    if (!viewport || stopViewportTracking) {
      return;
    }

    const handleViewportChange = () => {
      updateMobileOpenHeight();
    };

    viewport.addEventListener("resize", handleViewportChange);
    viewport.addEventListener("scroll", handleViewportChange);

    stopViewportTracking = () => {
      viewport.removeEventListener("resize", handleViewportChange);
      viewport.removeEventListener("scroll", handleViewportChange);
    };
  };

  const ensureFocusedElementVisible = () => {
    const activeElement = document.activeElement;
    if (!(activeElement instanceof HTMLElement)) {
      return;
    }

    if (!scrollContent.contains(activeElement)) {
      return;
    }

    const contentRect = scrollContent.getBoundingClientRect();
    const focusedRect = activeElement.getBoundingClientRect();
    const visibleViewportTop = getVisibleViewportTop();
    const visibleViewportBottom = getVisibleViewportBottom();
    const visibleContentTop = Math.max(contentRect.top, visibleViewportTop);
    const visibleContentBottom = Math.min(
      contentRect.bottom,
      visibleViewportBottom,
    );
    const topSafety = 12;
    const bottomSafety = 16;

    const overflowBottom =
      focusedRect.bottom - (visibleContentBottom - bottomSafety);
    if (overflowBottom > 0) {
      scrollContent.scrollTop += overflowBottom;
      return;
    }

    const overflowTop = visibleContentTop + topSafety - focusedRect.top;
    if (overflowTop > 0) {
      scrollContent.scrollTop -= overflowTop;
    }
  };

  const scheduleFocusedElementIntoView = () => {
    clearFocusedElementScrollSchedule();

    const runEnsureVisible = () => {
      if (!options.isOpen.val) {
        return;
      }

      focusedElementScrollRaf = null;
      ensureFocusedElementVisible();
    };

    focusedElementScrollRaf = requestAnimationFrame(() => {
      runEnsureVisible();
    });

    // iOS keyboard animations can continue for a few hundred ms.
    for (const delay of [120, 260, 420]) {
      const timeoutId = window.setTimeout(() => {
        requestAnimationFrame(() => {
          runEnsureVisible();
        });
      }, delay);
      focusedElementScrollTimeouts.push(timeoutId);
    }
  };

  const handleFocusIn = () => {
    if (!options.isOpen.val || !isMobileViewport()) {
      return;
    }

    scheduleFocusedElementIntoView();
  };

  const applyMobileOpenHeight = (open: boolean) => {
    if (!open || !isMobileViewport()) {
      stopReactiveViewportTracking();
      clearMobileHeightState();
      return;
    }

    ensureReactiveViewportTracking();
    updateMobileOpenHeight();
  };

  const syncOpenState = (open: boolean) => {
    root.dataset.state = open ? "open" : "closed";
    root.setAttribute("aria-hidden", open ? "false" : "true");
    applyMobileOpenHeight(open);

    if (open) {
      panel.style.transform = "";
    }
  };

  const setOpen = (open: boolean, reason: SheetReason) => {
    if (!open && !dismissible && reason !== "api") {
      return;
    }

    if (open === options.isOpen.val) {
      return;
    }

    pendingReason = reason;
    options.isOpen.val = open;
  };

  const setDraggingVisualState = (dragging: boolean) => {
    if (dragging) {
      root.dataset.dragging = "true";
      return;
    }

    delete root.dataset.dragging;
  };

  const applyDragOffset = (offsetY: number) => {
    panel.style.transform = `translateY(${offsetY}px)`;
  };

  const animatePanelToOpen = () => {
    panel.style.transform = "translateY(0px)";
    panel.addEventListener(
      "transitionend",
      () => {
        panel.style.transform = "";
      },
      { once: true },
    );
  };

  const animatePanelToClosed = () => {
    panel.style.transform = "translateY(100%)";
    panel.addEventListener(
      "transitionend",
      () => {
        panel.style.transform = "";
      },
      { once: true },
    );
  };

  const handleBackdropClick = () => {
    if (!closeOnBackdrop) {
      return;
    }

    setOpen(false, "backdrop");
  };

  const handleCloseButtonClick = () => {
    setOpen(false, "close-button");
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }

    if (!closeOnEscape || !options.isOpen.val) {
      return;
    }

    setOpen(false, "escape");
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!options.isOpen.val || !isMobileViewport()) {
      return;
    }

    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest(
        "button, a, input, textarea, select, summary, [contenteditable='true']",
      )
    ) {
      return;
    }

    const scrollableAncestor = findScrollableAncestor(event.target, panel);
    if (scrollableAncestor && scrollableAncestor.scrollTop > 0) {
      return;
    }

    isTouchTracking = true;
    activeDragTouchId = touch.identifier;
    dragStartY = touch.clientY;
    dragOffsetY = 0;
    isDragging = false;
  };

  const handleTouchMove = (event: TouchEvent) => {
    if (!isTouchTracking || activeDragTouchId === null) {
      return;
    }

    const touch = Array.from(event.touches).find(
      ({ identifier }) => identifier === activeDragTouchId,
    );
    if (!touch) {
      return;
    }

    const deltaY = touch.clientY - dragStartY;
    if (deltaY <= 0) {
      return;
    }

    if (!isDragging) {
      isDragging = true;
      setDraggingVisualState(true);
    }

    dragOffsetY = deltaY;
    applyDragOffset(deltaY);

    event.preventDefault();
  };

  const handleTouchEnd = () => {
    if (!isTouchTracking) {
      return;
    }

    isTouchTracking = false;
    activeDragTouchId = null;

    if (!isDragging) {
      dragOffsetY = 0;
      dragStartY = 0;
      return;
    }

    isDragging = false;
    setDraggingVisualState(false);

    if (dragOffsetY >= DRAG_CLOSE_THRESHOLD_PX) {
      animatePanelToClosed();
      setOpen(false, "drag");
    } else {
      animatePanelToOpen();
    }

    dragOffsetY = 0;
    dragStartY = 0;
  };

  backdrop.addEventListener("click", handleBackdropClick);
  closeButton.addEventListener("click", handleCloseButtonClick);
  document.addEventListener("keydown", handleEscape);
  panel.addEventListener("touchstart", handleTouchStart, { passive: true });
  panel.addEventListener("touchmove", handleTouchMove, { passive: false });
  panel.addEventListener("touchend", handleTouchEnd, { passive: true });
  panel.addEventListener("touchcancel", handleTouchEnd, { passive: true });
  panel.addEventListener("focusin", handleFocusIn);

  syncOpenState(previousOpen);

  const stateSync = van.derive(() => {
    const currentOpen = options.isOpen.val;
    syncOpenState(currentOpen);

    if (currentOpen === previousOpen) {
      return;
    }

    options.onOpenChange?.(currentOpen, pendingReason);
    previousOpen = currentOpen;
    pendingReason = "api";
  });
  void stateSync;

  return {
    element: root,
    open: () => setOpen(true, "api"),
    close: (reason = "api") => setOpen(false, reason),
    destroy: () => {
      stopReactiveViewportTracking();
      clearMobileHeightState();
      clearFocusedElementScrollSchedule();
      backdrop.removeEventListener("click", handleBackdropClick);
      closeButton.removeEventListener("click", handleCloseButtonClick);
      document.removeEventListener("keydown", handleEscape);
      panel.removeEventListener("touchstart", handleTouchStart);
      panel.removeEventListener("touchmove", handleTouchMove);
      panel.removeEventListener("touchend", handleTouchEnd);
      panel.removeEventListener("touchcancel", handleTouchEnd);
      panel.removeEventListener("focusin", handleFocusIn);
      root.remove();
    },
  };
};
