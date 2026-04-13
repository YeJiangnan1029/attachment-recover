import { AttachmentRecoverDescriptor } from "./recoveryDescriptor";
import { resolveDownloadURL, downloadPDFToTemp, verifyDownloadedPDF, cleanupTempFile } from "./recoveryDownloader";
import { readParentRecoverNotePayload, saveParentRecoverNotePayload } from "./recoveryNote";

export interface RecoveryResult {
  success: boolean;
  parentItem: Zotero.Item;
  descriptor: AttachmentRecoverDescriptor;
  error?: string;
}

export async function recoverDescriptor(
  parentItem: Zotero.Item,
  descriptorId: string,
): Promise<RecoveryResult> {
  const payload = await readParentRecoverNotePayload(parentItem);

  if (!payload) {
    return {
      success: false,
      parentItem,
      descriptor: null as unknown as AttachmentRecoverDescriptor,
      error: "No recovery payload found on parent item",
    };
  }

  const descriptor = payload.descriptors.find((d) => d.id === descriptorId);
  if (!descriptor) {
    return {
      success: false,
      parentItem,
      descriptor: null as unknown as AttachmentRecoverDescriptor,
      error: `Descriptor ${descriptorId} not found in payload`,
    };
  }

  let tempPath: string | undefined;

  try {
    descriptor.status = "downloading";
    descriptor.updatedAt = Date.now();
    await saveParentRecoverNotePayload(parentItem, payload);

    const resolved = resolveDownloadURL(descriptor);
    if (!resolved) {
      throw new Error("Failed to resolve download URL");
    }

    tempPath = await downloadPDFToTemp(resolved.url, resolved.referrer);

    const verified = await verifyDownloadedPDF(tempPath, descriptor);
    if (!verified) {
      throw new Error("Downloaded PDF verification failed");
    }

    const attachment = await Zotero.Attachments.importFromFile({
      file: tempPath,
      parentItemID: parentItem.id,
      contentType: descriptor.mimeType || "application/pdf",
    });

    if (descriptor.filename) {
      try {
        await attachment.renameAttachmentFile(descriptor.filename);
      } catch {}
    }

    descriptor.status = "success";
    descriptor.updatedAt = Date.now();
    descriptor.attemptCount = (descriptor.attemptCount ?? 0) + 1;
    await saveParentRecoverNotePayload(parentItem, payload);

    return { success: true, parentItem, descriptor };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    descriptor.status = "failed";
    descriptor.lastError = message;
    descriptor.attemptCount = (descriptor.attemptCount ?? 0) + 1;
    descriptor.updatedAt = Date.now();
    await saveParentRecoverNotePayload(parentItem, payload);

    return { success: false, parentItem, descriptor, error: message };
  } finally {
    if (tempPath) {
      await cleanupTempFile(tempPath);
    }
  }
}