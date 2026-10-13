import { Eye, ExternalLink, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  CATEGORY_LABELS,
  saveCampusTemplate,
  type CampusTemplate,
  type TemplateCategory,
} from "@/lib/templates-data";
import type { PrintJob } from "@/lib/print-data";

interface DocumentPreviewModalProps {
  job: PrintJob | null;
  isOpen: boolean;
  onClose: () => void;
  onPushedToGallery?: (template: CampusTemplate) => void;
}

export function DocumentPreviewModal({
  job,
  isOpen,
  onClose,
  onPushedToGallery,
}: DocumentPreviewModalProps) {
  const [showPushForm, setShowPushForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("project");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen || !job) return null;

  const initialTitle = title || job.file.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");

  const handleOpenPush = () => {
    setTitle(initialTitle);
    setDescription(`Standard campus print template derived from student submission #${job.id}`);
    setShowPushForm(true);
    setSavedSuccess(false);
  };

  const handleSaveToGallery = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    const templateId = `tpl-admin-${job.id}-${Date.now().toString().slice(-4)}`;
    const newTemplate: CampusTemplate = {
      id: templateId,
      title: title.trim() || initialTitle,
      category,
      categoryLabel: CATEGORY_LABELS[category],
      description: description.trim() || "Campus template ready for student customization",
      originalFileName: job.file,
      originalDownloadUrl: job.downloadUrl,
      sourceOrderId: job.id,
      createdAt: new Date().toISOString(),
      isPopular: true,
      defaultValues: {
        collegeName: "CAMPUS INSTITUTE OF SCIENCE & TECHNOLOGY",
        title: title.trim().toUpperCase() || "PROJECT REPORT FRONT PAGE",
        subtitle: "A Report submitted for Academic Assessment",
        department: "Department of Engineering & Technology",
        studentName: job.student || "Student Name",
        rollNumber: "REG-" + (job.pickupCode || "2026"),
        academicYear: "2025 - 2026",
        guideName: "Faculty Guide / Advisor",
        additionalNotes: "Verified college xerox template",
      },
    };

    await saveCampusTemplate(newTemplate);
    setSaving(false);
    setSavedSuccess(true);
    if (onPushedToGallery) {
      onPushedToGallery(newTemplate);
    }
    setTimeout(() => {
      setShowPushForm(false);
      setSavedSuccess(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[90vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Eye className="size-5" />
            </span>
            <div>
              <h3 className="font-display font-bold text-base text-foreground flex items-center gap-2">
                Document Preview
                <span className="rounded-full bg-secondary px-2 py-0.5 font-mono text-[11px] text-muted-foreground font-normal">
                  Order #{job.id}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground truncate max-w-md">{job.file}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showPushForm ? (
              <Button
                size="sm"
                onClick={handleOpenPush}
                className="gap-1.5 shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
              >
                <Sparkles className="size-3.5" />
                Push to Student Gallery
              </Button>
            ) : null}

            {job.downloadUrl ? (
              <Button asChild variant="outline" size="sm" className="gap-1.5 shadow-xs">
                <a href={job.downloadUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-3.5" />
                  Open Raw
                </a>
              </Button>
            ) : null}

            <button
              onClick={onClose}
              className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Close preview"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {showPushForm ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-sm text-foreground flex items-center gap-1.5">
                    <Sparkles className="size-4 text-emerald-500" />
                    Push Document to Student Template Gallery
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Students will be able to customize this template with their own name, roll
                    number, and title without formatting from scratch.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPushForm(false)}
                  className="text-xs text-muted-foreground"
                >
                  Cancel
                </Button>
              </div>

              {savedSuccess ? (
                <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-xs text-center">
                  ✓ Successfully published to Student Gallery! Students can now customize and print
                  this template.
                </div>
              ) : (
                <form onSubmit={handleSaveToGallery} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">
                        Template Title
                      </label>
                      <Input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Major Project Report Title Page"
                        required
                        className="h-9 text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-foreground">Category</label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value as TemplateCategory)}
                        className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs text-foreground shadow-xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        <option value="project">Project Front Page</option>
                        <option value="lab">Lab Record Cover</option>
                        <option value="assignment">Assignment Title Sheet</option>
                        <option value="letter">Bonafide / Letter</option>
                        <option value="other">General Format</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">
                      Description for Students
                    </label>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Standard format with faculty guide signature block"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPushForm(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={saving}
                      size="sm"
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1.5"
                    >
                      <Sparkles className="size-3.5" />
                      {saving ? "Publishing..." : "Confirm & Push to Gallery"}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          {/* In-Browser Document Viewer */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden min-h-[420px] flex flex-col items-center justify-center relative">
            {job.downloadUrl ? (
              <iframe
                src={job.downloadUrl}
                title={job.file}
                className="w-full h-[520px] border-0 rounded-lg bg-white"
              />
            ) : (
              <div className="p-8 text-center space-y-2">
                <span className="grid size-12 place-items-center rounded-xl bg-muted mx-auto text-muted-foreground">
                  <Eye className="size-6" />
                </span>
                <p className="font-semibold text-sm text-foreground">
                  File purged from cloud storage
                </p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  The binary file has been purged to reduce storage costs, but you can still create
                  a customizable template based on this order metadata!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
