// Shared stack coordinator for all sheet instances in this runtime.
// Keeps cross-instance layering, top-sheet resolution, and drag-progress sync.
export type SheetStackSnapshot = {
  depthFromTop: number;
  isTop: boolean;
  layer: number;
  openCount: number;
  visualDepth: number;
  stackDragging: boolean;
};

type SheetStackParticipant = {
  id: number;
  isOpen: () => boolean;
  getOpenOrder: () => number;
  applyStackSnapshot: (snapshot: SheetStackSnapshot | null) => void;
};

const sheetStackParticipants = new Map<number, SheetStackParticipant>();
let nextSheetStackParticipantId = 1;
let nextSheetStackOpenOrder = 1;
let activeStackDragParticipantId: number | null = null;
let activeStackDragProgress = 0;

const getOpenSheetStackParticipants = (): SheetStackParticipant[] =>
  Array.from(sheetStackParticipants.values())
    .filter((participant) => participant.isOpen())
    .sort(
      (leftParticipant, rightParticipant) =>
        leftParticipant.getOpenOrder() - rightParticipant.getOpenOrder(),
    );

const getTopOpenSheetStackParticipant = (): SheetStackParticipant | null => {
  const openParticipants = getOpenSheetStackParticipants();
  if (openParticipants.length === 0) {
    return null;
  }

  return openParticipants[openParticipants.length - 1];
};

export const claimSheetStackParticipantId = () => nextSheetStackParticipantId++;

export const claimSheetStackOpenOrder = () => nextSheetStackOpenOrder++;

export const registerSheetStackParticipant = (
  participant: SheetStackParticipant,
) => {
  sheetStackParticipants.set(participant.id, participant);
};

export const unregisterSheetStackParticipant = (participantId: number) => {
  sheetStackParticipants.delete(participantId);
};

export const isTopOpenSheetStackParticipant = (
  participantId: number,
): boolean => getTopOpenSheetStackParticipant()?.id === participantId;

export const syncSheetStackState = () => {
  const openParticipants = getOpenSheetStackParticipants();
  const openCount = openParticipants.length;
  const topParticipant = openParticipants[openCount - 1];
  const stackDragProgress =
    topParticipant && activeStackDragParticipantId === topParticipant.id
      ? activeStackDragProgress
      : 0;

  if (stackDragProgress === 0) {
    activeStackDragParticipantId = null;
    activeStackDragProgress = 0;
  }

  const stackDragging = stackDragProgress > 0;
  const openParticipantIds = new Set(
    openParticipants.map((participant) => participant.id),
  );

  for (const [index, participant] of openParticipants.entries()) {
    const depthFromTop = openCount - index - 1;
    const visualDepth = Math.max(0, depthFromTop - stackDragProgress);
    participant.applyStackSnapshot({
      depthFromTop,
      isTop: depthFromTop === 0,
      layer: index,
      openCount,
      visualDepth,
      stackDragging,
    });
  }

  for (const participant of sheetStackParticipants.values()) {
    if (openParticipantIds.has(participant.id)) {
      continue;
    }

    participant.applyStackSnapshot(null);
  }
};

export const setSheetStackDragProgress = (
  participantId: number,
  progress: number,
) => {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  if (
    activeStackDragParticipantId === participantId &&
    activeStackDragProgress === clampedProgress
  ) {
    return;
  }

  activeStackDragParticipantId = participantId;
  activeStackDragProgress = clampedProgress;
  syncSheetStackState();
};

export const clearSheetStackDragProgress = (participantId?: number) => {
  if (
    participantId !== undefined &&
    activeStackDragParticipantId !== participantId
  ) {
    return;
  }

  if (activeStackDragParticipantId === null && activeStackDragProgress === 0) {
    return;
  }

  activeStackDragParticipantId = null;
  activeStackDragProgress = 0;
  syncSheetStackState();
};
