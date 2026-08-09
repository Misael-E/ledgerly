import {
  LayoutDashboard, ArrowLeftRight, Repeat, CreditCard, Target, PiggyBank,
  FileText, Zap, Settings
} from "lucide-react";

export const LIGHT = {
  bg: "#F5F5F7", card: "#FFFFFF", cardBorder: "#EBECF0", cardShadow: "0 1px 3px rgba(0,0,0,0.04)",
  violet: "#6558D3", violetLight: "#8B80E0", violetBg: "#F0EEFA",
  green: "#22A06B", greenBg: "#E3FCEF", orange: "#E97F33", orangeBg: "#FFF4E5",
  blue: "#2684FF", blueBg: "#DEEBFF", red: "#DE350B", redBg: "#FFEBE6",
  navy: "#172B4D", text: "#172B4D", textSec: "#505F79", textTer: "#6B778C", textQuat: "#97A0AF",
  inputBg: "#FFFFFF", inputBorder: "#DFE1E6", rowAlt: "#FAFBFC",
  sidebarBg: "#FFFFFF", sidebarBorder: "#EBECF0", topbarBg: "#FFFFFF", topbarBorder: "#EBECF0",
  modalOverlay: "rgba(0,0,0,0.4)", tooltipBg: "#172B4D", tooltipText: "#FFFFFF",
  selectBg: "#FFFFFF"
};

export const DARK = {
  bg: "#0D1117", card: "#161B22", cardBorder: "#30363D", cardShadow: "0 1px 3px rgba(0,0,0,0.3)",
  violet: "#8B80E0", violetLight: "#A59AEA", violetBg: "#1E1A3A",
  green: "#3FB950", greenBg: "#0D2818", orange: "#D29922", orangeBg: "#2A1F0A",
  blue: "#58A6FF", blueBg: "#0C2D6B", red: "#F85149", redBg: "#3D1114",
  navy: "#C9D1D9", text: "#E6EDF3", textSec: "#B1BAC4", textTer: "#8B949E", textQuat: "#6E7681",
  inputBg: "#0D1117", inputBorder: "#30363D", rowAlt: "#1C2128",
  sidebarBg: "#0D1117", sidebarBorder: "#21262D", topbarBg: "#161B22", topbarBorder: "#21262D",
  modalOverlay: "rgba(0,0,0,0.7)", tooltipBg: "#30363D", tooltipText: "#E6EDF3",
  selectBg: "#0D1117"
};

export type ThemePalette = typeof LIGHT;

export const PIE_COLORS = [
  "#8B80E0", "#3FB950", "#D29922", "#58A6FF", "#F85149", "#E3B341",
  "#39D2C0", "#56D364", "#A371F7", "#F0883E", "#BC8CFF", "#7EE787"
];

export const PERIODS = [
  { value: "all-time", label: "All time" },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "last-3-months", label: "Last 3 months" },
  { value: "last-6-months", label: "Last 6 months" },
  { value: "this-year", label: "This year" },
];

export const DEFAULT_CATEGORIES = [
  "Housing", "Groceries", "Shopping", "Dining", "Transportation",
  "Utilities", "Subscriptions", "Insurance", "Health", "Entertainment",
  "Transfer", "Income", "Needs review", "Other"
];

export const DEFAULT_ACCOUNTS = ["Main Checking", "Everyday Visa", "Rewards Card", "Cash"];
export const DEFAULT_BANKS = ["Bank 1", "Bank 2", "Credit Union"];

export const TABS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
  { id: "recurring", label: "Recurring", icon: Repeat },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
  { id: "budgets", label: "Budgets", icon: Target },
  { id: "goals", label: "Goals", icon: PiggyBank },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "rules", label: "Rules", icon: Zap },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

export const SUB_HINTS = [
  "netflix", "spotify", "hulu", "disney", "youtube", "icloud", "dropbox",
  "adobe", "microsoft", "amazon prime", "patreon", "membership", "studio",
  "gym", "openai", "chatgpt", "canva", "notion", "zoom", "slack", "github"
];

export const BILL_HINTS = [
  "mortgage", "rent", "loan", "insurance", "utility", "utilities",
  "electric", "water", "internet", "phone", "mobile", "daycare",
  "tuition", "lease", "car payment", "auto payment", "hoa", "property tax"
];
