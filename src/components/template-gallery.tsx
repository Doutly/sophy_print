import { BookOpen, Edit3, FileText, Filter, Plus, Search, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { DocumentEditorCanvas } from "./document-editor-canvas";
import {
  CATEGORY_LABELS,
  subscribeToCampusTemplates,
  type CampusTemplate,
  type TemplateCategory,
} from "@/lib/templates-data";

interface TemplateGalleryProps {
  onSelectTemplateForPrint: (customizedData: {
    template: CampusTemplate;
    file?: File;
    generatedFileName: string;
    pageCount?: number;
  }) => void;
  onSwitchToUpload?: () => void;
  className?: string;
}

export function TemplateGallery({
  onSelectTemplateForPrint,
  onSwitchToUpload,
  className = "",
}: TemplateGalleryProps) {
  const [templates, setTemplates] = useState<CampusTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customizerTemplate, setCustomizerTemplate] = useState<CampusTemplate | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const unsub = subscribeToCampusTemplates((list) => {
      setTemplates(list);
    });
    return () => unsub();
  }, []);

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      const matchesCat = selectedCategory === "all" || tpl.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        tpl.title.toLowerCase().includes(q) ||
        (tpl.description && tpl.description.toLowerCase().includes(q)) ||
        tpl.categoryLabel.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [templates, selectedCategory, searchQuery]);

  return (
    <section className={`space-y-6 ${className}`}>
      {/* Gallery Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <h2 className="font-display font-bold text-xl text-foreground">
              Campus Template Gallery
            </h2>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
              Verified Documents Only
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            Choose any document template published by the campus print desk. Click Customize to
            visually erase old names/dates and type your own details directly on the document!
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-8 h-9 text-xs"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-secondary text-muted-foreground hover:text-foreground"
          }`}
        >
          All Templates ({templates.length})
        </button>

        {Object.entries(CATEGORY_LABELS).map(([catKey, label]) => {
          const count = templates.filter((t) => t.category === catKey).length;
          return (
            <button
              key={catKey}
              type="button"
              onClick={() => setSelectedCategory(catKey)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all shrink-0 cursor-pointer ${
                selectedCategory === catKey
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} ({count})
            </button>
          );
        })}
      </div>

      {/* Template Cards Grid */}
      {filteredTemplates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <article
              key={template.id}
              className="group relative flex flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-xs hover:border-primary/40 hover:shadow-md transition-all duration-200"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    {template.categoryLabel}
                  </span>

                  {template.isPopular ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                      <Sparkles className="size-2.5" /> Curated
                    </span>
                  ) : null}
                </div>

                <h3 className="font-display font-bold text-sm text-foreground mt-3 group-hover:text-primary transition-colors">
                  {template.title}
                </h3>

                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                  {template.description || "Real campus document ready for editing and print."}
                </p>

                {/* Real Document Metadata Card */}
                <div className="mt-4 rounded-lg border border-border/80 bg-zinc-50 dark:bg-zinc-900/60 p-3 text-zinc-800 dark:text-zinc-200 shadow-2xs space-y-1.5">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-primary shrink-0" />
                    <span className="text-xs font-semibold truncate text-foreground">
                      {template.originalFileName || `${template.title}.pdf`}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                    <span>Vector Overlay Editable</span>
                    <span className="font-mono">PDF Standard</span>
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-border flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                  <FileText className="size-3" /> A4 Print Ready
                </span>

                <Button
                  size="sm"
                  onClick={() => setCustomizerTemplate(template)}
                  className="gap-1.5 text-xs shadow-xs font-semibold bg-primary text-primary-foreground group-hover:shadow-primary/20"
                >
                  <Edit3 className="size-3.5" />
                  Edit & Print
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        /* Empty State with Zero Mock Data */
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-4 bg-muted/20 max-w-xl mx-auto my-6">
          <div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary mx-auto">
            <BookOpen className="size-7" />
          </div>
          <div>
            <h3 className="font-display font-bold text-base text-foreground">
              No Templates in Campus Library Yet
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-md mx-auto leading-relaxed">
              All mock data has been removed. Templates appear here when the print shop admin pushes
              verified student submissions from Admin Storage, or you can upload your own PDF/Word
              document directly right now!
            </p>
          </div>

          {onSwitchToUpload && (
            <Button
              size="sm"
              onClick={onSwitchToUpload}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              <Upload className="size-3.5" />
              Upload & Edit My Document
            </Button>
          )}
        </div>
      )}

      {/* Live Direct Document Editor */}
      <DocumentEditorCanvas
        fileSource={customizerTemplate?.originalDownloadUrl || customizerTemplate?.fileData || null}
        initialFileName={customizerTemplate?.originalFileName || `${customizerTemplate?.title || "Template"}.pdf`}
        isOpen={Boolean(customizerTemplate)}
        onClose={() => setCustomizerTemplate(null)}
        onApply={(result) => {
          if (customizerTemplate) {
            onSelectTemplateForPrint({
              template: customizerTemplate,
              file: result.file,
              generatedFileName: result.fileName,
              pageCount: result.pageCount,
            });
          }
          setCustomizerTemplate(null);
        }}
      />
    </section>
  );
}
