import { DocumentEditorCanvas } from "./document-editor-canvas";
import type { CampusTemplate } from "@/lib/templates-data";

interface TemplateCustomizerModalProps {
  template: CampusTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onUseForPrint: (customizedData: {
    template: CampusTemplate;
    file?: File;
    generatedFileName: string;
    pageCount?: number;
  }) => void;
}

export function TemplateCustomizerModal({
  template,
  isOpen,
  onClose,
  onUseForPrint,
}: TemplateCustomizerModalProps) {
  if (!isOpen || !template) return null;

  return (
    <DocumentEditorCanvas
      fileSource={template.originalDownloadUrl || template.fileData || null}
      initialFileName={template.originalFileName || `${template.title}.pdf`}
      isOpen={isOpen}
      onClose={onClose}
      onApply={({ file, fileName, pageCount }) => {
        onUseForPrint({
          template,
          file,
          generatedFileName: fileName,
          pageCount,
        });
      }}
    />
  );
}
