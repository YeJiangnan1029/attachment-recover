# attachment_recover

`attachment_recover` is a Zotero add-on that restores missing PDF attachments across devices while keeping the original parent item intact.

## Background

In restricted network environments, Zotero Connector can often save paper metadata and PDFs locally, but the attachment files may fail to upload to WebDAV or Zotero Storage. After syncing on another device, the item exists but the PDF is missing. Re-capturing the same paper often creates duplicate items.

This project uses Zotero's data sync layer to store a recovery descriptor in a plugin-managed note under the parent item. Once synced to another device, the add-on can detect missing attachments, download them again, verify integrity, and attach them back to the original item.

## Implemented In v1.1

### Descriptor Generation

- Generate recovery descriptors for PDF attachments in a unique plugin-managed note under the parent item
- Store hash, file size, filename, MIME type, PDF URL, page URL, DOI, arXiv ID, source site, and recovery state
- Normalize arXiv IDs, arXiv page URLs, and arXiv PDF URLs automatically

### Manual Backfill

- `Tools -> Generate Recovery Descriptors`
- Supports selected parent items, PDF attachments, and managed notes grouped by parent item
- Uses upsert behavior while preserving `createdAt`, `status`, `attemptCount`, and `lastError`

### Automatic Backfill

- Automatically creates descriptors for newly added PDF attachments through Zotero Notifier
- Skips duplicates when the same attachment hash already exists

### Scan And Recover

- `Tools -> Scan & Recover Missing Attachments`
- Scans the user library for items that have recovery descriptors but no local PDF file
- Shows a confirmation dialog before recovery starts
- Recovery flow: resolve download URL -> download temp file -> verify SHA-256 -> import as stored attachment -> rename file -> update descriptor status
- Current MVP source support focuses on arXiv

### Status Panel

- Shows recovery tasks for the current parent item in the item pane
- Displays filename, status, source, last updated time, and error message
- Uses four visual states: `Downloaded`, `Missing`, `Downloading`, `Recovery Failed`
- Uses a custom project SVG icon and highlighted state styles

### Chinese User-Facing UI

- Menus, confirmation dialogs, and panel texts are localized in Chinese for end users

## Installation

Download the `.xpi` package from the Releases page, then install it in Zotero through `Tools -> Plugins -> Install Add-on From File`.

## Usage

### Generate Recovery Descriptors

1. Select one or more items, PDF attachments, or managed notes in Zotero
2. Run `Tools -> Generate Recovery Descriptors`
3. The add-on generates or updates descriptors for PDFs under the resolved parent items
4. After sync, other devices can use the descriptors for recovery

### Scan And Recover Missing Attachments

1. Run `Tools -> Scan & Recover Missing Attachments`
2. The add-on scans the user library for missing attachment tasks
3. Confirm the dialog to start recovery and status updates

### View The Status Panel

1. Select an item, attachment, or managed note
2. Open the right-side `Attachment Recovery Status` panel
3. Review the recovery tasks for the current parent item

## Related Documents

- 简体中文 README: [README-zhCN.md](README-zhCN.md)
- Requirements and architecture: [../project_requirements.md](../project_requirements.md)
- Release Notes v1.1: [release-v1.1.md](release-v1.1.md)

## License

AGPL-3.0-or-later
