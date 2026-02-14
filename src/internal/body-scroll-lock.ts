type BodyInlineStyleSnapshot = {
  overflow: string;
  position: string;
  top: string;
  left: string;
  right: string;
  width: string;
};

type DocumentInlineStyleSnapshot = {
  overflow: string;
};

let activeDocumentBodyScrollLocks = 0;
let lockedScrollX = 0;
let lockedScrollY = 0;
let bodyInlineStyleSnapshot: BodyInlineStyleSnapshot | null = null;
let documentInlineStyleSnapshot: DocumentInlineStyleSnapshot | null = null;

const supportsDocumentBodyScrollLock = () =>
  typeof window !== "undefined" &&
  typeof document !== "undefined" &&
  Boolean(document.body) &&
  Boolean(document.documentElement);

export const lockDocumentBodyScroll = (): boolean => {
  if (!supportsDocumentBodyScrollLock()) {
    return false;
  }

  const body = document.body;
  const documentElement = document.documentElement;
  if (!body || !documentElement) {
    return false;
  }

  if (activeDocumentBodyScrollLocks === 0) {
    lockedScrollX = Math.max(
      0,
      Math.round(window.scrollX || window.pageXOffset),
    );
    lockedScrollY = Math.max(
      0,
      Math.round(window.scrollY || window.pageYOffset),
    );

    bodyInlineStyleSnapshot = {
      overflow: body.style.overflow,
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
    };
    documentInlineStyleSnapshot = {
      overflow: documentElement.style.overflow,
    };

    documentElement.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
  }

  activeDocumentBodyScrollLocks += 1;
  return true;
};

export const unlockDocumentBodyScroll = () => {
  if (
    !supportsDocumentBodyScrollLock() ||
    activeDocumentBodyScrollLocks === 0
  ) {
    return;
  }

  activeDocumentBodyScrollLocks -= 1;
  if (activeDocumentBodyScrollLocks > 0) {
    return;
  }

  const body = document.body;
  const documentElement = document.documentElement;
  if (body && bodyInlineStyleSnapshot) {
    body.style.overflow = bodyInlineStyleSnapshot.overflow;
    body.style.position = bodyInlineStyleSnapshot.position;
    body.style.top = bodyInlineStyleSnapshot.top;
    body.style.left = bodyInlineStyleSnapshot.left;
    body.style.right = bodyInlineStyleSnapshot.right;
    body.style.width = bodyInlineStyleSnapshot.width;
  }

  if (documentElement && documentInlineStyleSnapshot) {
    documentElement.style.overflow = documentInlineStyleSnapshot.overflow;
  }

  if (
    (lockedScrollX !== 0 || lockedScrollY !== 0) &&
    typeof window.scrollTo === "function"
  ) {
    try {
      window.scrollTo(lockedScrollX, lockedScrollY);
    } catch {
      // Ignore environments that intentionally do not implement scrolling.
    }
  }

  lockedScrollX = 0;
  lockedScrollY = 0;
  bodyInlineStyleSnapshot = null;
  documentInlineStyleSnapshot = null;
};
