import type { CampusTemplate } from "./templates-data";

export interface TemplateDraftData {
  template: CampusTemplate;
  file?: File;
  generatedFileName: string;
  pageCount?: number;
  originalDownloadUrl?: string;
}

let pendingDraft: TemplateDraftData | null = null;

/**
 * Stores a template print draft in memory across routes,
 * with sessionStorage backup for metadata.
 */
export function setPendingTemplateDraft(draft: TemplateDraftData): void {
  pendingDraft = draft;
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(
        "sophy_selected_template_v1",
        JSON.stringify({
          template: draft.template,
          generatedFileName: draft.generatedFileName,
          pageCount: draft.pageCount || 1,
          originalDownloadUrl: draft.template.originalDownloadUrl || draft.originalDownloadUrl,
        }),
      );
    } catch {
      // ignore serialization errors
    }
  }
}

/**
 * Retrieves and clears the pending template print draft.
 */
export function getPendingTemplateDraft(): TemplateDraftData | null {
  if (pendingDraft) {
    const draft = pendingDraft;
    pendingDraft = null;
    return draft;
  }

  if (typeof window !== "undefined") {
    try {
      const saved = sessionStorage.getItem("sophy_selected_template_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        sessionStorage.removeItem("sophy_selected_template_v1");
        return {
          template: parsed.template,
          generatedFileName: parsed.generatedFileName,
          pageCount: parsed.pageCount || 1,
          originalDownloadUrl: parsed.originalDownloadUrl || parsed.template?.originalDownloadUrl,
        };
      }
    } catch {
      // ignore
    }
  }

  return null;
}
