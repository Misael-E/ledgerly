export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  category: string;
  amount: number;
  type: "expense" | "income";
  account: string;
  bank: string;
  tags: string[];
  receipt: boolean;
  source: "manual" | "csv" | "google-drive";
  fingerprint: string;
  createdAt: string;
}

export interface TagItem {
  name: string;
  createdAt: string;
}

export interface Rule {
  id: string;
  whenText: string;
  thenText: string;
  enabled: boolean;
  createdAt: string;
}

export interface DocumentMeta {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  status: "queued" | "stored" | "review";
  source: "upload" | "csv-import" | "google-drive";
  createdAt: string;
}

export interface RecurringItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  cadence: string;
  nextDate: string;
  account?: string;
  bank?: string;
  active: boolean;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  dueDate?: string;
  note?: string;
}

export interface Budget {
  id: string;
  category: string;
  limit: number;
  percent?: number;
  active: boolean;
}

export interface ProcessedFile {
  fileId: string;
  fileName: string;
  processedAt: string;
}

export interface Settings {
  categories: string[];
  accounts: string[];
  banks: string[];
  goals: Goal[];
  budgets: Budget[];
  monthlyIncome?: number;
  subscriptions: RecurringItem[];
  recurring: RecurringItem[];
  dismissedPatterns: string[];
  assets: number;
  liabilities: number;
  netWorthConfigured: boolean;
  selectedPeriod: string;
  freshStart: boolean;
  driveFolderName: string | null;
  driveFolderUrl: string | null;
  lastDriveSync: string | null;
  processedDriveFiles: ProcessedFile[];
  driveResetAt: string | null;
}

export interface DetectedPattern {
  key: string;
  merchant: string;
  normalized: string;
  category: string;
  cadence: string;
  occurrences: number;
  confidence: string;
  avgAmount: number;
  monthly: number;
  nextDate: string;
  isSub: boolean;
  isBill: boolean;
  variation: number;
}

export interface ImportResult {
  inserted: number;
  dupes: number;
  skipped: number;
}

export interface ToastData {
  msg: string;
  type: "success" | "error";
}
