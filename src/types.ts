export interface VanState<T> {
  val: T;
}

export type SheetReason =
  | "api"
  | "backdrop"
  | "escape"
  | "drag"
  | "close-button";

export type SheetRenderable =
  | HTMLElement
  | string
  | (() => HTMLElement | string);

export interface SheetSection {
  content: SheetRenderable;
  scroll?: boolean;
  className?: string;
}

export interface SheetOptions {
  isOpen: VanState<boolean>;
  content?: SheetRenderable;
  sections?: SheetSection[];
  adjustableHeight?: boolean;
  closeIcon?: HTMLElement | (() => HTMLElement);
  mountTo?: HTMLElement | string;
  dismissible?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showBackdrop?: boolean;
  showCloseButton?: boolean;
  onOpenChange?: (open: boolean, reason: SheetReason) => void;
}

export interface SheetInstance {
  element: HTMLElement;
  open: () => void;
  close: (reason?: SheetReason) => void;
  destroy: () => void;
}
