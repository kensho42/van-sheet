# van-sheet

`van-sheet` is a reusable sheet primitive for VanJS that supports mobile bottom-sheet behavior and desktop drawer-style layouts.

## Features

- Controlled open/close via `van.state`.
- Dismissal pathways for backdrop, `Escape`, close button, and touch drag.
- Multiple simultaneously open sheets with layered iOS-style depth.
- Simple `content` mode or structured `sections` mode with one scrollable region.
- Mobile keyboard-aware viewport handling.
- Optional content-fit mobile height (`adjustableHeight`) capped to 95% viewport.
- Custom close icon support.
- CSS variables for theme and layout control.

## Installation

Install the package and peer dependency:

```bash
bun add van-sheet vanjs-core
```

```bash
npm install van-sheet vanjs-core
```

Import the component API and base styles:

```ts
import van from "vanjs-core";
import { createSheet } from "van-sheet";
import "van-sheet/style.css";
```

## Quick Start

```ts
import van from "vanjs-core";
import { createSheet } from "van-sheet";
import "van-sheet/style.css";

const { button, div } = van.tags;
const isOpen = van.state(false);

const sheet = createSheet({
  isOpen,
  content: div("Hello from van-sheet"),
});

const openBtn = button({ type: "button", onclick: () => (isOpen.val = true) }, "Open");
const closeBtn = button(
  { type: "button", onclick: () => sheet.close("api") },
  "Close",
);

van.add(document.body, openBtn, closeBtn);
```

## Usage Patterns

### Pattern A: Single-content sheet

```ts
const isOpen = van.state(false);

createSheet({
  isOpen,
  content: "This is the sheet body.",
  onOpenChange: (open, reason) => {
    console.log({ open, reason });
  },
});
```

### Pattern B: Section layout (fixed + scroll + fixed)

`sections` must include exactly one `scroll: true` section.

```ts
const isOpen = van.state(false);

createSheet({
  isOpen,
  sections: [
    {
      className: "sheet-top",
      content: "Top fixed section",
    },
    {
      className: "sheet-content",
      scroll: true,
      content: "Middle scrollable section",
    },
    {
      className: "sheet-footer",
      content: "Bottom fixed section",
    },
  ],
});
```

### Pattern C: Promise-based option selector

```ts
import van from "vanjs-core";
import { createSheet } from "van-sheet";

type Option = "a" | "b" | "c";

const openOptionSheet = (): Promise<Option | null> =>
  new Promise((resolve) => {
    const isOpen = van.state(false);
    const selected = van.state<Option>("a");
    let settled = false;

    const settle = (value: Option | null) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };

    const sheet = createSheet({
      isOpen,
      content: () => {
        const { button, div } = van.tags;
        return div(
          button({ type: "button", onclick: () => (selected.val = "a") }, "A"),
          button({ type: "button", onclick: () => (selected.val = "b") }, "B"),
          button({ type: "button", onclick: () => (selected.val = "c") }, "C"),
          button(
            {
              type: "button",
              onclick: () => {
                settle(selected.val);
                sheet.close("api");
              },
            },
            "Submit",
          ),
        );
      },
      onOpenChange: (open, reason) => {
        if (!open && reason !== "api") {
          settle(null);
        }
      },
    });

    requestAnimationFrame(() => {
      isOpen.val = true;
    });
  });
```

## Public API

Exports from `src/index.ts`:

- `createSheet`
- `SheetInstance`
- `SheetOptions`
- `SheetReason`
- `SheetRenderable`
- `SheetSection`
- `VanState`

### `createSheet(options: SheetOptions): SheetInstance`

Creates and mounts a sheet to `document.body` (or `mountTo` when provided).

### `SheetOptions`

| Field | Type | Default | Notes |
| --- | --- | --- | --- |
| `isOpen` | `VanState<boolean>` | required | Source of truth for open/close state. |
| `content` | `SheetRenderable` | `undefined` | Use for single-scroll-content mode. |
| `sections` | `SheetSection[]` | `undefined` | Use for fixed/scroll/fixed layouts. |
| `adjustableHeight` | `boolean` | `false` | Mobile-only. Fits to content height up to the 95% mobile cap. |
| `closeIcon` | `HTMLElement \| (() => HTMLElement)` | built-in icon | Custom close icon element/factory. |
| `mountTo` | `HTMLElement \| string` | `document.body` | Selector fallback is `document.body` if no match. |
| `dismissible` | `boolean` | `true` | Prevent non-API closing when `false`. |
| `closeOnBackdrop` | `boolean` | `true` | Backdrop click closes sheet. |
| `closeOnEscape` | `boolean` | `true` | `Escape` closes sheet. |
| `showBackdrop` | `boolean` | `true` | Controls backdrop visibility. |
| `showCloseButton` | `boolean` | `true` | Controls close button visibility. |
| `onOpenChange` | `(open: boolean, reason: SheetReason) => void` | `undefined` | Called when open state changes. |

### `SheetSection`

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `content` | `SheetRenderable` | yes | Section content. |
| `scroll` | `boolean` | no | Exactly one section must be `true` when using `sections`. |
| `className` | `string` | no | Optional custom class appended to section root. |

### `SheetReason`

`"api" | "backdrop" | "escape" | "drag" | "close-button"`

### `SheetInstance`

| Field | Type | Description |
| --- | --- | --- |
| `element` | `HTMLElement` | Root `.vsheet-root` element. |
| `open` | `() => void` | Sets `isOpen` to `true` with reason `"api"`. |
| `close` | `(reason?: SheetReason) => void` | Sets `isOpen` to `false` with the given reason. |
| `destroy` | `() => void` | Removes listeners and detaches sheet from DOM. |

### Validation and error rules

- You cannot provide both `content` and `sections`.
- You must provide one of `content` or `sections`.
- `sections` must contain exactly one section with `scroll: true`.

### Adjustable mobile height

- Enable with `adjustableHeight: true`.
- Applies only in mobile viewport mode (`(max-width: 767px)`).
- Sheet height follows content and animates height changes while open.
- Max height remains capped at the existing 95% mobile limit (keyboard adjustments still apply).
- When content exceeds the cap, overflow remains in the scroll section.

## Styling and Theming

`van-sheet` supports the following CSS variables:

- `--vsheet-z-index`
- `--vsheet-stack-layer`
- `--vsheet-stack-offset-y`
- `--vsheet-stack-scale`
- `--vsheet-bg`
- `--vsheet-close-bg`
- `--vsheet-mobile-height`
- `--vsheet-keyboard-height`
- `--vsheet-content-extra-bottom`
- `--vsheet-sections-extra-bottom`
- `--vsheet-root-offset-y`

Example:

```css
:root {
  --vsheet-z-index: 2000;
  --vsheet-bg: #fdfdfd;
  --vsheet-close-bg: #ececec;
}
```

## Accessibility and Interaction Notes

- Panel uses `role="dialog"` with `aria-modal="true"`.
- Backdrop and close button are semantic `button` elements with labels.
- Keyboard dismissal is available via `Escape` and can be disabled with `closeOnEscape: false`.
- Touch drag-to-close is active on mobile viewport conditions and closes when downward drag passes the threshold.
- When multiple sheets are open, only the topmost sheet is interactive (`Escape`, backdrop click, and drag close).
- While dragging the top sheet, background stack layers animate in sync to preview the next layer.

## Development

Run commands from the repository root:

- `bun run dev`
- `bun run test`
- `bun run test:watch`
- `bun run lint`
- `bun run format`
- `bun run check`
- `bun run build`

Demo entrypoint: `src/demo/main.ts`

## Testing Coverage

Current test suites cover:

- Section layout invariants and input validation.
- Close icon rendering and dismissal reason behavior.
- Mobile viewport and keyboard-related height adjustments.
- Promise-returning option-sheet flow behavior.

## License

MIT
