import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export type TemplateCategory = "project" | "lab" | "assignment" | "letter" | "other";

export interface TemplateFields {
  title: string;
  subtitle?: string;
  studentName: string;
  rollNumber: string;
  department: string;
  collegeName: string;
  academicYear: string;
  guideName?: string;
  subjectCode?: string;
  additionalNotes?: string;
}

export interface CampusTemplate {
  id: string;
  title: string;
  category: TemplateCategory;
  categoryLabel: string;
  description: string;
  originalFileName?: string;
  originalDownloadUrl?: string;
  previewUrl?: string;
  fileData?: string;
  createdAt: string;
  sourceOrderId?: string;
  isPopular?: boolean;
  defaultValues?: Partial<TemplateFields>;
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  project: "Project Front Page",
  lab: "Lab Record Cover",
  assignment: "Assignment Title Sheet",
  letter: "Bonafide / Letter",
  other: "General Format",
};

// No mock data - only real student/admin templates
export const DEFAULT_CAMPUS_TEMPLATES: CampusTemplate[] = [];

const LOCAL_STORAGE_KEY = "sophy_campus_templates_v1";

const LEGACY_MOCK_IDS = new Set([
  "tpl-project-cover",
  "tpl-lab-record",
  "tpl-assignment-cover",
  "tpl-bonafide-letter",
]);

/**
 * Get templates from local storage fallback (purges old mock data)
 */
export function getLocalTemplates(): CampusTemplate[] {
  if (typeof window === "undefined") return DEFAULT_CAMPUS_TEMPLATES;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return DEFAULT_CAMPUS_TEMPLATES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CAMPUS_TEMPLATES;

    // Filter out legacy mock data
    const filtered = parsed.filter((t: CampusTemplate) => t && t.id && !LEGACY_MOCK_IDS.has(t.id));
    if (filtered.length !== parsed.length) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
    return filtered;
  } catch {
    return DEFAULT_CAMPUS_TEMPLATES;
  }
}

/**
 * Save templates to local storage fallback
 */
export function saveLocalTemplates(templates: CampusTemplate[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(templates));
  } catch {
    // ignore
  }
}

/**
 * Fetch all templates from Firestore with fallback to defaults
 */
export async function fetchCampusTemplates(): Promise<CampusTemplate[]> {
  try {
    const q = query(collection(db, "templates"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    if (snap.empty) {
      return getLocalTemplates();
    }
    const list: CampusTemplate[] = [];
    snap.forEach((d) => {
      list.push({ id: d.id, ...d.data() } as CampusTemplate);
    });
    return list;
  } catch (err) {
    console.warn("Could not fetch templates from Firestore, using local:", err);
    return getLocalTemplates();
  }
}

/**
 * Live subscribe to templates
 */
export function subscribeToCampusTemplates(
  callback: (templates: CampusTemplate[]) => void,
): () => void {
  try {
    const q = query(collection(db, "templates"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          callback(getLocalTemplates());
          return;
        }
        const list: CampusTemplate[] = [];
        snap.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as CampusTemplate);
        });
        callback(list);
      },
      (err) => {
        console.warn("Firestore templates subscription error:", err);
        callback(getLocalTemplates());
      },
    );
  } catch (err) {
    console.warn("Fallback subscription to local templates:", err);
    callback(getLocalTemplates());
    return () => {};
  }
}

/**
 * Push or update a template in Firestore and localStorage
 */
export async function saveCampusTemplate(template: CampusTemplate): Promise<void> {
  const local = getLocalTemplates();
  const existingIdx = local.findIndex((t) => t.id === template.id);
  let updatedLocal: CampusTemplate[];
  if (existingIdx >= 0) {
    updatedLocal = [...local];
    updatedLocal[existingIdx] = template;
  } else {
    updatedLocal = [template, ...local];
  }
  saveLocalTemplates(updatedLocal);

  try {
    await setDoc(doc(db, "templates", template.id), template, { merge: true });
  } catch (err) {
    console.warn("Could not save template to Firestore:", err);
  }
}

/**
 * Delete a template
 */
export async function deleteCampusTemplate(templateId: string): Promise<void> {
  const local = getLocalTemplates().filter((t) => t.id !== templateId);
  saveLocalTemplates(local);

  try {
    await deleteDoc(doc(db, "templates", templateId));
  } catch (err) {
    console.warn("Could not delete template from Firestore:", err);
  }
}
