import { getString } from "../utils/locale";
import { createDescriptorsForSelectedItems } from "./recoveryManual";
import { scanMissingAttachments } from "./recoveryScanner";
import { recoverDescriptor } from "./recoveryExecutor";

export async function runAttachmentRecoverCommand(): Promise<void> {
  const mainWindow = Zotero.getMainWindow();
  const promptWindow = mainWindow as unknown as mozIDOMWindowProxy;
  const selectedItems = mainWindow.ZoteroPane.getSelectedItems();

  if (!selectedItems.length) {
    Services.prompt.alert(
      promptWindow,
      getString("command-placeholder-title"),
      getString("command-placeholder-no-selection"),
    );
    return;
  }

  try {
    const result = await createDescriptorsForSelectedItems(selectedItems);
    const message = [
      getString("command-create-descriptor-success"),
      "",
      getString("command-parent-items-count", {
        args: { count: result.parentItems.length },
      }),
      getString("command-placeholder-selected-count", {
        args: { count: selectedItems.length },
      }),
      getString("command-processed-attachments-count", {
        args: { count: result.processedAttachments },
      }),
      getString("command-created-descriptors-count", {
        args: { count: result.createdDescriptors },
      }),
      getString("command-updated-descriptors-count", {
        args: { count: result.updatedDescriptors },
      }),
      getString("command-skipped-attachments-count", {
        args: { count: result.skippedAttachments },
      }),
    ].join("\n");

    Services.prompt.alert(
      promptWindow,
      getString("command-placeholder-title"),
      message,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Attachment recovery failed";

    Services.prompt.alert(
      promptWindow,
      getString("command-placeholder-title"),
      message,
    );
  }
}

export async function runScanAndRecoverCommand(): Promise<void> {
  const mainWindow = Zotero.getMainWindow();
  const promptWindow = mainWindow as unknown as mozIDOMWindowProxy;

  let missing: import("./recoveryScanner").MissingAttachment[];
  try {
    missing = await scanMissingAttachments();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    Services.prompt.alert(promptWindow, getString("command-scan-title"), message);
    return;
  }

  if (!missing.length) {
    Services.prompt.alert(
      promptWindow,
      getString("command-scan-title"),
      getString("command-scan-no-missing"),
    );
    return;
  }

  const itemTitles = missing
    .slice(0, 10)
    .map(
      (m) =>
        `- ${m.parentItem.getDisplayTitle()} (${m.descriptor.filename || m.descriptor.arxivId || m.descriptor.id})`,
    )
    .join("\n");
  const moreText =
    missing.length > 10
      ? `\n${getString("command-scan-and-more", { args: { count: missing.length - 10 } })}`
      : "";

  const confirmMessage =
    getString("command-scan-found") +
    "\n\n" +
    itemTitles +
    moreText +
    "\n\n" +
    getString("command-scan-confirm-recover");

  const ok = Services.prompt.confirm(
    promptWindow,
    getString("command-scan-title"),
    confirmMessage,
  );

  if (!ok) {
    return;
  }

  let recovered = 0;
  let failed = 0;

  for (const { parentItem, descriptor } of missing) {
    const result = await recoverDescriptor(parentItem, descriptor.id);
    if (result.success) {
      recovered += 1;
    } else {
      failed += 1;
    }
  }

  Services.prompt.alert(
    promptWindow,
    getString("command-scan-title"),
    getString("command-scan-result", {
      args: { recovered, failed, total: missing.length },
    }),
  );
}