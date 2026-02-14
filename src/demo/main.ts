import van from "vanjs-core";
import { createSheet } from "../create-sheet";
import type { SheetSection } from "../types";
import { openOptionSheet } from "./open-option-sheet";
import "../style.css";
import "./demo.css";

const { button, div, h1, h2, input, p, strong } = van.tags;

const EXIT_ANIMATION_FALLBACK_MS = 550;

type ActiveSheet = {
  isOpen: ReturnType<typeof van.state<boolean>>;
  sheet: ReturnType<typeof createSheet>;
};

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

const openDemoSheet = (mode: "mobile" | "desktop") => {
  closeActiveSheet(true);

  const isOpen = van.state(false);
  const sheet = createSheet({
    isOpen,
    sections: demoSections(mode),
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

  requestAnimationFrame(() => {
    if (activeSheet === entry) {
      entry.isOpen.val = true;
    }
  });
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
  ),
);

const root = document.querySelector<HTMLElement>("#app");
if (root) {
  van.add(root, app);
}
