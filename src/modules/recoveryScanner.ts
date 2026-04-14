import { AttachmentRecoverDescriptor } from "./recoveryDescriptor";
import { listParentRecoveryTasks } from "./recoveryTasks";

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
    const tasks = await listParentRecoveryTasks(parentItem);

    for (const { descriptor, hasLocalFile } of tasks) {
      if (descriptor.status === "success") continue;

      if (!hasLocalFile) {
        results.push({ parentItem, descriptor });
      }
    }
  }

  return results;
}
