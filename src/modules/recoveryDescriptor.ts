import { version as pluginVersion } from "../../package.json";

export const ATTACHMENT_RECOVER_NOTE_TYPE = "attachment_recover";
export const ATTACHMENT_RECOVER_NOTE_VERSION = 1;

export type AttachmentRecoverStatus =
  | "pending"
  | "downloading"
  | "success"
  | "failed";

export interface AttachmentRecoverDescriptor {
  id: string;
  version: number;
  pdfURL?: string;
  pageURL?: string;
  doi?: string;
  arxivId?: string;
  sourceSite?: string;
  hash: string;
  filesize: number;
  filename: string;
  mimeType: string;
  createdAt: number;
  updatedAt: number;
  status: AttachmentRecoverStatus;
  attemptCount: number;
  lastError?: string;
  pluginVersion?: string;
  notes?: string;
}

export interface ParentRecoverNotePayload {
  type: typeof ATTACHMENT_RECOVER_NOTE_TYPE;
  version: typeof ATTACHMENT_RECOVER_NOTE_VERSION;
  descriptors: AttachmentRecoverDescriptor[];
}

export function createEmptyParentRecoverNotePayload(): ParentRecoverNotePayload {
  return {
    type: ATTACHMENT_RECOVER_NOTE_TYPE,
    version: ATTACHMENT_RECOVER_NOTE_VERSION,
    descriptors: [],
  };
}

export function isParentRecoverNotePayload(
  value: unknown,
): value is ParentRecoverNotePayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  return (
    payload.type === ATTACHMENT_RECOVER_NOTE_TYPE &&
    payload.version === ATTACHMENT_RECOVER_NOTE_VERSION &&
    Array.isArray(payload.descriptors)
  );
}

export async function createDescriptorForAttachment(
  attachment: Zotero.Item,
  parentItem: Zotero.Item,
): Promise<AttachmentRecoverDescriptor> {
  const filePath = await attachment.getFilePathAsync();
  if (!filePath) {
    throw new Error("Attachment file does not exist locally");
  }

  const bytes = await IOUtils.read(filePath);
  const hash = await sha256Hex(bytes);
  const rawPdfURL = attachment.getField("url") || undefined;
  const rawPageURL = parentItem.getField("url") || undefined;
  const doi = parentItem.getField("DOI") || undefined;
  const arxivId = extractArxivId(rawPdfURL, rawPageURL, parentItem);
  const pdfURL = normalizePdfURL(rawPdfURL, arxivId);
  const pageURL = normalizePageURL(rawPageURL, arxivId);
  const sourceSite = inferSourceSite(pdfURL, pageURL, arxivId);
  const now = Date.now();

  return {
    id: `sha256:${hash}`,
    version: ATTACHMENT_RECOVER_NOTE_VERSION,
    pdfURL,
    pageURL,
    doi,
    arxivId,
    sourceSite,
    hash: `sha256:${hash}`,
    filesize: bytes.byteLength,
    filename: attachment.attachmentFilename,
    mimeType: attachment.attachmentContentType || "application/pdf",
    createdAt: now,
    updatedAt: now,
    status: "pending",
    attemptCount: 0,
    pluginVersion,
  };
}

export function upsertDescriptor(
  payload: ParentRecoverNotePayload,
  descriptor: AttachmentRecoverDescriptor,
): ParentRecoverNotePayload {
  const existing = payload.descriptors.find((item) => item.id === descriptor.id);
  if (!existing) {
    return {
      ...payload,
      descriptors: [...payload.descriptors, descriptor],
    };
  }

  const nextDescriptor: AttachmentRecoverDescriptor = {
    ...existing,
    ...descriptor,
    createdAt: existing.createdAt,
    status: existing.status,
    attemptCount: existing.attemptCount,
    lastError: existing.lastError,
  };

  return {
    ...payload,
    descriptors: payload.descriptors.map((item) =>
      item.id === existing.id ? nextDescriptor : item,
    ),
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function extractArxivId(
  pdfURL: string | undefined,
  pageURL: string | undefined,
  parentItem: Zotero.Item,
): string | undefined {
  const candidates = [pageURL, pdfURL, parentItem.getExtraField("arXiv")].filter(
    Boolean,
  ) as string[];
  let fallbackId: string | undefined;

  for (const candidate of candidates) {
    const match = candidate.match(
      /(?:arxiv\.org\/(?:abs|pdf)\/|arXiv:)([^?#\s/]+?)(?:\.pdf)?$/i,
    );
    if (match?.[1]) {
      if (/v\d+$/i.test(match[1])) {
        return match[1];
      }

      fallbackId = fallbackId || match[1];
    }
  }

  return fallbackId;
}

function normalizePdfURL(
  pdfURL: string | undefined,
  arxivId: string | undefined,
): string | undefined {
  if (arxivId) {
    return `https://arxiv.org/pdf/${stripArxivPdfSuffix(arxivId)}.pdf`;
  }

  return normalizeURL(pdfURL);
}

function normalizePageURL(
  pageURL: string | undefined,
  arxivId: string | undefined,
): string | undefined {
  if (arxivId) {
    return `https://arxiv.org/abs/${stripArxivPdfSuffix(arxivId)}`;
  }

  return normalizeURL(pageURL);
}

function normalizeURL(url: string | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  try {
    const normalized = new URL(url);
    if (normalized.hostname === "arxiv.org") {
      normalized.protocol = "https:";
    }
    return normalized.toString();
  } catch {
    return url;
  }
}

function stripArxivPdfSuffix(arxivId: string): string {
  return arxivId.replace(/\.pdf$/i, "");
}

function inferSourceSite(
  pdfURL: string | undefined,
  pageURL: string | undefined,
  arxivId: string | undefined,
): string | undefined {
  if (arxivId) {
    return "arxiv";
  }

  const candidate = pdfURL || pageURL;
  if (!candidate) {
    return undefined;
  }

  try {
    return new URL(candidate).hostname;
  } catch {
    return undefined;
  }
}
