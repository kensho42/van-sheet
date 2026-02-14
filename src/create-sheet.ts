import van from "vanjs-core";
import {
  findScrollableAncestor,
  normalizeSections,
  resolveCloseIcon,
  resolveContent,
  resolveMountTarget,
  resolveSectionClassName,
} from "./internal/sheet-helpers";
import type { SheetStackSnapshot } from "./internal/stack";
import {
  claimSheetStackOpenOrder,
  claimSheetStackParticipantId,
  clearSheetStackDragProgress,
  isTopOpenSheetStackParticipant,
  registerSheetStackParticipant,
  setSheetStackDragProgress,
  syncSheetStackState,
  unregisterSheetStackParticipant,
} from "./internal/stack";
import type { SheetInstance, SheetOptions, SheetReason } from "./types";

const { button, div, header, section } = van.tags;
const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const DRAG_CLOSE_THRESHOLD_PX = 150;
const MOBILE_SHEET_HEIGHT_RATIO = 0.95;
const KEYBOARD_CLOSED_EPSILON_PX = 1;
const PANEL_TRANSITION_FALLBACK_MS = 550;
const STACK_OFFSET_STEP_PX = 12;
const STACK_SCALE_STEP = 0.04;
const STACK_MIN_SCALE = 0.72;

export const createSheet = (options: SheetOptions): SheetInstance => {
  const resolvedSections = normalizeSections(options);
  const dismissible = options.dismissible ?? true;
  const closeOnBackdrop = options.closeOnBackdrop ?? true;
  const closeOnEscape = options.closeOnEscape ?? true;
  const showBackdrop = options.showBackdrop ?? true;
  const showCloseButton = options.showCloseButton ?? true;
  const adjustableHeight = options.adjustableHeight ?? false;
  const floatingCloseButton = options.floatingCloseButton ?? false;

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

      return sectionElement;
    }),
  );

  const scrollContent = sectionsElement.querySelector<HTMLElement>(
    "[data-vsheet-scroll='true']",
  );

  if (!scrollContent) {
    throw new Error(
      "createSheet: unable to resolve a scroll section from `sections`.",
    );
  }

  const fixedSectionElements = Array.from(
    sectionsElement.querySelectorAll<HTMLElement>(
      "[data-vsheet-scroll='false']",
    ),
  );

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
  const setRootDatasetFlag = (key: string, enabled: boolean) => {
    if (enabled) {
      root.dataset[key] = "true";
      return;
    }

    delete root.dataset[key];
  };
  const clearRootDatasetEntries = (...keys: string[]) => {
    for (const key of keys) {
      delete root.dataset[key];
    }
  };
  setRootDatasetFlag("floatingCloseButton", floatingCloseButton);

  let pendingReason: SheetReason = "api";
  let previousOpen = options.isOpen.val;
  let dragStartY = 0;
  let dragOffsetY = 0;
  let dragPanelHeight = 0;
  let isTouchTracking = false;
  let isDragging = false;
  let activeDragTouchId: number | null = null;
  let baseMobileViewportHeight = 0;
  let stopViewportTracking: (() => void) | null = null;
  let scheduledMobileHeightUpdateRaf: number | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let mutationObserver: MutationObserver | null = null;
  let hasLoadTracking = false;
  let cachedNaturalPanelHeight = 0;
  let naturalPanelHeightDirty = true;
  let lastMeasuredScrollContentWidth = 0;
  let scheduledClosedPremeasureRaf: number | null = null;
  let shouldDeferCloseStateClear = false;
  let focusedElementScrollRaf: number | null = null;
  let focusedElementScrollTimeouts: number[] = [];
  let openOrder = options.isOpen.val ? claimSheetStackOpenOrder() : 0;
  const stackParticipantId = claimSheetStackParticipantId();
  let retainStackSnapshotWhileClosed = false;
  let adjustableTrackingReady = false;
  type TransitionFallbackSchedule = {
    timeoutId: number | null;
    transitionHandler: ((event: TransitionEvent) => void) | null;
  };
  const stackSnapshotRetainSchedule: TransitionFallbackSchedule = {
    timeoutId: null,
    transitionHandler: null,
  };
  const adjustableTrackingStartSchedule: TransitionFallbackSchedule = {
    timeoutId: null,
    transitionHandler: null,
  };
  const dragCloseStateClearSchedule: TransitionFallbackSchedule = {
    timeoutId: null,
    transitionHandler: null,
  };

  const clearTransitionFallbackSchedule = (
    transitionSchedule: TransitionFallbackSchedule,
  ) => {
    if (transitionSchedule.timeoutId !== null) {
      clearTimeout(transitionSchedule.timeoutId);
      transitionSchedule.timeoutId = null;
    }

    if (transitionSchedule.transitionHandler) {
      panel.removeEventListener(
        "transitionend",
        transitionSchedule.transitionHandler,
      );
      transitionSchedule.transitionHandler = null;
    }
  };

  const scheduleTransitionFallback = (
    transitionSchedule: TransitionFallbackSchedule,
    onTrigger: () => void,
    shouldHandleTransitionEnd?: (event: TransitionEvent) => boolean,
  ) => {
    clearTransitionFallbackSchedule(transitionSchedule);

    transitionSchedule.transitionHandler = (event: TransitionEvent) => {
      if (shouldHandleTransitionEnd && !shouldHandleTransitionEnd(event)) {
        return;
      }

      onTrigger();
    };
    panel.addEventListener(
      "transitionend",
      transitionSchedule.transitionHandler,
    );
    transitionSchedule.timeoutId = window.setTimeout(
      onTrigger,
      PANEL_TRANSITION_FALLBACK_MS,
    );
  };

  const clearStackSnapshotRetainSchedule = () => {
    clearTransitionFallbackSchedule(stackSnapshotRetainSchedule);
  };

  const resetStackSnapshotRetainState = () => {
    retainStackSnapshotWhileClosed = false;
    clearStackSnapshotRetainSchedule();
  };

  const clearStackSnapshot = () => {
    root.style.removeProperty("--vsheet-stack-layer");
    root.style.removeProperty("--vsheet-stack-offset-y");
    root.style.removeProperty("--vsheet-stack-scale");
    clearRootDatasetEntries(
      "stackTop",
      "stackDepth",
      "stackSize",
      "stackDragging",
    );
  };

  const finalizeStackSnapshotRetain = () => {
    clearStackSnapshotRetainSchedule();
    retainStackSnapshotWhileClosed = false;
    if (!options.isOpen.val) {
      clearStackSnapshot();
    }
  };

  const scheduleStackSnapshotRetainClear = () => {
    const maybeFinalize = () => {
      if (options.isOpen.val) {
        return;
      }

      finalizeStackSnapshotRetain();
    };

    scheduleTransitionFallback(stackSnapshotRetainSchedule, maybeFinalize);
  };

  const applyStackSnapshot = (snapshot: SheetStackSnapshot | null) => {
    if (!snapshot) {
      if (!retainStackSnapshotWhileClosed || options.isOpen.val) {
        clearStackSnapshot();
      }
      return;
    }

    if (!options.isOpen.val) {
      clearStackSnapshot();
      return;
    }

    const stackDepth = Math.max(0, snapshot.depthFromTop);
    const visualDepth = Math.max(0, snapshot.visualDepth);
    const stackOffsetY = -visualDepth * STACK_OFFSET_STEP_PX;
    const stackScale = Math.max(
      STACK_MIN_SCALE,
      1 - visualDepth * STACK_SCALE_STEP,
    );
    root.style.setProperty("--vsheet-stack-layer", `${snapshot.layer}`);
    root.style.setProperty(
      "--vsheet-stack-offset-y",
      `${Math.round(stackOffsetY * 1000) / 1000}px`,
    );
    root.style.setProperty(
      "--vsheet-stack-scale",
      `${Math.round(stackScale * 1000) / 1000}`,
    );
    root.dataset.stackTop = snapshot.isTop ? "true" : "false";
    root.dataset.stackDepth = `${stackDepth}`;
    root.dataset.stackSize = `${snapshot.openCount}`;
    setRootDatasetFlag("stackDragging", snapshot.stackDragging);
  };

  const isTopMostOpenSheet = () =>
    options.isOpen.val && isTopOpenSheetStackParticipant(stackParticipantId);

  const isMobileViewport = () => {
    if (typeof window.matchMedia !== "function") {
      return true;
    }

    return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
  };

  const clearMobileHeightState = () => {
    root.style.removeProperty("--vsheet-mobile-height");
    root.style.removeProperty("--vsheet-keyboard-height");
    root.style.removeProperty("--vsheet-root-offset-y");
    panel.style.removeProperty("bottom");
    setRootDatasetFlag("keyboardOpen", false);
    baseMobileViewportHeight = 0;
    cachedNaturalPanelHeight = 0;
    naturalPanelHeightDirty = true;
    lastMeasuredScrollContentWidth = 0;
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

  const clearScheduledMobileHeightUpdate = () => {
    if (scheduledMobileHeightUpdateRaf === null) {
      return;
    }

    cancelAnimationFrame(scheduledMobileHeightUpdateRaf);
    scheduledMobileHeightUpdateRaf = null;
  };

  const clearClosedPremeasureSchedule = () => {
    if (scheduledClosedPremeasureRaf === null) {
      return;
    }

    cancelAnimationFrame(scheduledClosedPremeasureRaf);
    scheduledClosedPremeasureRaf = null;
  };

  const stopMobileLifecycleTracking = () => {
    resetAdjustableTracking();
    clearClosedPremeasureSchedule();
    stopReactiveViewportTracking();
    stopContentHeightTracking();
  };

  const updateAdjustableTrackingDataset = () => {
    setRootDatasetFlag(
      "adjustableTracking",
      adjustableHeight &&
        adjustableTrackingReady &&
        options.isOpen.val &&
        isMobileViewport(),
    );
  };

  const resetAdjustableTracking = () => {
    clearTransitionFallbackSchedule(adjustableTrackingStartSchedule);
    adjustableTrackingReady = false;
    updateAdjustableTrackingDataset();
  };

  const startAdjustableTracking = () => {
    clearTransitionFallbackSchedule(adjustableTrackingStartSchedule);

    if (!adjustableHeight || !options.isOpen.val || !isMobileViewport()) {
      return;
    }

    if (adjustableTrackingReady) {
      return;
    }

    adjustableTrackingReady = true;
    naturalPanelHeightDirty = true;
    updateMobileOpenHeight();
    updateAdjustableTrackingDataset();
    ensureContentHeightTracking();
  };

  const scheduleAdjustableTrackingStart = () => {
    if (
      !adjustableHeight ||
      adjustableTrackingReady ||
      !options.isOpen.val ||
      !isMobileViewport()
    ) {
      return;
    }

    const maybeStart = (event?: TransitionEvent) => {
      if (event && event.target !== panel) {
        return;
      }

      if (event && event.propertyName !== "transform") {
        return;
      }

      startAdjustableTracking();
    };

    scheduleTransitionFallback(
      adjustableTrackingStartSchedule,
      maybeStart,
      (event) => event.target === panel && event.propertyName === "transform",
    );
  };

  const scheduleClosedAdjustablePremeasure = () => {
    if (
      !adjustableHeight ||
      options.isOpen.val ||
      !isMobileViewport() ||
      scheduledClosedPremeasureRaf !== null
    ) {
      return;
    }

    scheduledClosedPremeasureRaf = requestAnimationFrame(() => {
      scheduledClosedPremeasureRaf = null;
      if (!adjustableHeight || options.isOpen.val || !isMobileViewport()) {
        return;
      }

      naturalPanelHeightDirty = true;
      void getNaturalPanelHeight();
    });
  };

  const clearDragCloseStateClearSchedule = () => {
    clearTransitionFallbackSchedule(dragCloseStateClearSchedule);
  };

  const finalizeDragCloseStateClear = () => {
    clearDragCloseStateClearSchedule();
    shouldDeferCloseStateClear = false;
    clearMobileHeightState();
    scheduleClosedAdjustablePremeasure();
  };

  const scheduleDragCloseStateClear = () => {
    const maybeFinalize = () => {
      if (options.isOpen.val) {
        return;
      }

      finalizeDragCloseStateClear();
    };

    scheduleTransitionFallback(dragCloseStateClearSchedule, maybeFinalize);
  };

  const scheduleMobileOpenHeightUpdate = () => {
    if (scheduledMobileHeightUpdateRaf !== null) {
      return;
    }

    scheduledMobileHeightUpdateRaf = requestAnimationFrame(() => {
      scheduledMobileHeightUpdateRaf = null;
      updateMobileOpenHeight();
    });
  };

  const handleContentSizeChange = () => {
    naturalPanelHeightDirty = true;
    scheduleMobileOpenHeightUpdate();
  };

  const stopContentHeightTracking = () => {
    clearScheduledMobileHeightUpdate();

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }

    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }

    if (hasLoadTracking) {
      sectionsElement.removeEventListener(
        "load",
        handleContentSizeChange,
        true,
      );
      hasLoadTracking = false;
    }
  };

  const ensureContentHeightTracking = () => {
    if (!adjustableHeight || !options.isOpen.val || !isMobileViewport()) {
      stopContentHeightTracking();
      return;
    }

    if (!hasLoadTracking) {
      sectionsElement.addEventListener("load", handleContentSizeChange, true);
      hasLoadTracking = true;
    }

    if (typeof ResizeObserver === "function") {
      if (!resizeObserver) {
        resizeObserver = new ResizeObserver(handleContentSizeChange);
        resizeObserver.observe(headerElement);
        for (const fixedSectionElement of fixedSectionElements) {
          resizeObserver.observe(fixedSectionElement);
        }
      }
    }

    if (!mutationObserver) {
      mutationObserver = new MutationObserver(handleContentSizeChange);
      mutationObserver.observe(sectionsElement, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    }
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

  const getVisibleViewportBounds = () => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return {
        top: 0,
        bottom: getLayoutViewportHeight(),
      };
    }

    return {
      top: Math.round(viewport.offsetTop),
      bottom: Math.round(viewport.offsetTop + viewport.height),
    };
  };

  const measureNaturalScrollSectionHeight = (contentWidth: number) => {
    const liveScrollHeight = Math.max(
      0,
      Math.round(scrollContent.scrollHeight),
    );
    const liveClientHeight = Math.max(
      0,
      Math.round(scrollContent.clientHeight),
    );
    if (liveScrollHeight > liveClientHeight) {
      return liveScrollHeight;
    }

    const previousWidth = scrollContent.style.width;
    const previousFlex = scrollContent.style.flex;
    const previousHeight = scrollContent.style.height;
    const previousMaxHeight = scrollContent.style.maxHeight;
    const previousMinHeight = scrollContent.style.minHeight;
    const previousOverflowY = scrollContent.style.overflowY;

    if (contentWidth > 0) {
      scrollContent.style.width = `${contentWidth}px`;
    }
    scrollContent.style.flex = "0 0 auto";
    scrollContent.style.height = "auto";
    scrollContent.style.maxHeight = "none";
    scrollContent.style.minHeight = "0";
    scrollContent.style.overflowY = "visible";

    const naturalHeight = Math.max(0, Math.round(scrollContent.scrollHeight));

    scrollContent.style.width = previousWidth;
    scrollContent.style.flex = previousFlex;
    scrollContent.style.height = previousHeight;
    scrollContent.style.maxHeight = previousMaxHeight;
    scrollContent.style.minHeight = previousMinHeight;
    scrollContent.style.overflowY = previousOverflowY;

    return naturalHeight;
  };

  const getNaturalPanelHeight = () => {
    const contentWidth = Math.round(scrollContent.clientWidth);
    if (contentWidth > 0 && contentWidth !== lastMeasuredScrollContentWidth) {
      naturalPanelHeightDirty = true;
    }

    if (!naturalPanelHeightDirty) {
      return cachedNaturalPanelHeight;
    }

    const naturalScrollSectionHeight =
      measureNaturalScrollSectionHeight(contentWidth);
    const naturalSectionsHeight =
      sectionsElement.offsetHeight -
      scrollContent.offsetHeight +
      naturalScrollSectionHeight;
    const naturalPanelHeight =
      headerElement.offsetHeight + naturalSectionsHeight;
    cachedNaturalPanelHeight = Math.max(0, Math.round(naturalPanelHeight));
    naturalPanelHeightDirty = false;
    lastMeasuredScrollContentWidth = contentWidth;
    return cachedNaturalPanelHeight;
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
    const viewportOffsetTop = keyboardHeight > 0 ? getViewportOffsetTop() : 0;
    const basePanelHeight = Math.round(
      baseMobileViewportHeight * MOBILE_SHEET_HEIGHT_RATIO,
    );
    const maxPanelHeight = Math.max(0, basePanelHeight - keyboardHeight);
    const panelHeight =
      adjustableHeight && adjustableTrackingReady
        ? Math.min(maxPanelHeight, getNaturalPanelHeight())
        : maxPanelHeight;
    const panelBottomInset = keyboardHeight + viewportOffsetTop;

    root.style.setProperty("--vsheet-mobile-height", `${panelHeight}px`);
    root.style.setProperty("--vsheet-keyboard-height", `${keyboardHeight}px`);
    root.style.setProperty("--vsheet-root-offset-y", `${viewportOffsetTop}px`);
    panel.style.bottom = `${panelBottomInset}px`;
    setRootDatasetFlag("keyboardOpen", keyboardHeight > 0);
    if (keyboardHeight > 0) {
      scheduleFocusedElementIntoView();
    }
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
    const visibleViewportBounds = getVisibleViewportBounds();
    const visibleContentTop = Math.max(
      contentRect.top,
      visibleViewportBounds.top,
    );
    const visibleContentBottom = Math.min(
      contentRect.bottom,
      visibleViewportBounds.bottom,
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
    if (!options.isOpen.val || !isMobileViewport() || !isTopMostOpenSheet()) {
      return;
    }

    scheduleFocusedElementIntoView();
  };

  const applyMobileClosedHeight = (open: boolean) => {
    stopMobileLifecycleTracking();
    if (shouldDeferCloseStateClear && adjustableHeight && isMobileViewport()) {
      scheduleDragCloseStateClear();
      return;
    }

    clearDragCloseStateClearSchedule();
    shouldDeferCloseStateClear = false;
    clearMobileHeightState();
    if (!open) {
      scheduleClosedAdjustablePremeasure();
    }
  };

  const applyMobileOpenHeight = (open: boolean) => {
    if (!open || !isMobileViewport()) {
      applyMobileClosedHeight(open);
      return;
    }

    clearDragCloseStateClearSchedule();
    shouldDeferCloseStateClear = false;
    clearClosedPremeasureSchedule();
    ensureReactiveViewportTracking();
    if (adjustableHeight && !adjustableTrackingReady) {
      stopContentHeightTracking();
    } else {
      ensureContentHeightTracking();
    }
    updateMobileOpenHeight();
  };

  const syncOpenState = (open: boolean) => {
    setRootDatasetFlag("adjustableHeight", adjustableHeight && open);
    root.dataset.state = open ? "open" : "closed";
    root.setAttribute("aria-hidden", open ? "false" : "true");
    applyMobileOpenHeight(open);
    updateAdjustableTrackingDataset();

    if (open) {
      setBackdropOpenOpacity(1);
      panel.style.transform = "";
      return;
    }

    clearBackdropOpenOpacity();
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
    setRootDatasetFlag("dragging", dragging);
  };

  const setBackdropOpenOpacity = (opacity: number) => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity));
    root.style.setProperty(
      "--vsheet-backdrop-open-opacity",
      `${Math.round(clampedOpacity * 1000) / 1000}`,
    );
  };

  const clearBackdropOpenOpacity = () => {
    root.style.removeProperty("--vsheet-backdrop-open-opacity");
  };

  const applyDragOffset = (offsetY: number) => {
    panel.style.transform = `translateY(${offsetY}px)`;
  };

  const applyDragBackdropOpacity = (offsetY: number) => {
    const panelHeight = dragPanelHeight || panel.getBoundingClientRect().height;
    if (panelHeight <= 0) {
      setBackdropOpenOpacity(1);
      return;
    }

    const dragProgress = Math.max(0, Math.min(1, offsetY / panelHeight));
    setBackdropOpenOpacity(1 - dragProgress);
  };

  const getStackDragProgressDistance = () => {
    if (dragPanelHeight > 0) {
      return dragPanelHeight;
    }

    const measuredPanelHeight = panel.getBoundingClientRect().height;
    if (measuredPanelHeight > 0) {
      return measuredPanelHeight;
    }

    // Keep tests/environments without real layout measurable.
    return DRAG_CLOSE_THRESHOLD_PX;
  };

  const animatePanelTo = (transform: string) => {
    panel.style.transform = transform;
    panel.addEventListener(
      "transitionend",
      () => {
        panel.style.transform = "";
      },
      { once: true },
    );
  };

  const handleBackdropClick = () => {
    if (!isTopMostOpenSheet()) {
      return;
    }

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

    if (!closeOnEscape || !isTopMostOpenSheet()) {
      return;
    }

    setOpen(false, "escape");
  };

  const handleTouchStart = (event: TouchEvent) => {
    if (!options.isOpen.val || !isMobileViewport() || !isTopMostOpenSheet()) {
      return;
    }

    if (event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    const target = event.target;
    const interactiveTarget =
      target instanceof HTMLElement
        ? target.closest<HTMLElement>(
            "button, a, input, textarea, select, summary, [contenteditable='true']",
          )
        : null;
    if (
      interactiveTarget &&
      !interactiveTarget.classList.contains("vsheet-backdrop")
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
    dragPanelHeight = panel.getBoundingClientRect().height;
    isDragging = false;
    clearSheetStackDragProgress(stackParticipantId);
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
      if (isDragging) {
        dragOffsetY = 0;
        applyDragOffset(0);
        applyDragBackdropOpacity(0);
        setSheetStackDragProgress(stackParticipantId, 0);
      }
      return;
    }

    if (!isDragging) {
      isDragging = true;
      setDraggingVisualState(true);
    }

    dragOffsetY = deltaY;
    applyDragOffset(deltaY);
    applyDragBackdropOpacity(deltaY);
    setSheetStackDragProgress(
      stackParticipantId,
      deltaY / getStackDragProgressDistance(),
    );

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
      dragPanelHeight = 0;
      clearSheetStackDragProgress(stackParticipantId);
      return;
    }

    isDragging = false;
    setDraggingVisualState(false);
    clearSheetStackDragProgress(stackParticipantId);

    if (dragOffsetY >= DRAG_CLOSE_THRESHOLD_PX) {
      animatePanelTo("translateY(100%)");
      setOpen(false, "drag");
    } else {
      setBackdropOpenOpacity(1);
      animatePanelTo("translateY(0px)");
    }

    dragOffsetY = 0;
    dragStartY = 0;
    dragPanelHeight = 0;
  };

  backdrop.addEventListener("click", handleBackdropClick);
  closeButton.addEventListener("click", handleCloseButtonClick);
  document.addEventListener("keydown", handleEscape);
  root.addEventListener("touchstart", handleTouchStart, { passive: true });
  root.addEventListener("touchmove", handleTouchMove, { passive: false });
  root.addEventListener("touchend", handleTouchEnd, { passive: true });
  root.addEventListener("touchcancel", handleTouchEnd, { passive: true });
  panel.addEventListener("focusin", handleFocusIn);

  registerSheetStackParticipant({
    id: stackParticipantId,
    isOpen: () => options.isOpen.val,
    getOpenOrder: () => openOrder,
    applyStackSnapshot,
  });

  syncOpenState(previousOpen);
  if (previousOpen && adjustableHeight && isMobileViewport()) {
    scheduleAdjustableTrackingStart();
  }
  syncSheetStackState();

  const stateSync = van.derive(() => {
    const currentOpen = options.isOpen.val;
    const justOpened = currentOpen && !previousOpen;
    const justClosed = !currentOpen && previousOpen;
    if (justOpened) {
      openOrder = claimSheetStackOpenOrder();
      shouldDeferCloseStateClear = false;
      resetStackSnapshotRetainState();
      adjustableTrackingReady = false;
    } else if (justClosed) {
      shouldDeferCloseStateClear = adjustableHeight && isMobileViewport();
      retainStackSnapshotWhileClosed = true;
      scheduleStackSnapshotRetainClear();
      resetAdjustableTracking();
    }
    syncOpenState(currentOpen);
    if (justOpened && adjustableHeight && isMobileViewport()) {
      scheduleAdjustableTrackingStart();
    }
    syncSheetStackState();

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
      resetStackSnapshotRetainState();
      stopMobileLifecycleTracking();
      clearDragCloseStateClearSchedule();
      clearMobileHeightState();
      clearFocusedElementScrollSchedule();
      backdrop.removeEventListener("click", handleBackdropClick);
      closeButton.removeEventListener("click", handleCloseButtonClick);
      document.removeEventListener("keydown", handleEscape);
      root.removeEventListener("touchstart", handleTouchStart);
      root.removeEventListener("touchmove", handleTouchMove);
      root.removeEventListener("touchend", handleTouchEnd);
      root.removeEventListener("touchcancel", handleTouchEnd);
      panel.removeEventListener("focusin", handleFocusIn);
      unregisterSheetStackParticipant(stackParticipantId);
      clearSheetStackDragProgress(stackParticipantId);
      clearStackSnapshot();
      syncSheetStackState();
      root.remove();
    },
  };
};
