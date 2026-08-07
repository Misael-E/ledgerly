import type { Transaction } from "./types";

export const uuid = () => crypto.randomUUID();

export const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

export const fmtPct = (n: number) => `${n.toFixed(1)}%`;

export const today = () => new Date().toISOString().slice(0, 10);

export const isoNow = () => new Date().toISOString();

export const fp = (tx: Pick<Transaction, "date" | "merchant" | "amount" | "account" | "bank">) =>
  `${tx.date}|${tx.merchant.trim().toLowerCase()}|${Number(tx.amount).toFixed(2)}|${(tx.account || "").trim().toLowerCase()}|${(tx.bank || "").trim().toLowerCase()}`;

export function periodRange(p: string): { start?: Date; end?: Date } {
  const n = new Date();
  const y = n.getFullYear();
  const m = n.getMonth();
  switch (p) {
    case "this-month": return { start: new Date(y, m, 1) };
    case "last-month": return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
    case "last-3-months": return { start: new Date(y, m - 2, 1) };
    case "last-6-months": return { start: new Date(y, m - 5, 1) };
    case "this-year": return { start: new Date(y, 0, 1) };
    default: return {};
  }
}

export function inPeriod(ds: string, p: string): boolean {
  if (p === "all-time") return true;
  const d = new Date(ds + "T00:00:00");
  const r = periodRange(p);
  if (r.start && d < r.start) return false;
  if (r.end && d > r.end) return false;
  return true;
}

export function normMerch(m: string): string {
  return m.toLowerCase().trim()
    .replace(/[^\w\s]/g, "")
    .replace(/#\d+$/, "")
    .replace(/\d{6,}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
