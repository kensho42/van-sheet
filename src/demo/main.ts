import van from "vanjs-core";
import { createSheet } from "../create-sheet";
import type { SheetSection } from "../types";
import floatingCloseFoodImage from "./assets/floating-close-food.png";
import { openOptionSheet } from "./open-option-sheet";
import "../style.css";
import "./demo.css";

const { button, div, h1, h2, img, input, p, strong } = van.tags;

const EXIT_ANIMATION_FALLBACK_MS = 550;
const ADJUSTABLE_OPEN_DELAY_MS = 20;

type DemoLayout =
  | "default"
  | "keyboard-probe"
  | "adjustable-height"
  | "floating-media"
  | "drag-start-guard";
const latestOptionResult = van.state("No option submitted yet.");

type DemoSectionActions = {
  closeSheet: () => void;
  openAnotherSheet: () => void;
};

const demoSections = (
  mode: "mobile" | "desktop",
  actions?: DemoSectionActions,
): SheetSection[] => [
  {
    className: "demo-sheet-top",
    content: div(
      strong(mode === "mobile" ? "Mobile Sheet" : "Desktop Drawer"),
      p(
        mode === "mobile"
          ? "Fixed top section. The middle content can scroll independently."
          : "Fixed top section. This desktop variant still keeps scroll in the middle section.",
      ),
    ),
  },
  {
    className: "demo-sheet-content",
    scroll: true,
    content: div(
      { class: "demo-sheet-scroll" },
      div(
        { class: "row" },
        strong("Scrollable Content"),
        p("Use this middle section to validate internal scrolling behavior."),
      ),
      ...Array.from({ length: 10 }, (_, i) =>
        div(
          { class: "row" },
          strong(`Item ${i + 1}`),
          p("Sample content block to create realistic scroll depth."),
        ),
      ),
      div(
        { class: "row" },
        strong("Keyboard Probe"),
        p("Focus this field on mobile and verify footer stays visible."),
        input({
          type: "text",
          placeholder: "Focus me on mobile",
          "aria-label": "Demo input field",
        }),
      ),
    ),
  },
  {
    className: "demo-sheet-footer",
    content:
      mode === "desktop"
        ? div(
            { class: "demo-sheet-actions" },
            button(
              {
                type: "button",
                class: "secondary",
                onclick: actions?.closeSheet ?? (() => {}),
              },
              "Close Drawer",
            ),
            button(
              {
                type: "button",
                onclick: actions?.openAnotherSheet ?? (() => {}),
              },
              "Add Drawer",
            ),
          )
        : div(
            { class: "demo-sheet-actions" },
            button({ type: "button", class: "secondary" }, "Cancel"),
            button({ type: "button" }, "Confirm"),
          ),
  },
];

const keyboardProbeSections = (): SheetSection[] => [
  {
    className: "demo-keyboard-fixed demo-keyboard-fixed-top",
    content: div(
      input({
        type: "text",
        placeholder: "Header input (fixed section)",
        "aria-label": "Header fixed section input",
      }),
    ),
  },
  {
    className: "demo-keyboard-probe-content",
    scroll: true,
    content: div(
      { class: "demo-sheet-scroll" },
      div(
        { class: "row" },
        strong("Scrollable Middle"),
        p("This is still the only `scroll: true` section."),
      ),
      ...Array.from({ length: 8 }, (_, i) =>
        div(
          { class: "row" },
          strong(`Keyboard Item ${i + 1}`),
          p("Use these rows to confirm middle scrolling remains intact."),
        ),
      ),
    ),
  },
  {
    className: "demo-keyboard-fixed demo-keyboard-fixed-bottom",
    content: div(
      div(
        { class: "demo-keyboard-actions" },
        button({ type: "button", class: "secondary" }, "Cancel"),
        button({ type: "button" }, "Save"),
      ),
    ),
  },
];

const adjustableHeightSections = (): SheetSection[] => {
  const itemCount = van.state(1);
  const minItems = 1;
  const maxItems = 18;
  const dynamicRows = div();

  const addItem = () => {
    itemCount.val = Math.min(maxItems, itemCount.val + 1);
  };

  const removeItem = () => {
    itemCount.val = Math.max(minItems, itemCount.val - 1);
  };

  const dynamicRowsSync = van.derive(() => {
    dynamicRows.replaceChildren(
      ...Array.from({ length: itemCount.val }, (_, i) =>
        div(
          { class: "row" },
          strong(`Dynamic Row ${i + 1}`),
          p(
            "Used to verify content-fit height transitions in adjustable mode.",
          ),
        ),
      ),
    );
  });
  void dynamicRowsSync;

  return [
    {
      className: "demo-adjustable-top",
      content: div(
        strong("Adjustable Height Demo"),
        p("Tap +/- to change content and watch the sheet resize smoothly."),
        p("The mobile sheet still caps at 95% height, then scroll takes over."),
      ),
    },
    {
      className: "demo-adjustable-content",
      scroll: true,
      content: div(
        { class: "demo-sheet-scroll demo-adjustable-scroll" },
        div(
          { class: "row demo-adjustable-controls" },
          strong("Rows"),
          p(
            () =>
              `${itemCount.val} dynamic item${itemCount.val === 1 ? "" : "s"}`,
          ),
          div(
            { class: "demo-adjustable-buttons" },
            button(
              {
                type: "button",
                class: "secondary",
                onclick: removeItem,
              },
              "-",
            ),
            button(
              {
                type: "button",
                class: "accent",
                onclick: addItem,
              },
              "+",
            ),
          ),
        ),
        dynamicRows,
      ),
    },
  ];
};

const floatingMediaSections = (
  mode: "mobile" | "desktop",
  actions?: DemoSectionActions,
): SheetSection[] => [
  {
    className: "demo-floating-media-content",
    scroll: true,
    content: div(
      { class: "demo-floating-scroll" },
      img({
        class: "demo-floating-image",
        src: floatingCloseFoodImage,
        alt: "Cheesy skillet dish with herbs and toast.",
      }),
      div(
        { class: "row demo-floating-profile" },
        strong(mode === "mobile" ? "Chef Aria Lane" : "Featured Kitchen"),
        p(
          "Floating close button stays above content while the hero media starts at the top edge.",
        ),
      ),
      ...Array.from({ length: 6 }, (_, i) =>
        div(
          { class: "row" },
          strong(`Post ${i + 1}`),
          p("Feed-style content to validate top-aligned media and scrolling."),
        ),
      ),
    ),
  },
  {
    className: "demo-floating-media-footer",
    content:
      mode === "desktop"
        ? div(
            { class: "demo-sheet-actions" },
            button(
              {
                type: "button",
                class: "secondary",
                onclick: actions?.closeSheet ?? (() => {}),
              },
              "Close Drawer",
            ),
            button(
              {
                type: "button",
                onclick: actions?.openAnotherSheet ?? (() => {}),
              },
              "Add Drawer",
            ),
          )
        : div(
            { class: "demo-sheet-actions" },
            button(
              {
                type: "button",
                class: "secondary",
                onclick: actions?.closeSheet ?? (() => {}),
              },
              "Dismiss",
            ),
            button({ type: "button" }, "Follow"),
          ),
  },
];

const dragStartGuardSections = (
  mode: "mobile" | "desktop",
  actions?: DemoSectionActions,
): SheetSection[] => [
  {
    className: "demo-sheet-top",
    content: div(
      strong("Drag-Start Guard Demo"),
      p(
        "Horizontal swipe zones below block sheet pull-down after horizontal intent is detected.",
      ),
    ),
  },
  {
    className: "demo-sheet-content",
    scroll: true,
    content: div(
      { class: "demo-sheet-scroll demo-drag-guard-scroll" },
      div(
        { class: "row" },
        strong("Try this"),
        p(
          "Swipe left/right in the highlighted lanes. Drag down from regular rows to close.",
        ),
      ),
      div(
        {
          class: "demo-drag-carousel",
          "data-vsheet-drag-block": "true",
        },
        ...Array.from({ length: 7 }, (_, i) =>
          div({ class: "demo-drag-chip" }, `Default Block ${i + 1}`),
        ),
      ),
      div(
        { class: "demo-drag-custom-zone" },
        ...Array.from({ length: 7 }, (_, i) =>
          div({ class: "demo-drag-chip alt" }, `Custom Block ${i + 1}`),
        ),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        div(
          { class: "row" },
          strong(`Normal Row ${i + 1}`),
          p("Start a downward drag here to verify drag-to-close still works."),
        ),
      ),
      div(
        { class: "row" },
        strong(mode === "mobile" ? "Mobile Note" : "Desktop Note"),
        p(
          "This sheet uses both `[data-vsheet-drag-block]` and `dragStartBlockSelector`.",
        ),
      ),
    ),
  },
  {
    className: "demo-sheet-footer",
    content:
      mode === "desktop"
        ? div(
            { class: "demo-sheet-actions" },
            button(
              {
                type: "button",
                class: "secondary",
                onclick: actions?.closeSheet ?? (() => {}),
              },
              "Close Drawer",
            ),
            button(
              {
                type: "button",
                onclick: actions?.openAnotherSheet ?? (() => {}),
              },
              "Add Drawer",
            ),
          )
        : div(
            { class: "demo-sheet-actions" },
            button({ type: "button", class: "secondary" }, "Cancel"),
            button({ type: "button" }, "Confirm"),
          ),
  },
];

const destroySheetAfterCloseAnimation = (
  sheet: ReturnType<typeof createSheet>,
) => {
  const panel = sheet.element.querySelector(".vsheet-panel");
  let settled = false;

  const settle = () => {
    if (settled) {
      return;
    }

    settled = true;
    sheet.destroy();
  };

  panel?.addEventListener("transitionend", settle, { once: true });
  window.setTimeout(settle, EXIT_ANIMATION_FALLBACK_MS);
};

const resolveDemoSections = (
  mode: "mobile" | "desktop",
  layout: DemoLayout,
  actions?: DemoSectionActions,
): SheetSection[] => {
  if (layout === "adjustable-height") {
    return adjustableHeightSections();
  }

  if (layout === "keyboard-probe") {
    return keyboardProbeSections();
  }

  if (layout === "floating-media") {
    return floatingMediaSections(mode, actions);
  }

  if (layout === "drag-start-guard") {
    return dragStartGuardSections(mode, actions);
  }

  return demoSections(mode, actions);
};

const openDemoSheet = (
  mode: "mobile" | "desktop",
  layout: DemoLayout = "default",
) => {
  const isOpen = van.state(false);
  const closeSheet = () => {
    isOpen.val = false;
  };
  const openAnotherSheet = () => {
    openDemoSheet(mode, layout);
  };
  const sheet = createSheet({
    isOpen,
    sections: resolveDemoSections(mode, layout, {
      closeSheet,
      openAnotherSheet,
    }),
    dragStartBlockSelector:
      layout === "drag-start-guard" ? ".demo-drag-custom-zone" : undefined,
    adjustableHeight: layout === "adjustable-height",
    floatingCloseButton: layout === "floating-media",
    onOpenChange: (open) => {
      if (!open) {
        destroySheetAfterCloseAnimation(sheet);
      }
    },
  });

  sheet.element.dataset.demoMode = mode;

  const openDelay =
    layout === "adjustable-height" ? ADJUSTABLE_OPEN_DELAY_MS : 0;
  window.setTimeout(() => {
    if (sheet.element.isConnected) {
      isOpen.val = true;
    }
  }, openDelay);
};

const openOptionSelectorDemo = async () => {
  const result = await openOptionSheet();
  latestOptionResult.val =
    result === null
      ? "Dismissed without a submitted value."
      : `Submitted value: ${result.toUpperCase()}`;
};

const stackBuilderSections = (
  level: number,
  openAnotherSheet: () => void,
  closeSheet: () => void,
): SheetSection[] => [
  {
    className: "demo-sheet-top",
    content: div(
      strong(`Stack Builder Sheet ${level}`),
      p("Each layer has its own button to open another sheet above it."),
    ),
  },
  {
    className: "demo-sheet-content",
    scroll: true,
    content: div(
      { class: "demo-sheet-scroll" },
      div(
        { class: "row" },
        strong(`Sheet #${level}`),
        p("Tap the footer action below to stack one more sheet."),
      ),
      ...Array.from({ length: 4 }, (_, index) =>
        div(
          { class: "row" },
          strong(`Context Row ${index + 1}`),
          p("Keeps enough content so stacked depth and scrolling are visible."),
        ),
      ),
    ),
  },
  {
    className: "demo-sheet-footer",
    content: div(
      { class: "demo-sheet-actions" },
      button(
        {
          type: "button",
          class: "secondary",
          onclick: closeSheet,
        },
        "Close This Sheet",
      ),
      button(
        {
          type: "button",
          class: "accent",
          onclick: openAnotherSheet,
        },
        "Add Another Sheet",
      ),
    ),
  },
];

const openStackBuilderDemo = (
  mode: "mobile" | "desktop" = "mobile",
  level = 1,
) => {
  const isOpen = van.state(false);
  const openAnotherSheet = () => {
    openStackBuilderDemo(mode, level + 1);
  };
  const closeSheet = () => {
    isOpen.val = false;
  };

  const sheet = createSheet({
    isOpen,
    sections: stackBuilderSections(level, openAnotherSheet, closeSheet),
    onOpenChange: (open) => {
      if (!open) {
        destroySheetAfterCloseAnimation(sheet);
      }
    },
  });

  sheet.element.dataset.demoMode = mode;

  window.setTimeout(() => {
    if (sheet.element.isConnected) {
      isOpen.val = true;
    }
  }, 0);
};

const app = div(
  { class: "demo" },
  h1("van-sheet demo"),
  p("Test both mobile (bottom) and desktop (right) interaction patterns."),
  div(
    { class: "demo-grid" },
    div(
      { class: "demo-card" },
      h2("Mobile Demo"),
      p(
        "Opens as a bottom sheet. Tap multiple times to see stacked sheet layering.",
      ),
      button(
        { type: "button", onclick: () => openDemoSheet("mobile") },
        "Open Mobile Sheet",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Desktop Demo"),
      p(
        "Opens as a right-side drawer. Use the in-drawer Add Drawer button to push stacked drawers.",
      ),
      button(
        {
          type: "button",
          class: "secondary",
          onclick: () => openDemoSheet("desktop"),
        },
        "Open Desktop Drawer",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Return Value Demo"),
      p("Shows how a sheet can resolve a Promise with the selected option."),
      button(
        {
          type: "button",
          class: "accent",
          onclick: () => {
            void openOptionSelectorDemo();
          },
        },
        "Open Option Selector",
      ),
      p({ class: "demo-result" }, () => latestOptionResult.val),
    ),
    div(
      { class: "demo-card" },
      h2("Keyboard + Fixed Sections"),
      p(
        "Opens a mobile sheet with fixed header/footer inputs to verify non-scroll sections adapt when keyboard appears.",
      ),
      button(
        {
          type: "button",
          class: "accent",
          onclick: () => openDemoSheet("mobile", "keyboard-probe"),
        },
        "Open Keyboard Probe",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Adjustable Height"),
      p(
        "Opens a mobile sheet where height follows content with smooth transitions and a 95% cap.",
      ),
      button(
        {
          type: "button",
          class: "accent",
          onclick: () => openDemoSheet("mobile", "adjustable-height"),
        },
        "Open Adjustable Height Demo",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Floating Close + Media"),
      p(
        "Shows top-starting media content while the close button floats above it.",
      ),
      button(
        {
          type: "button",
          class: "accent",
          onclick: () => openDemoSheet("mobile", "floating-media"),
        },
        "Open Floating Media Demo",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Stack Builder Demo"),
      p("Every opened sheet has an Add button that opens another sheet."),
      button(
        {
          type: "button",
          class: "accent",
          onclick: () => openStackBuilderDemo("mobile"),
        },
        "Open Stack Builder",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Drag-Start Guard"),
      p(
        "Horizontal swipe lanes axis-lock drag-start after horizontal movement begins.",
      ),
      button(
        {
          type: "button",
          class: "accent",
          onclick: () => openDemoSheet("mobile", "drag-start-guard"),
        },
        "Open Drag-Start Guard Demo",
      ),
    ),
  ),
);

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  van.add(root, app);
}
