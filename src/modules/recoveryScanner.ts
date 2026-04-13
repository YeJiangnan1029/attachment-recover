import { AttachmentRecoverDescriptor } from "./recoveryDescriptor";
import { readParentRecoverNotePayload } from "./recoveryNote";

export interface MissingAttachment {
  parentItem: Zotero.Item;
  descriptor: AttachmentRecoverDescriptor;
}

export async function scanMissingAttachments(): Promise<MissingAttachment[]> {
  const results: MissingAttachment[] = [];
  const allItems = await Zotero.Items.getAll(Zotero.Libraries.userLibraryID);
  const itemsWithNotes = allItems.filter(
    (item: Zotero.Item) => item.isRegularItem() && item.getNotes().length > 0,
  );

  for (const parentItem of itemsWithNotes) {
    const payload = await readParentRecoverNotePayload(parentItem);
    if (!payload) continue;

    for (const descriptor of payload.descriptors) {
      if (descriptor.status === "success") continue;

      let found = false;
      for (const attID of parentItem.getAttachments()) {
        const att = await Zotero.Items.getAsync(attID);
        if (!att.isPDFAttachment()) continue;
        const filePath = await att.getFilePathAsync();
        if (att.attachmentFilename === descriptor.filename || filePath) {
          if (filePath) {
            found = true;
            break;
          }
        }
      }

      if (!found) {
        results.push({ parentItem, descriptor });
      }
    }
  }

  return results;
}