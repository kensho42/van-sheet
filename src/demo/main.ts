import van from "vanjs-core";
import { createSheet } from "../create-sheet";
import type { SheetSection } from "../types";
import { openOptionSheet } from "./open-option-sheet";
import "../style.css";
import "./demo.css";

const { button, div, h1, h2, input, p, strong } = van.tags;

const EXIT_ANIMATION_FALLBACK_MS = 550;
const ADJUSTABLE_OPEN_DELAY_MS = 20;

type ActiveSheet = {
  isOpen: ReturnType<typeof van.state<boolean>>;
  sheet: ReturnType<typeof createSheet>;
};

type DemoLayout = "default" | "keyboard-probe" | "adjustable-height";

let activeSheet: ActiveSheet | null = null;
const latestOptionResult = van.state("No option submitted yet.");

const destroySheet = (entry: ActiveSheet) => {
  entry.sheet.destroy();
  if (activeSheet === entry) {
    activeSheet = null;
  }
};

const demoSections = (mode: "mobile" | "desktop"): SheetSection[] => [
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
    content: div(
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
      strong("Fixed Header Block"),
      p("This top section is intentionally non-scrollable by config."),
      p("Focus inputs to validate fixed sections can still adapt to keyboard."),
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

const destroySheetAfterCloseAnimation = (entry: ActiveSheet) => {
  const panel = entry.sheet.element.querySelector(".vsheet-panel");
  let settled = false;

  const settle = () => {
    if (settled) {
      return;
    }

    settled = true;
    destroySheet(entry);
  };

  panel?.addEventListener("transitionend", settle, { once: true });
  window.setTimeout(settle, EXIT_ANIMATION_FALLBACK_MS);
};

const closeActiveSheet = (immediate = false) => {
  if (!activeSheet) {
    return;
  }

  const entry = activeSheet;
  if (immediate) {
    destroySheet(entry);
    return;
  }

  entry.isOpen.val = false;
};

const resolveDemoSections = (
  mode: "mobile" | "desktop",
  layout: DemoLayout,
): SheetSection[] => {
  if (layout === "adjustable-height") {
    return adjustableHeightSections();
  }

  if (layout === "keyboard-probe") {
    return keyboardProbeSections();
  }

  return demoSections(mode);
};

const openDemoSheet = (
  mode: "mobile" | "desktop",
  layout: DemoLayout = "default",
) => {
  closeActiveSheet(true);

  const isOpen = van.state(false);
  const sheet = createSheet({
    isOpen,
    sections: resolveDemoSections(mode, layout),
    adjustableHeight: layout === "adjustable-height",
    onOpenChange: (open) => {
      if (!open) {
        const entry = activeSheet;
        if (entry && entry.sheet === sheet) {
          destroySheetAfterCloseAnimation(entry);
        } else {
          sheet.destroy();
        }
      }
    },
  });

  sheet.element.dataset.demoMode = mode;
  const entry: ActiveSheet = { isOpen, sheet };
  activeSheet = entry;

  const openDelay =
    layout === "adjustable-height" ? ADJUSTABLE_OPEN_DELAY_MS : 0;
  window.setTimeout(() => {
    if (activeSheet === entry) {
      entry.isOpen.val = true;
    }
  }, openDelay);
};

const openOptionSelectorDemo = async () => {
  closeActiveSheet(true);
  const result = await openOptionSheet();
  latestOptionResult.val =
    result === null
      ? "Dismissed without a submitted value."
      : `Submitted value: ${result.toUpperCase()}`;
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
      p("Opens as a bottom sheet. Useful for touch-first mobile flow checks."),
      button(
        { type: "button", onclick: () => openDemoSheet("mobile") },
        "Open Mobile Sheet",
      ),
    ),
    div(
      { class: "demo-card" },
      h2("Desktop Demo"),
      p("Opens as a right-side drawer. Good for desktop layout verification."),
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
  ),
);

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  van.add(root, app);
}
