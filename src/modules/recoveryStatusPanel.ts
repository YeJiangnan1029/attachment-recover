import { getString, getLocaleID } from "../utils/locale";
import { getRecoveryParentItem } from "./recoveryNote";
import { listParentRecoveryTasks } from "./recoveryTasks";

export function registerRecoveryStatusPanel() {
  if (addon.data.statusPanelRegistered) {
    return;
  }

  Zotero.ItemPaneManager.registerSection({
    paneID: "attachment-recover-status",
    pluginID: addon.data.config.addonID,
    header: {
      l10nID: getLocaleID("item-section-recovery-status-head-text"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/recovery-status.svg`,
    },
    sidenav: {
      l10nID: getLocaleID("item-section-recovery-status-sidenav-tooltip"),
      icon: `chrome://${addon.data.config.addonRef}/content/icons/recovery-status.svg`,
    },
    onItemChange: ({ item, setEnabled, tabType }) => {
      void tabType;

      const enabled = !!item && (item.isRegularItem() || !!item.parentItemID);
      setEnabled(enabled);
      return true;
    },
    onRender: ({ body, item, setSectionSummary }) => {
      const doc = body.ownerDocument as Document;

      body.classList.add("attachment-recover-status-panel");
      body.replaceChildren(
        buildMessageBlock(
          doc,
          item
            ? getString("status-panel-loading")
            : getString("status-panel-no-item"),
        ),
      );
      setSectionSummary(getString("status-panel-summary-loading"));
    },
    onAsyncRender: async ({ body, item, setSectionSummary }) => {
      const doc = body.ownerDocument as Document;

      body.classList.add("attachment-recover-status-panel");

      if (!item) {
        body.replaceChildren(buildMessageBlock(doc, getString("status-panel-no-item")));
        setSectionSummary(getString("status-panel-summary-empty"));
        return;
      }

      const parentItem = await getRecoveryParentItem(item);
      if (!parentItem) {
        body.replaceChildren(
          buildMessageBlock(
            doc,
            getString("status-panel-no-parent"),
          ),
        );
        setSectionSummary(getString("status-panel-summary-empty"));
        return;
      }

      const tasks = await listParentRecoveryTasks(parentItem);
      if (!tasks.length) {
        body.replaceChildren(
          buildMessageBlock(
            doc,
            getString("status-panel-no-descriptors"),
          ),
        );
        setSectionSummary(getString("status-panel-summary-empty"));
        return;
      }

      const pendingCount = tasks.filter(({ descriptor, hasLocalFile }) => {
        return !hasLocalFile && descriptor.status !== "downloading" && descriptor.status !== "failed";
      }).length;
      const downloadingCount = tasks.filter(
        ({ descriptor }) => descriptor.status === "downloading",
      ).length;
      const successCount = tasks.filter(({ hasLocalFile }) => hasLocalFile).length;
      const failedCount = tasks.filter(
        ({ descriptor, hasLocalFile }) => !hasLocalFile && descriptor.status === "failed",
      ).length;

      setSectionSummary(
        getString("status-panel-summary", {
          args: {
            total: tasks.length,
            pending: pendingCount,
            downloading: downloadingCount,
            success: successCount,
            failed: failedCount,
          },
        }),
      );

      body.replaceChildren(
        buildTaskList(doc, tasks),
      );
    },
  });

  addon.data.statusPanelRegistered = true;
}

function buildTaskList(
  doc: Document,
  tasks: Awaited<ReturnType<typeof listParentRecoveryTasks>>,
) {
  const container = doc.createElement("div");

  const header = doc.createElement("div");
  header.className = "attachment-recover-status-panel__header";

  const title = doc.createElement("div");
  title.className = "attachment-recover-status-panel__title";
  title.textContent = getString("status-panel-title");

  const description = doc.createElement("div");
  description.className = "attachment-recover-status-panel__description";
  description.textContent = getString("status-panel-task-count", {
    args: { count: tasks.length },
  });

  header.append(title, description);
  container.append(header);

  const list = doc.createElement("div");
  list.className = "attachment-recover-status-panel__list";

  tasks.forEach(({ descriptor, hasLocalFile }, index) => {
    const state = getDisplayState(descriptor.status, hasLocalFile);
    const item = doc.createElement("div");
    item.className = "attachment-recover-status-panel__item";

    const itemHeader = doc.createElement("div");
    itemHeader.className = "attachment-recover-status-panel__item-header";

    const itemTitle = doc.createElement("div");
    itemTitle.className = "attachment-recover-status-panel__item-title";
    itemTitle.textContent = `${index + 1}. ${descriptor.filename || descriptor.id}`;

    const itemState = doc.createElement("div");
    itemState.className = `attachment-recover-status-panel__state attachment-recover-status-panel__state--${state.kind}`;

    const itemStateIcon = doc.createElement("span");
    itemStateIcon.className = `attachment-recover-status-panel__state-icon attachment-recover-status-panel__state-icon--${state.kind}`;
    itemStateIcon.textContent = state.icon;

    const itemStateLabel = doc.createElement("span");
    itemStateLabel.className = "attachment-recover-status-panel__state-label";
    itemStateLabel.textContent = state.label;

    itemState.append(itemStateIcon, itemStateLabel);
    itemHeader.append(itemTitle, itemState);
    item.append(itemHeader);

    item.append(
      buildFieldRow(
        doc,
        getString("status-panel-field-source"),
        descriptor.sourceSite ||
          descriptor.arxivId ||
          descriptor.pdfURL ||
          getString("status-panel-not-available"),
      ),
      buildFieldRow(
        doc,
        getString("status-panel-field-updated-at"),
        descriptor.updatedAt
          ? new Date(descriptor.updatedAt).toLocaleString()
          : getString("status-panel-not-available"),
      ),
    );

    if (descriptor.lastError) {
      item.append(
        buildFieldRow(
          doc,
          getString("status-panel-field-error"),
          descriptor.lastError,
        ),
      );
    }

    list.append(item);
  });

  container.append(list);
  return container;
}

function buildMessageBlock(doc: Document, text: string) {
  const block = doc.createElement("div");
  block.className = "attachment-recover-status-panel__message";
  block.textContent = text;
  return block;
}

function buildFieldRow(doc: Document, label: string, value: string) {
  const row = doc.createElement("div");
  row.className = "attachment-recover-status-panel__row";

  const labelNode = doc.createElement("span");
  labelNode.className = "attachment-recover-status-panel__row-label";
  labelNode.textContent = `${label}:`;

  const valueNode = doc.createElement("span");
  valueNode.className = "attachment-recover-status-panel__row-value";
  valueNode.textContent = value;

  row.append(labelNode, valueNode);
  return row;
}

function getDisplayState(status: string, hasLocalFile: boolean) {
  if (hasLocalFile) {
    return {
      kind: "downloaded",
      icon: "●",
      label: getString("status-panel-status-downloaded"),
    };
  }

  switch (status) {
    case "downloading":
      return {
        kind: "downloading",
        icon: "◐",
        label: getString("status-panel-status-downloading"),
      };
    case "failed":
      return {
        kind: "failed",
        icon: "✕",
        label: getString("status-panel-status-failed"),
      };
    default:
      return {
        kind: "missing",
        icon: "○",
        label: getString("status-panel-status-missing"),
      };
  }
}
