import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { deleteObject, ref } from "firebase/storage";
import { db, storage } from "./firebase";

export type JobStatus = "Pending" | "Waiting" | "Printing" | "Ready" | "Completed" | "Failed" | "Paused" | "Purged";

export type PrintJob = {
  id: string;
  file: string;
  type: "B&W" | "Colour";
  pages: number;
  pageRange?: string | undefined;
  totalPagesInDoc?: number | undefined;
  copies: number;
  amount: number;
  status: JobStatus;
  student: string;
  phone?: string | undefined;
  placed: string;
  createdAt?: string | undefined;
  pickupCode: string;
  sides?: ("single" | "double") | undefined;
  paper?: ("A4" | "A3") | undefined;
  printer?: string | undefined;
  downloadUrl?: string | undefined;
  storagePath?: string | undefined;
  fileSize?: number | undefined;
  isPurged?: boolean | undefined;
  purgedAt?: string | undefined;
};

export type PricingConfig = {
  bwSingle: number;
  bwDouble: number;
  colourSingle: number;
  colourDouble: number;
  a3Multiplier: number;
  platformFee: number;
};

export const defaultPricingConfig: PricingConfig = {
  bwSingle: 1.0,
  bwDouble: 1.5,
  colourSingle: 5.0,
  colourDouble: 8.0,
  a3Multiplier: 2.0,
  platformFee: 0.0,
};

const PRICING_STORAGE_KEY = "sophy_print_pricing_v1";

export function getPricingConfig(): PricingConfig {
  if (typeof window === "undefined") return defaultPricingConfig;
  try {
    const raw = localStorage.getItem(PRICING_STORAGE_KEY);
    if (raw) return { ...defaultPricingConfig, ...JSON.parse(raw) };
  } catch (err) {
    console.warn("Failed to read pricing from localStorage", err);
  }
  return defaultPricingConfig;
}

export function savePricingConfig(config: PricingConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(config));
    // Sync to Firestore (primary source of truth for pricing)
    setDoc(doc(db, "pricing", "current"), config).catch((err) => {
      console.warn("Failed to sync pricing to Firestore:", err);
    });
  } catch (err) {
    console.warn("Failed to save pricing config", err);
  }
}

/**
 * Async pricing loader — fetches from Firestore first, falls back to localStorage cache.
 * Call this on app mount instead of the synchronous getPricingConfig().
 */
export async function loadPricingConfig(): Promise<PricingConfig> {
  try {
    const snap = await getDoc(doc(db, "pricing", "current"));
    if (snap.exists()) {
      const data = { ...defaultPricingConfig, ...(snap.data() as Partial<PricingConfig>) };
      // Keep localStorage in sync as a warm cache for offline
      if (typeof window !== "undefined") {
        localStorage.setItem(PRICING_STORAGE_KEY, JSON.stringify(data));
      }
      return data;
    }
  } catch (err) {
    console.info("Firestore pricing fetch failed, using local cache:", err);
  }
  return getPricingConfig();
}

// Pure zero mock data: initial state is empty
export const initialPrintJobs: PrintJob[] = [];
export let printJobs: PrintJob[] = [];

export function getStoredPrintJobs(): PrintJob[] {
  // In-memory session cache only — Firestore is the source of truth for orders
  return printJobs;
}

export function saveStoredPrintJobs(jobs: PrintJob[]): void {
  // Update in-memory cache only — no localStorage persistence for orders
  printJobs = jobs;
}

/**
 * Real-time subscription to Firestore orders collection.
 * Keeps UI components 100% synchronized with live cloud orders.
 */
export function subscribeToOrders(callback: (jobs: PrintJob[]) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  try {
    const ordersCol = collection(db, "orders");
    const unsubscribe = onSnapshot(
      ordersCol,
      (snapshot) => {
        const liveJobs: PrintJob[] = [];
        snapshot.forEach((docSnap) => {
          liveJobs.push(docSnap.data() as PrintJob);
        });

        // Sort descending by timestamp or placed
        liveJobs.sort((a, b) => {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        });

        saveStoredPrintJobs(liveJobs);
        callback(liveJobs);
      },
      (err) => {
        console.info("Firestore live subscription fallback to local cache:", err);
        callback(getStoredPrintJobs());
      }
    );
    return unsubscribe;
  } catch (err) {
    console.warn("Could not attach Firestore listener:", err);
    callback(getStoredPrintJobs());
    return () => {};
  }
}

/**
 * Direct fetch of all orders from Firestore
 */
export async function fetchFirestoreOrders(): Promise<PrintJob[]> {
  try {
    const ordersCol = collection(db, "orders");
    const snapshot = await getDocs(ordersCol);
    const liveJobs: PrintJob[] = [];
    snapshot.forEach((docSnap) => {
      liveJobs.push(docSnap.data() as PrintJob);
    });

    liveJobs.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    saveStoredPrintJobs(liveJobs);
    return liveJobs;
  } catch (err) {
    console.warn("Failed fetching from Firestore:", err);
    return getStoredPrintJobs();
  }
}

export async function createPrintOrder(order: Omit<PrintJob, "id" | "placed"> & { id?: string }): Promise<PrintJob> {
  // Use a timestamp-based ID that is unique across devices
  const id = order.id || `P${Date.now().toString(36).toUpperCase()}`;
  const now = new Date();
  const isoStr = now.toISOString();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const newJob: PrintJob = {
    ...order,
    id,
    placed: timeStr,
    createdAt: isoStr,
    pickupCode: order.pickupCode || Math.floor(1000 + Math.random() * 9000).toString(),
  };

  // Strip any undefined keys so Firestore setDoc never throws Unsupported field value: undefined
  const firestoreData = Object.fromEntries(
    Object.entries(newJob).filter(([_, v]) => v !== undefined)
  );

  // Firestore is the primary source of truth — write here first
  await setDoc(doc(db, "orders", id), firestoreData);

  // Update in-memory session cache so admin UI reflects the change immediately
  printJobs = [newJob, ...printJobs];

  return newJob;
}

export async function updateJobStatus(id: string, status: JobStatus): Promise<void> {
  const currentJobs = getStoredPrintJobs();
  const updated = currentJobs.map((j) => (j.id === id ? { ...j, status } : j));
  saveStoredPrintJobs(updated);

  try {
    await updateDoc(doc(db, "orders", id), { status });
  } catch {
    // offline fallback
  }
}

/**
 * Purge physical file from Firebase Storage to zero out storage costs,
 * but preserve the accounting and revenue order record in Firestore.
 */
export async function purgeFileFromStorage(jobId: string, storagePath?: string): Promise<void> {
  if (storagePath) {
    try {
      const storageReference = ref(storage, storagePath);
      await deleteObject(storageReference);
    } catch (err: any) {
      // If object doesn't exist (already deleted or failed upload), proceed with purging metadata
      if (err?.code !== "storage/object-not-found") {
        console.warn("Storage object deletion issue:", err);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const updates = {
    isPurged: true,
    storagePath: deleteField(),
    downloadUrl: deleteField(),
    status: "Purged" as JobStatus,
    purgedAt: nowIso,
  };

  try {
    await updateDoc(doc(db, "orders", jobId), updates);
  } catch (err) {
    console.error("Could not update Firestore document for purge:", err);
    throw err;
  }

  const currentJobs = getStoredPrintJobs();
  const updated = currentJobs.map((j) =>
    j.id === jobId
      ? {
          ...j,
          isPurged: true,
          storagePath: undefined,
          downloadUrl: undefined,
          status: "Purged" as JobStatus,
          purgedAt: nowIso,
        }
      : j
  );
  saveStoredPrintJobs(updated);
}

/**
 * Bulk purge files uploaded within a specified date range [start, end].
 */
export async function purgeFilesByDateRange(
  startDateStr: string,
  endDateStr: string
): Promise<{ purgedCount: number; errors: string[] }> {
  const startTime = new Date(startDateStr).setHours(0, 0, 0, 0);
  const endTime = new Date(endDateStr).setHours(23, 59, 59, 999);

  const allJobs = await fetchFirestoreOrders();
  const targetJobs = allJobs.filter((job) => {
    if (!job.storagePath && !job.downloadUrl) return false;
    if (job.isPurged) return false;
    const jobTime = job.createdAt ? new Date(job.createdAt).getTime() : 0;
    return jobTime >= startTime && jobTime <= endTime;
  });

  let purgedCount = 0;
  const errors: string[] = [];

  for (const job of targetJobs) {
    try {
      await purgeFileFromStorage(job.id, job.storagePath);
      purgedCount++;
    } catch (err: any) {
      errors.push(`Order #${job.id}: ${err.message || "Failed to purge"}`);
    }
  }

  return { purgedCount, errors };
}

/**
 * Completely delete order document from Firestore and physical file from Storage
 */
export async function deleteOrderCompletely(jobId: string, storagePath?: string): Promise<void> {
  if (storagePath) {
    try {
      const storageReference = ref(storage, storagePath);
      await deleteObject(storageReference);
    } catch (err: any) {
      if (err?.code !== "storage/object-not-found") {
        console.warn("Storage object already deleted or not found:", err);
      }
    }
  }

  try {
    await deleteDoc(doc(db, "orders", jobId));
  } catch (err) {
    console.error("Could not delete Firestore document:", err);
    throw err;
  }

  const currentJobs = getStoredPrintJobs();
  const updated = currentJobs.filter((j) => j.id !== jobId);
  saveStoredPrintJobs(updated);
}

export async function fetchOrderById(id: string): Promise<PrintJob | undefined> {
  const cleanId = id.replace("#", "").trim().toUpperCase();

  // Firestore is the source of truth — no localStorage fallback for cross-device correctness
  const snap = await getDoc(doc(db, "orders", cleanId));
  if (snap.exists()) {
    return snap.data() as PrintJob;
  }
  return undefined;
}

/**
 * Real-time listener for a single order, allowing live timeline updates on student mobile devices
 */
export function subscribeToOrderById(
  id: string,
  callback: (job: PrintJob | null) => void
): () => void {
  const cleanId = id.replace("#", "").trim().toUpperCase();
  if (!cleanId) {
    callback(null);
    return () => {};
  }
  try {
    const unsub = onSnapshot(
      doc(db, "orders", cleanId),
      (snap) => {
        if (snap.exists()) {
          callback(snap.data() as PrintJob);
        } else {
          callback(null);
        }
      },
      (err) => {
        console.warn("Could not subscribe to order:", err);
        callback(null);
      }
    );
    return unsub;
  } catch (err) {
    console.warn("Error setting up order subscription:", err);
    callback(null);
    return () => {};
  }
}

/**
 * Parses user-entered page numbers like "1-5, 8, 11-14", "odd", "even", or "all"
 */
export function parsePageRange(rangeStr: string, totalPages: number): {
  isValid: boolean;
  selectedPages: number[];
  count: number;
  displayText: string;
  error?: string;
} {
  const trimmed = rangeStr.trim().toLowerCase();
  if (!trimmed || trimmed === "all") {
    const all = Array.from({ length: totalPages }, (_, i) => i + 1);
    return { isValid: true, selectedPages: all, count: totalPages, displayText: `All pages (1–${totalPages})` };
  }

  if (trimmed === "odd") {
    const odd = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
    return { isValid: true, selectedPages: odd, count: odd.length, displayText: `Odd pages only (${odd.length} pages)` };
  }

  if (trimmed === "even") {
    const even = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    return { isValid: true, selectedPages: even, count: even.length, displayText: `Even pages only (${even.length} pages)` };
  }

  const parts = trimmed.split(/[,;\s]+/).filter(Boolean);
  const set = new Set<number>();

  for (const part of parts) {
    if (part.includes("-")) {
      const rangeParts = part.split("-");
      const startStr = rangeParts[0] ?? "";
      const endStr = rangeParts[1] ?? "";
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
        return { isValid: false, selectedPages: [], count: 0, displayText: "", error: `Invalid range: "${part}"` };
      }
      for (let p = start; p <= Math.min(end, totalPages); p++) {
        set.add(p);
      }
    } else {
      const single = parseInt(part, 10);
      if (isNaN(single) || single < 1 || single > totalPages) {
        return { isValid: false, selectedPages: [], count: 0, displayText: "", error: `Page ${part} exceeds document (1–${totalPages})` };
      }
      set.add(single);
    }
  }

  const sorted = Array.from(set).sort((a, b) => a - b);
  if (sorted.length === 0) {
    return { isValid: false, selectedPages: [], count: 0, displayText: "", error: "No valid pages specified" };
  }

  return {
    isValid: true,
    selectedPages: sorted,
    count: sorted.length,
    displayText: `${sorted.length} pages selected (${rangeStr})`,
  };
}

export function calculateJobPrice(
  pages: number,
  copies: number,
  mode: "bw" | "colour",
  sides: "single" | "double",
  paper: "A4" | "A3",
  config?: PricingConfig
): { total: number; subtotal: number; platformFee: number; sheets: number; unitRate: number } {
  const cfg = config || getPricingConfig();
  const sheets = sides === "double" ? Math.ceil(pages / 2) : pages;

  let unitRate = 1.0;
  if (mode === "colour") {
    unitRate = sides === "double" ? cfg.colourDouble : cfg.colourSingle;
  } else {
    unitRate = sides === "double" ? cfg.bwDouble : cfg.bwSingle;
  }

  const paperFactor = paper === "A3" ? cfg.a3Multiplier : 1.0;
  const subtotal = Math.round(sheets * unitRate * copies * paperFactor * 100) / 100;
  const platformFee = cfg.platformFee;
  const total = subtotal + platformFee;

  return { total, subtotal, platformFee, sheets, unitRate };
}

export const defaultPrinters = [
  {
    name: "Canon imageRUNNER ADVANCE 4545i III (Unit 1)",
    role: "High-volume Black & White Xerox (LAN Connected)",
    type: "bw" as const,
    driver: "Canon Generic Plus UFR II / PCL6 Driver (LAN)",
    connection: "LAN (Gigabit Ethernet)",
    speed: "45 PPM",
    model: "imageRUNNER ADVANCE 4545i III",
  },
  {
    name: "Canon imageRUNNER ADVANCE 4545i III (Unit 2)",
    role: "High-volume Black & White Xerox (LAN Connected)",
    type: "bw" as const,
    driver: "Canon Generic Plus UFR II / PCL6 Driver (LAN)",
    connection: "LAN (Gigabit Ethernet)",
    speed: "45 PPM",
    model: "imageRUNNER ADVANCE 4545i III",
  },
  {
    name: "Epson L5290",
    role: "High-precision Colour",
    type: "colour" as const,
    driver: "Epson ESC/P-R Driver (Windows Spooler)",
    connection: "USB / LAN",
    speed: "10 PPM Colour",
    model: "EcoTank L5290",
  },
];

export const machines = defaultPrinters;

export const navItems = [
  { label: "Overview", to: "/admin" as const },
  { label: "Live queue", to: "/admin/queue" as const },
  { label: "Storage", to: "/admin/storage" as const },
  { label: "Machines", to: "/admin/machines" as const },
  { label: "Orders", to: "/admin/orders" as const },
  { label: "Pricing", to: "/admin/pricing" as const },
  { label: "Revenue", to: "/admin/revenue" as const },
];

export const PRINTABLE_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".ppt"] as const;
export const NON_PRINTABLE_EXTENSIONS = [
  ".mp3", ".mp4", ".wav", ".m4a", ".aac", ".flac", ".ogg",
  ".avi", ".mkv", ".mov", ".webm", ".wmv", ".exe", ".zip",
  ".rar", ".apk", ".iso"
] as const;

export function validatePrintableFile(
  fileName: string,
  mimeType?: string
): { isValid: boolean; error?: string } {
  const lower = fileName.toLowerCase().trim();
  const isMedia =
    NON_PRINTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    (mimeType ? mimeType.startsWith("audio/") || mimeType.startsWith("video/") : false);

  if (isMedia) {
    return {
      isValid: false,
      error: `Cannot upload "${fileName}". Audio and video media files (such as MP3 and MP4) cannot be printed. Please upload a printable document (PDF, Word DOCX, or PowerPoint PPTX).`,
    };
  }

  const isPrintable =
    PRINTABLE_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
    mimeType === "application/pdf";

  if (!isPrintable) {
    return {
      isValid: false,
      error: `Cannot upload "${fileName}". Unsupported file format. Please upload a printable document (PDF, Word DOCX, or PowerPoint PPTX).`,
    };
  }

  return { isValid: true };
}