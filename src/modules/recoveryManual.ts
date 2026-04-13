import {
  createDescriptorForAttachment,
  createEmptyParentRecoverNotePayload,
  upsertDescriptor,
} from "./recoveryDescriptor";
import {
  getRecoveryParentItem,
  readParentRecoverNotePayload,
  saveParentRecoverNotePayload,
} from "./recoveryNote";

export interface ManualRecoverDescriptorResult {
  parentItems: Zotero.Item[];
  processedAttachments: number;
  createdDescriptors: number;
  updatedDescriptors: number;
  skippedAttachments: number;
}

export async function createDescriptorsForSelectedItems(
  selectedItems: Zotero.Item[],
): Promise<ManualRecoverDescriptorResult> {
  if (!selectedItems.length) {
    throw new Error("No selected items");
  }

  const groupedItems = await groupItemsByParent(selectedItems);
  if (!groupedItems.length) {
    throw new Error("Cannot resolve parent item from selection");
  }

  const parentItems: Zotero.Item[] = [];
  let processedAttachments = 0;
  let createdDescriptors = 0;
  let updatedDescriptors = 0;
  let skippedAttachments = 0;

  for (const group of groupedItems) {
    parentItems.push(group.parentItem);
    const attachments = await collectPDFAttachments(
      group.parentItem,
      group.selectedItems,
    );
    const existingPayload =
      (await readParentRecoverNotePayload(group.parentItem)) ||
      createEmptyParentRecoverNotePayload();

    let nextPayload = existingPayload;
    let parentChanged = false;

    processedAttachments += attachments.length;

    for (const attachment of attachments) {
      try {
        const descriptor = await createDescriptorForAttachment(
          attachment,
          group.parentItem,
        );
        const hasExisting = nextPayload.descriptors.some(
          (item) => item.id === descriptor.id,
        );
        nextPayload = upsertDescriptor(nextPayload, descriptor);
        parentChanged = true;
        if (hasExisting) {
          updatedDescriptors += 1;
        } else {
          createdDescriptors += 1;
        }
      } catch {
        skippedAttachments += 1;
      }
    }

    if (parentChanged) {
      await saveParentRecoverNotePayload(group.parentItem, nextPayload);
    }
  }

  return {
    parentItems,
    processedAttachments,
    createdDescriptors,
    updatedDescriptors,
    skippedAttachments,
  };
}

async function groupItemsByParent(selectedItems: Zotero.Item[]) {
  const groups = new Map<number, { parentItem: Zotero.Item; selectedItems: Zotero.Item[] }>();

  for (const item of selectedItems) {
    const parentItem = await getRecoveryParentItem(item);
    if (!parentItem) {
      continue;
    }

    const existing = groups.get(parentItem.id);
    if (existing) {
      existing.selectedItems.push(item);
      continue;
    }

    groups.set(parentItem.id, {
      parentItem,
      selectedItems: [item],
    });
  }

  return [...groups.values()];
}

async function collectPDFAttachments(
  parentItem: Zotero.Item,
  selectedItems: Zotero.Item[],
): Promise<Zotero.Item[]> {
  const attachmentIDs = new Set<number>();

  for (const item of selectedItems) {
    if (
      item.isAttachment() &&
      item.isPDFAttachment() &&
      item.parentItemID === parentItem.id
    ) {
      attachmentIDs.add(item.id);
    }
  }

  if (!attachmentIDs.size) {
    for (const attachmentID of parentItem.getAttachments()) {
      const attachment = await Zotero.Items.getAsync(attachmentID);
      if (attachment.isPDFAttachment()) {
        attachmentIDs.add(attachment.id);
      }
    }
  }

  if (!attachmentIDs.size) {
    return [];
  }

  const attachments = await Zotero.Items.getAsync([...attachmentIDs]);
  return attachments.filter((attachment) => attachment.isPDFAttachment());
}
