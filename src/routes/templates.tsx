import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Printer, Sparkles } from "lucide-react";
import { TemplateGallery } from "@/components/template-gallery";
import type { CampusTemplate, TemplateFields } from "@/lib/templates-data";

import { setPendingTemplateDraft } from "@/lib/template-draft-store";

export const Route = createFileRoute("/templates")({
  head: () => ({
    meta: [
      { title: "Campus Template Gallery — Sophy Print" },
      {
        name: "description",
        content:
          "Browse and customize university project cover pages, lab record sheets, and assignments before printing.",
      },
      { property: "og:title", content: "Campus Template Gallery — Sophy Print" },
      {
        property: "og:description",
        content:
          "Browse and customize university project cover pages, lab record sheets, and assignments before printing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TemplatesPage,
});

function TemplatesPage() {
  const navigate = useNavigate();

  const handleSelectTemplate = (data: {
    template: CampusTemplate;
    file?: File;
    generatedFileName: string;
    pageCount?: number;
  }) => {
    // Preserve full File object and metadata in memory and session
    setPendingTemplateDraft({
      template: data.template,
      file: data.file,
      generatedFileName: data.generatedFileName,
      pageCount: data.pageCount || 1,
      originalDownloadUrl: data.template.originalDownloadUrl,
    });
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight hover:opacity-85 transition-opacity"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Printer className="size-5" />
            </span>
            <span>
              Sophy <span className="text-primary font-bold">Print</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border"
            >
              <ChevronLeft className="size-3.5" />
              Back to Upload
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <TemplateGallery onSelectTemplateForPrint={handleSelectTemplate} />
      </main>
    </div>
  );
}
