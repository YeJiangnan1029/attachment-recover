import { AttachmentRecoverDescriptor } from "./recoveryDescriptor";
import { readParentRecoverNotePayload } from "./recoveryNote";

export interface ParentRecoveryTask {
  descriptor: AttachmentRecoverDescriptor;
  hasLocalFile: boolean;
}

export async function listParentRecoveryTasks(
  parentItem: Zotero.Item,
): Promise<ParentRecoveryTask[]> {
  const payload = await readParentRecoverNotePayload(parentItem);
  if (!payload) {
    return [];
  }

  const localPDFs = await collectLocalPDFAttachments(parentItem);

  return payload.descriptors.map((descriptor) => ({
    descriptor,
    hasLocalFile: hasLocalFileForDescriptor(descriptor, localPDFs),
  }));
}

async function collectLocalPDFAttachments(
  parentItem: Zotero.Item,
): Promise<Zotero.Item[]> {
  const attachments: Zotero.Item[] = [];

  for (const attachmentID of parentItem.getAttachments()) {
    const attachment = await Zotero.Items.getAsync(attachmentID);
    if (!attachment.isPDFAttachment()) {
      continue;
    }

    const filePath = await attachment.getFilePathAsync();
    if (!filePath) {
      continue;
    }

    attachments.push(attachment);
  }

  return attachments;
}

function hasLocalFileForDescriptor(
  descriptor: AttachmentRecoverDescriptor,
  localPDFs: Zotero.Item[],
): boolean {
  if (!localPDFs.length) {
    return false;
  }

  if (descriptor.filename) {
    return localPDFs.some(
      (attachment) => attachment.attachmentFilename === descriptor.filename,
    );
  }

  return localPDFs.length > 0;
}
