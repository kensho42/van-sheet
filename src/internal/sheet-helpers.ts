import type { SheetOptions, SheetRenderable, SheetSection } from "../types";
import { createDefaultCloseIcon } from "./icons";

// Pure helpers for option normalization and small DOM utility operations.
export const resolveMountTarget = (
  mountTo?: HTMLElement | string,
): HTMLElement => {
  if (!mountTo) {
    return document.body;
  }

  if (typeof mountTo === "string") {
    const target = document.querySelector<HTMLElement>(mountTo);
    return target ?? document.body;
  }

  return mountTo;
};

export const resolveContent = (
  content: SheetRenderable,
): HTMLElement | string =>
  typeof content === "function" ? content() : content;

export const normalizeSections = (options: SheetOptions): SheetSection[] => {
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

export const resolveSectionClassName = (section: SheetSection): string => {
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

export const resolveCloseIcon = (
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

export const findScrollableAncestor = (
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
