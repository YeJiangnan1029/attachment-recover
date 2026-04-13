import {
  createEmptyParentRecoverNotePayload,
  isParentRecoverNotePayload,
  ParentRecoverNotePayload,
} from "./recoveryDescriptor";

export function serializeParentRecoverNotePayload(
  payload: ParentRecoverNotePayload,
): string {
  return JSON.stringify(payload, null, 2);
}

export function parseParentRecoverNotePayload(
  noteContent: string,
): ParentRecoverNotePayload | null {
  try {
    const parsed = JSON.parse(noteContent) as unknown;
    return isParentRecoverNotePayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function getRecoveryParentItem(
  item: Zotero.Item,
): Promise<Zotero.Item | null> {
  if (item.isRegularItem()) {
    return item;
  }

  if (!item.parentItemID) {
    return null;
  }

  return Zotero.Items.getAsync(item.parentItemID);
}

export async function listRecoveryNotesForParentItem(
  parentItem: Zotero.Item,
): Promise<Zotero.Item[]> {
  const noteIDs = parentItem.getNotes();
  if (!noteIDs.length) {
    return [];
  }

  const notes = await Zotero.Items.getAsync(noteIDs);
  return notes.filter((note) => {
    if (!note?.isNote()) {
      return false;
    }

    return !!parseParentRecoverNotePayload(note.getNote());
  });
}

export async function getRecoveryNoteForParentItem(
  parentItem: Zotero.Item,
): Promise<Zotero.Item | null> {
  const notes = await listRecoveryNotesForParentItem(parentItem);
  if (!notes.length) {
    return null;
  }

  if (notes.length > 1) {
    throw new Error("Multiple attachment_recover management notes found");
  }

  return notes[0];
}

export async function readParentRecoverNotePayload(
  parentItem: Zotero.Item,
): Promise<ParentRecoverNotePayload | null> {
  const note = await getRecoveryNoteForParentItem(parentItem);
  if (!note) {
    return null;
  }

  return parseParentRecoverNotePayload(note.getNote());
}

export async function ensureRecoveryNoteForParentItem(
  parentItem: Zotero.Item,
): Promise<Zotero.Item> {
  const existing = await getRecoveryNoteForParentItem(parentItem);
  if (existing) {
    return existing;
  }

  const note = new Zotero.Item("note");
  note.libraryID = parentItem.libraryID;
  note.parentItemID = parentItem.id;
  note.setNote(
    serializeParentRecoverNotePayload(createEmptyParentRecoverNotePayload()),
  );
  await note.saveTx();
  return note;
}

export async function saveParentRecoverNotePayload(
  parentItem: Zotero.Item,
  payload: ParentRecoverNotePayload,
): Promise<Zotero.Item> {
  const note = await ensureRecoveryNoteForParentItem(parentItem);
  note.setNote(serializeParentRecoverNotePayload(payload));
  await note.saveTx();
  return note;
}
