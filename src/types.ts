export interface VanState<T> {
  val: T;
}

export type SheetReason =
  | "api"
  | "backdrop"
  | "escape"
  | "drag"
  | "close-button";

export interface SheetOptions {
  isOpen: VanState<boolean>;
  content: HTMLElement | string | (() => HTMLElement | string);
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
