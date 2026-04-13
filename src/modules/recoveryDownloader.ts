import { AttachmentRecoverDescriptor } from "./recoveryDescriptor";

export interface ResolveDownloadURLReturn {
  url: string;
  referrer?: string;
}

export function resolveDownloadURL(
  descriptor: AttachmentRecoverDescriptor,
): ResolveDownloadURLReturn | null {
  if (descriptor.arxivId) {
    const id = descriptor.arxivId.replace(/\.pdf$/i, "");
    return {
      url: `https://arxiv.org/pdf/${id}.pdf`,
      referrer: `https://arxiv.org/abs/${id}`,
    };
  }

  if (descriptor.pdfURL) {
    let isArxivURL = false;
    try {
      const parsed = new URL(descriptor.pdfURL);
      isArxivURL = parsed.hostname === "arxiv.org";
    } catch {
      isArxivURL = false;
    }

    if (isArxivURL) {
      const match = descriptor.pdfURL.match(
        /arxiv\.org\/pdf\/([^?#/]+?)(?:\.pdf)?/i,
      );
      const id = match?.[1]?.replace(/\.pdf$/i, "");
      const referrer = id
        ? `https://arxiv.org/abs/${id}`
        : descriptor.pageURL;
      return {
        url: descriptor.pdfURL,
        referrer,
      };
    }

    return {
      url: descriptor.pdfURL,
      referrer: descriptor.pageURL,
    };
  }

  return null;
}

export async function downloadPDFToTemp(
  url: string,
  referrer?: string,
): Promise<string> {
  const xhr = await Zotero.HTTP.request("GET", url, {
    responseType: "arraybuffer",
    timeout: 30000,
  });

  const tempDir = Zotero.getTempDirectory().path;
  const tempPath = PathUtils.join(
    tempDir,
    `attachment_recover_${Date.now()}.pdf`,
  );

  await IOUtils.write(tempPath, new Uint8Array(xhr.response as ArrayBuffer));
  return tempPath;
}

export async function verifyDownloadedPDF(
  filePath: string,
  descriptor: AttachmentRecoverDescriptor,
): Promise<boolean> {
  const bytes = await IOUtils.read(filePath);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const computedHash = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const expectedHash = descriptor.hash.replace("sha256:", "");
  return computedHash === expectedHash;
}

export async function cleanupTempFile(filePath: string): Promise<void> {
  await IOUtils.remove(filePath, { ignoreAbsent: true });
}