import van from "vanjs-core";
import { createSheet } from "../create-sheet";
import type { SheetInstance } from "../types";

const { button, div, p, strong } = van.tags;
const EXIT_ANIMATION_FALLBACK_MS = 550;

export type Option = "a" | "b" | "c";

const OPTIONS: Option[] = ["a", "b", "c"];

export const openOptionSheet = (): Promise<Option | null> =>
  new Promise((resolve) => {
    const isOpen = van.state(false);
    const selected = van.state<Option>("a");
    let settled = false;
    let sheet: SheetInstance | null = null;

    const settle = (value: Option | null) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(value);
    };

    const submit = () => {
      settle(selected.val);
      sheet?.close("api");
    };

    const destroyAfterCloseAnimation = () => {
      const closingSheet = sheet;
      if (!closingSheet) {
        return;
      }

      const panel = closingSheet.element.querySelector(".vsheet-panel");
      let settledDestroy = false;
      const settleDestroy = () => {
        if (settledDestroy) {
          return;
        }

        settledDestroy = true;
        closingSheet.destroy();
        if (sheet === closingSheet) {
          sheet = null;
        }
      };

      panel?.addEventListener("transitionend", settleDestroy, { once: true });
      window.setTimeout(settleDestroy, EXIT_ANIMATION_FALLBACK_MS);
    };

    sheet = createSheet({
      isOpen,
      content: () =>
        div(
          { class: "option-sheet" },
          strong("Pick an option"),
          p("Select a value and click Submit to return it."),
          div(
            { class: "option-sheet-options" },
            ...OPTIONS.map((option) =>
              button(
                {
                  type: "button",
                  class: () =>
                    selected.val === option
                      ? "option-sheet-option is-active"
                      : "option-sheet-option",
                  "data-option": option,
                  onclick: () => {
                    selected.val = option;
                  },
                },
                option.toUpperCase(),
              ),
            ),
          ),
          button(
            {
              type: "button",
              class: "option-sheet-submit",
              "data-submit": "true",
              onclick: submit,
            },
            "Submit",
          ),
        ),
      onOpenChange: (open, reason) => {
        if (!open) {
          if (reason !== "api") {
            settle(null);
          }

          destroyAfterCloseAnimation();
        }
      },
    });

    requestAnimationFrame(() => {
      if (sheet) {
        isOpen.val = true;
      }
    });
  });
