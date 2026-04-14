import { getString, initLocale } from "./utils/locale";
import {
  runAttachmentRecoverCommand,
  runScanAndRecoverCommand,
} from "./modules/recoveryCommand";
import { createDescriptorsForSelectedItems } from "./modules/recoveryManual";
import { sha256Hex } from "./modules/recoveryDescriptor";
import { registerRecoveryStatusPanel } from "./modules/recoveryStatusPanel";
import {
  getRecoveryParentItem,
  readParentRecoverNotePayload,
} from "./modules/recoveryNote";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerNotifier();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  addon.data.initialized = true;
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  void win;

  addon.data.ztoolkit = createZToolkit();
  registerRecoveryStatusPanel();

  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `zotero-menu-tools-${addon.data.config.addonRef}`,
    label: getString("menu-tools-attachment-recover"),
    commandListener: () => {
      void runAttachmentRecoverCommand();
    },
  });

  ztoolkit.Menu.register("menuTools", {
    tag: "menuitem",
    id: `zotero-menu-tools-${addon.data.config.addonRef}-scan`,
    label: getString("menu-tools-scan-recover"),
    commandListener: () => {
      void runScanAndRecoverCommand();
    },
  });
}

async function onMainWindowUnload(_win: Window): Promise<void> {
  ztoolkit.unregisterAll();
}

function onShutdown(): void {
  if (addon.data.notifierID) {
    Zotero.Notifier.unregisterObserver(addon.data.notifierID);
  }

  ztoolkit.unregisterAll();

  addon.data.alive = false;
  // @ts-expect-error - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  void extraData;

  if (!addon?.data.alive) {
    return;
  }

  if (event !== "add" || type !== "item" || !ids.length) {
    return;
  }

  const itemIDs = ids
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  if (!itemIDs.length) {
    return;
  }

  const items = await Zotero.Items.getAsync(itemIDs);
  const attachments = items.filter(
    (item) =>
      item?.isAttachment() && item.isPDFAttachment() && !!item.parentItemID,
  );

  if (!attachments.length) {
    return;
  }

  const newAttachments: Zotero.Item[] = [];

  for (const att of attachments) {
    const parentItem = await getRecoveryParentItem(att);
    if (!parentItem) {
      newAttachments.push(att);
      continue;
    }

    const payload = await readParentRecoverNotePayload(parentItem);
    if (!payload) {
      newAttachments.push(att);
      continue;
    }

    const filePath = await att.getFilePathAsync();
    if (!filePath) {
      continue;
    }

    try {
      const bytes = await IOUtils.read(filePath);
      const hash = `sha256:${await sha256Hex(bytes)}`;
      const already = payload.descriptors.some((d) => d.hash === hash);
      if (!already) {
        newAttachments.push(att);
      }
    } catch {
      newAttachments.push(att);
    }
  }

  if (!newAttachments.length) {
    return;
  }

  try {
    await createDescriptorsForSelectedItems(newAttachments);
  } catch (error) {
    ztoolkit.log("Failed to auto-create recovery descriptors", error);
  }
}

function registerNotifier() {
  if (addon.data.notifierID) {
    return;
  }

  addon.data.notifierID = Zotero.Notifier.registerObserver(
    {
      notify: async (
        event: string,
        type: string,
        ids: Array<string | number>,
        extraData: { [key: string]: any },
      ) => {
        if (!addon?.data.alive) {
          return;
        }

        await addon.hooks.onNotify(event, type, ids, extraData);
      },
    },
    ["item"],
  );
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
};