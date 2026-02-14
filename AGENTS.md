# AGENTS.md

## Mission and Scope

This file defines operational guidance for agents working in this repository.

Scope includes:

- Source changes in `src/`.
- Test changes in `test/`.
- Documentation updates.
- Demo consistency in `src/demo/`.

## Repository Map

- `src/create-sheet.ts`
  Core runtime behavior, state synchronization, dismissal handling, touch interactions, and viewport logic.
- `src/types.ts`
  Public type contracts consumed by package users.
- `src/style.css`
  Component structure styles and CSS variable hooks.
- `src/demo/`
  Working examples of usage patterns and interaction behavior.
- `test/`
  Behavioral coverage for API invariants and runtime interactions.

## Non-negotiable Invariants

- `content` and `sections` are mutually exclusive inputs.
- `sections` must contain exactly one item with `scroll: true`.
- Preserve dismissal reason semantics:
  - `"api"`
  - `"backdrop"`
  - `"escape"`
  - `"drag"`
  - `"close-button"`
- Keep `isOpen` (`VanState<boolean>`) as the source of truth for open/close state.
- Preserve documented option defaults unless intentionally changing the public contract.

## Editing Expectations

- Keep diffs focused and minimal.
- Maintain strict TypeScript safety and existing code style conventions.
- Update tests for behavior changes.
- Update docs when public API, defaults, or behavior changes.
- Avoid new dependencies unless there is a clear and documented need.

## Validation Workflow

After behavior-affecting changes, run:

- `bun run test`
- `bun run lint`
- `bun run check` when touching multiple areas or cross-cutting behavior

If interaction behavior changes, verify expected demo behavior in:

- `src/demo/main.ts`

## API Change Protocol

When changing `SheetOptions`, `SheetInstance`, or exported types:

- Update `README.md` API reference and examples.
- Add or adjust tests in `test/`.
- Include migration notes in the change summary or PR description.

## CSS and UX Guidance

- Preserve compatibility for existing CSS variables unless a versioned contract change is intended.
- Keep mobile and desktop interaction patterns coherent when changing panel or backdrop transitions.
- Preserve keyboard visibility and viewport compensation behavior when modifying mobile viewport logic.

## Commit and PR Quality

Each change summary should include:

- What changed.
- Why it changed.
- How it was validated.
- Risks or edge cases considered.
