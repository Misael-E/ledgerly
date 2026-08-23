"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { Plus, Upload, Sun, Moon, LogOut } from "lucide-react";
import { ThemeCtx } from "./ThemeProvider";
import { Btn } from "./ui";
import { useAuth } from "./AuthProvider";
import LoginScreen from "./LoginScreen";
import AddEntryModal from "./modals/AddEntryModal";
import ImportModal from "./modals/ImportModal";
import DashboardPage from "./pages/DashboardPage";
import TransactionsPage from "./pages/TransactionsPage";
import RecurringPage from "./pages/RecurringPage";
import SubscriptionsPage from "./pages/SubscriptionsPage";
import BudgetsPage from "./pages/BudgetsPage";
import GoalsPage from "./pages/GoalsPage";
import DocumentsPage from "./pages/DocumentsPage";
import RulesPage from "./pages/RulesPage";
import SettingsPage from "./pages/SettingsPage";
import { LIGHT, DARK, TABS, SUB_HINTS, BILL_HINTS, DEFAULT_RULES } from "@/app/lib/constants";
import { loadK, saveK, defSettings } from "@/app/lib/storage";
import { uuid, fp, isoNow, normMerch, inPeriod } from "@/app/lib/helpers";
import * as db from "@/app/lib/db";
import type { Transaction, TagItem, Rule, DocumentMeta, Settings, DetectedPattern, ImportResult, ToastData } from "@/app/lib/types";

export default function Ledgerly() {
  const { user, loading: authLoading, signOut } = useAuth();

  const [tab, setTab] = useState("dashboard");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [tags, setTags] = useState<TagItem[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [settings, setSettings] = useState<Settings>(defSettings());
  const [addModal, setAddModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [dark, setDark] = useState(() => loadK("ledgerly:darkmode", true));
  const [dataLoaded, setDataLoaded] = useState(false);
  const t = dark ? DARK : LIGHT;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [txs, tgs, rls, docs, sett] = await Promise.all([
          db.fetchTransactions(),
          db.fetchTags(),
          db.fetchRules(),
          db.fetchDocuments(),
          db.fetchSettings(),
        ]);
        if (cancelled) return;
        setTransactions(txs);
        setTags(tgs);
        setDocuments(docs);
        setSettings(sett);

        // Seed default rules for new users who have none
        if (rls.length === 0) {
          const seeded: Rule[] = DEFAULT_RULES.map((r) => ({
            id: uuid(),
            whenText: r.whenText,
            thenText: r.thenText,
            enabled: true,
            createdAt: isoNow(),
          }));
          setRules(seeded);
          db.saveRules(seeded).catch(console.error);
        } else {
          setRules(rls);
        }
      } catch (err) {
        console.error("Failed to load data:", err);
      }
      setDataLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  const showToast = useCallback((msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3000);
  }, []);

  const toggleDark = useCallback(() => {
    const nd = !dark; setDark(nd); saveK("ledgerly:darkmode", nd);
  }, [dark]);

  const saveTx = useCallback(async (newTxs: Transaction[]) => {
    const prev = transactions;
    setTransactions(newTxs);
    try {
      const deleted = prev.filter((p) => !newTxs.some((n) => n.id === p.id));
      for (const d of deleted) await db.deleteTransaction(d.id);
      const changed = newTxs.filter((n) => {
        const old = prev.find((p) => p.id === n.id);
        return old && JSON.stringify(old) !== JSON.stringify(n);
      });
      if (changed.length > 0) await db.upsertTransactions(changed);
    } catch (e) {
      console.error("Failed to sync transactions:", e);
    }
  }, [transactions]);
  const saveTags = useCallback(async (tg: TagItem[]) => {
    setTags(tg);
    try { await db.saveTags(tg); } catch (e) { console.error(e); }
  }, []);
  const saveRules = useCallback(async (rl: Rule[]) => {
    setRules(rl);
    try { await db.saveRules(rl); } catch (e) { console.error(e); }
  }, []);
  const saveDocs = useCallback(async (d: DocumentMeta[]) => {
    setDocuments(d);
    try { await db.saveDocuments(d); } catch (e) { console.error(e); }
  }, []);
  const saveSettings = useCallback(async (s: Settings) => {
    setSettings(s);
    try { await db.saveSettings(s); } catch (e) { console.error(e); }
  }, []);

  const period = settings.selectedPeriod || "all-time";
  const setPeriod = useCallback(async (p: string) => {
    const ns = { ...settings, selectedPeriod: p };
    setSettings(ns);
    try { await db.saveSettings(ns); } catch { showToast("Failed to save period", "error"); }
  }, [settings, showToast]);

  const filteredByPeriod = useMemo(() => transactions.filter((tx) => inPeriod(tx.date, period)), [transactions, period]);
  const income = useMemo(() => filteredByPeriod.filter((tx) => tx.type === "income" && tx.category !== "Transfer").reduce((s, tx) => s + tx.amount, 0), [filteredByPeriod]);
  const spending = useMemo(() => filteredByPeriod.filter((tx) => tx.type === "expense" && tx.category !== "Transfer").reduce((s, tx) => s + tx.amount, 0), [filteredByPeriod]);
  const savingsRate = income > 0 ? ((income - spending) / income) * 100 : 0;

  const addTransaction = useCallback(async (tx: Partial<Transaction>): Promise<boolean> => {
    const f = fp(tx as Transaction);
    if (transactions.some((x) => x.fingerprint === f)) { showToast("Duplicate transaction", "error"); return false; }
    const entry: Transaction = {
      ...tx, id: uuid(), fingerprint: f, createdAt: isoNow(),
      tags: tx.tags || [], receipt: tx.receipt || false, source: tx.source || "manual",
    } as Transaction;
    for (const r of rules) {
      if (!r.enabled) continue;
      if (normMerch(entry.merchant).includes(normMerch(r.whenText))) entry.category = r.thenText;
    }
    try {
      const saved = await db.insertTransaction(entry);
      setTransactions((prev) => [saved, ...prev]);
      showToast("Transaction added");
      return true;
    } catch (e) {
      console.error(e);
      showToast("Failed to save transaction", "error");
      return false;
    }
  }, [transactions, rules, showToast]);

  const importCSV = useCallback(async (rows: Record<string, unknown>[], bank: string): Promise<ImportResult> => {
    let ins = 0, dup = 0, skip = 0;
    const toInsert: Transaction[] = [];
    for (const row of rows) {
      const r = row as { merchant?: string; date?: string; amount?: number; type?: string; category?: string; account?: string; bank?: string };
      if (!r.merchant || !r.date || isNaN(r.amount!) || r.amount! <= 0) { skip++; continue; }
      const entry: Transaction = {
        id: uuid(), date: r.date, merchant: r.merchant, category: r.category || "Needs review",
        amount: Math.abs(r.amount!), type: (r.type as "expense" | "income") || "expense",
        account: r.account || "Imported account", bank: bank || "Unknown",
        tags: [], receipt: false, source: "csv", createdAt: isoNow(), fingerprint: "",
      };
      entry.fingerprint = fp(entry);
      if (transactions.some((x) => x.fingerprint === entry.fingerprint)) { dup++; continue; }
      if (toInsert.some((x) => x.fingerprint === entry.fingerprint)) { dup++; continue; }
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (normMerch(entry.merchant).includes(normMerch(rule.whenText))) entry.category = rule.thenText;
      }
      toInsert.push(entry); ins++;
    }
    if (toInsert.length > 0) {
      try {
        await db.upsertTransactions(toInsert);
        setTransactions((prev) => [...toInsert, ...prev]);
      } catch (e) {
        console.error(e);
        showToast("Import failed", "error");
        return { inserted: 0, dupes: dup, skipped: skip };
      }
    }
    return { inserted: ins, dupes: dup, skipped: skip };
  }, [transactions, rules, showToast]);

  const processDriveImport = useCallback(async (payload: string): Promise<ImportResult> => {
    const data = JSON.parse(payload);
    const result = await importCSV(data.transactions || [], "Drive import");
    if (data.processedFiles) {
      const ns = { ...settings, processedDriveFiles: [...(settings.processedDriveFiles || []), ...data.processedFiles], lastDriveSync: isoNow() };
      await saveSettings(ns);
    }
    return result;
  }, [importCSV, settings, saveSettings]);

  const wipeAll = useCallback(async () => {
    try {
      await db.wipeAllData();
      const ns = { ...defSettings(), freshStart: true, driveResetAt: isoNow() };
      setTransactions([]); setTags([]); setRules([]); setDocuments([]);
      setSettings(ns);
      showToast("All data erased");
    } catch (e) {
      console.error(e);
      showToast("Failed to erase data", "error");
    }
  }, [showToast]);

  const detectedRecurring = useMemo<DetectedPattern[]>(() => {
    const expenses = transactions.filter((tx) => tx.type === "expense");
    const groups: Record<string, Transaction[]> = {};
    for (const tx of expenses) {
      const nm = normMerch(tx.merchant);
      if (!groups[nm]) groups[nm] = [];
      groups[nm].push(tx);
    }
    const cands: DetectedPattern[] = [];
    for (const [nm, txs] of Object.entries(groups)) {
      const uDates = [...new Set(txs.map((tx) => tx.date))].sort();
      if (uDates.length < 2) continue;
      const ivs: number[] = [];
      for (let i = 1; i < uDates.length; i++) {
        ivs.push(Math.round((new Date(uDates[i]).getTime() - new Date(uDates[i - 1]).getTime()) / 864e5));
      }
      const avg = ivs.reduce((a, b) => a + b, 0) / ivs.length;
      let cad: string | null = null;
      if (avg >= 5 && avg <= 9) cad = "weekly";
      else if (avg >= 12 && avg <= 17) cad = "biweekly";
      else if (avg >= 24 && avg <= 40) cad = "monthly";
      else if (avg >= 75 && avg <= 110) cad = "quarterly";
      else if (avg >= 330 && avg <= 400) cad = "annual";
      if (!cad) continue;
      const amts = txs.map((tx) => tx.amount);
      const avgA = amts.reduce((a, b) => a + b, 0) / amts.length;
      const vari = avgA > 0 ? ((Math.max(...amts) - Math.min(...amts)) / avgA) * 100 : 0;
      const isSub = SUB_HINTS.some((h) => nm.includes(h)) || txs.some((tx) => tx.category?.toLowerCase() === "subscriptions");
      const isBill = BILL_HINTS.some((h) => nm.includes(h));
      const maxV = isSub ? 20 : 35;
      if (vari > maxV) continue;
      if (!isSub && !isBill && (uDates.length < 3 || vari > 3)) continue;
      const jit = Math.max(...ivs.map((iv) => Math.abs(iv - avg)));
      const conf = uDates.length >= 3 && vari <= 12 && jit <= 5 ? "High" : "Likely";
      const last = uDates[uDates.length - 1];
      const nd = new Date(last);
      if (cad === "weekly") nd.setDate(nd.getDate() + 7);
      else if (cad === "biweekly") nd.setDate(nd.getDate() + 14);
      else if (cad === "monthly") nd.setMonth(nd.getMonth() + 1);
      else if (cad === "quarterly") nd.setMonth(nd.getMonth() + 3);
      else nd.setFullYear(nd.getFullYear() + 1);
      const mo = cad === "weekly" ? avgA * 52 / 12 : cad === "biweekly" ? avgA * 26 / 12 : cad === "monthly" ? avgA : cad === "quarterly" ? avgA / 3 : avgA / 12;
      const key = `${nm}|${cad}`;
      if (settings.dismissedPatterns?.includes(key)) continue;
      if (settings.recurring?.some((r) => normMerch(r.name) === nm)) continue;
      if (settings.subscriptions?.some((s) => normMerch(s.name) === nm)) continue;
      cands.push({ key, merchant: txs[0].merchant, normalized: nm, category: txs[0].category, cadence: cad, occurrences: uDates.length, confidence: conf, avgAmount: avgA, monthly: mo, nextDate: nd.toISOString().slice(0, 10), isSub, isBill, variation: vari });
    }
    return cands;
  }, [transactions, settings]);

  if (authLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#0D1117" }}>
        <p style={{ color: "#8B949E", fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>Loading...</p>
      </div>
    );
  }

  if (!user) return <LoginScreen />;

  if (!dataLoaded) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: t.bg }}>
        <p style={{ color: t.textTer, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif" }}>Loading your data...</p>
      </div>
    );
  }

  const pp = {
    transactions, settings, tags, rules, documents, period, filteredByPeriod,
    income, spending, savingsRate, detectedRecurring,
    saveTx, saveTags, saveRules, saveDocs, saveSettings,
    addTransaction, importCSV, processDriveImport, setPeriod, showToast, wipeAll, setTab,
  };

  return (
    <ThemeCtx.Provider value={{ t, dark, toggle: toggleDark }}>
      <div style={{ display: "flex", height: "100vh", background: t.bg, fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif", overflow: "hidden", color: t.text }}>
        {/* Sidebar */}
        <nav style={{ width: 238, minWidth: 238, background: t.sidebarBg, borderRight: `1px solid ${t.sidebarBorder}`, display: "flex", flexDirection: "column", padding: "16px 0", overflowY: "auto" }} className="dsk-sb">
          <div style={{ padding: "0 20px 16px", borderBottom: `1px solid ${t.sidebarBorder}`, marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: t.violet, letterSpacing: "-0.5px" }}>Ledgerly</h1>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textQuat }}>Personal Finance</p>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={toggleDark} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Toggle theme">
                {dark ? <Sun size={18} color={t.textTer} /> : <Moon size={18} color={t.textTer} />}
              </button>
              <button onClick={signOut} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }} aria-label="Sign out" title="Sign out">
                <LogOut size={18} color={t.textTer} />
              </button>
            </div>
          </div>
          {TABS.map((tb) => (
            <button key={tb.id} onClick={() => setTab(tb.id)} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", border: "none",
              background: tab === tb.id ? t.violetBg : "transparent", color: tab === tb.id ? t.violet : t.textSec,
              fontSize: 14, fontWeight: tab === tb.id ? 600 : 400, cursor: "pointer", textAlign: "left", width: "100%",
            }}>
              <tb.icon size={18} />{tb.label}
            </button>
          ))}
        </nav>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Top Bar */}
          <header style={{ height: 64, minHeight: 64, background: t.topbarBg, borderBottom: `1px solid ${t.topbarBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button className="mob-menu" onClick={toggleDark} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "none" }}>
                {dark ? <Sun size={18} color={t.textTer} /> : <Moon size={18} color={t.textTer} />}
              </button>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: t.text }}>
                {TABS.find((tb) => tb.id === tab)?.label}
              </h2>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn variant="secondary" small onClick={() => setImportModal(true)}><Upload size={15} />Import</Btn>
              <Btn small onClick={() => setAddModal(true)}><Plus size={15} />Add entry</Btn>
            </div>
          </header>

          <main style={{ flex: 1, overflowY: "auto", padding: 20 }}>
            {tab === "dashboard" && <DashboardPage {...pp} />}
            {tab === "transactions" && <TransactionsPage {...pp} />}
            {tab === "recurring" && <RecurringPage {...pp} />}
            {tab === "subscriptions" && <SubscriptionsPage {...pp} />}
            {tab === "budgets" && <BudgetsPage {...pp} />}
            {tab === "goals" && <GoalsPage {...pp} />}
            {tab === "documents" && <DocumentsPage {...pp} />}
            {tab === "rules" && <RulesPage {...pp} />}
            {tab === "settings" && <SettingsPage {...pp} />}
          </main>

          {/* Mobile bottom nav */}
          <nav className="mob-nav" style={{ display: "none", background: t.topbarBg, borderTop: `1px solid ${t.topbarBorder}`, overflowX: "auto", whiteSpace: "nowrap", padding: "4px 8px" }}>
            {TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "6px 12px",
                border: "none", background: tab === tb.id ? t.violetBg : "transparent",
                color: tab === tb.id ? t.violet : t.textTer, fontSize: 10,
                fontWeight: tab === tb.id ? 600 : 400, cursor: "pointer", borderRadius: 8, minWidth: 60,
              }}>
                <tb.icon size={18} />{tb.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Toast */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            padding: "10px 20px", borderRadius: 10, background: toast.type === "error" ? t.red : t.green,
            color: "#fff", fontSize: 14, fontWeight: 500, zIndex: 2000, boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>{toast.msg}</div>
        )}

        <AddEntryModal open={addModal} onClose={() => setAddModal(false)} settings={settings} tags={tags} saveTags={saveTags} onSave={addTransaction} />
        <ImportModal open={importModal} onClose={() => setImportModal(false)} settings={settings} saveSettings={saveSettings} onImport={importCSV} showToast={showToast} />

        <style>{`@media(max-width:768px){.dsk-sb{display:none!important}.mob-nav{display:flex!important}.mob-menu{display:block!important}}`}</style>
      </div>
    </ThemeCtx.Provider>
  );
}
