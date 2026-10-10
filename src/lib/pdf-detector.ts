/**
 * High-performance, client-side PDF page counter.
 * Inspects PDF dictionaries and object trees directly from the ArrayBuffer
 * without requiring heavy external dependencies.
 */

async function getArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  if (typeof (file as Blob).arrayBuffer === "function") {
    try {
      return await (file as Blob).arrayBuffer();
    } catch {
      // Fallback to FileReader
    }
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader did not produce an ArrayBuffer"));
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export async function detectPdfPageCount(file: File | Blob): Promise<number> {
  try {
    const arrayBuffer = await getArrayBuffer(file);
    const bytes = new Uint8Array(arrayBuffer);
    const text = new TextDecoder("latin1").decode(bytes);

    // 1. Try finding /Type /Pages ... /Count N in the document catalog
    const pagesCountRegex = /\/Type\s*\/Pages[^>]*\/Count\s+(\d+)/g;
    let match: RegExpExecArray | null;
    let maxPagesCount = 0;

    while ((match = pagesCountRegex.exec(text)) !== null) {
      if (match[1]) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > maxPagesCount) {
          maxPagesCount = count;
        }
      }
    }

    if (maxPagesCount > 0) {
      return maxPagesCount;
    }

    // 2. Secondary check: /Count N anywhere near /Pages
    const simpleCountRegex = /\/Count\s+(\d+)/g;
    let candidateCount = 0;
    while ((match = simpleCountRegex.exec(text)) !== null) {
      if (match[1]) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > candidateCount) {
          candidateCount = count;
        }
      }
    }

    if (candidateCount > 0 && candidateCount < 10000) {
      return candidateCount;
    }

    // 3. Fallback: Count all /Type /Page (making sure not to match /Type /Pages)
    const pageMatches = text.match(/\/Type\s*\/Page\b/g);
    if (pageMatches && pageMatches.length > 0) {
      return pageMatches.length;
    }

    return 1;
  } catch (error) {
    console.warn("Failed to detect PDF page count from binary; defaulting to 1", error);
    return 1;
  }
}
