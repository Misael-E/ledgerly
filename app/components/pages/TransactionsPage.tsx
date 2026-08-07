"use client";

import { useState, useMemo } from "react";
import { ArrowLeftRight, Search, Trash2, X } from "lucide-react";
import { PeriodSelector, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import TagModal from "@/app/components/modals/TagModal";
import { fmt, inPeriod } from "@/app/lib/helpers";
import type { Transaction, Settings, TagItem } from "@/app/lib/types";

interface Props {
  transactions: Transaction[];
  settings: Settings;
  period: string;
  setPeriod: (p: string) => Promise<void>;
  saveTx: (txs: Transaction[]) => Promise<void>;
  tags: TagItem[];
  saveTags: (tags: TagItem[]) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function TransactionsPage({ transactions, settings, period, setPeriod, saveTx, tags, saveTags, showToast }: Props) {
  const { t } = useTheme();
  const [search, setSearch] = useState("");
  const [bankF, setBankF] = useState("all");
  const [acctF, setAcctF] = useState("all");
  const [catF, setCatF] = useState("all");
  const [editTag, setEditTag] = useState<string | null>(null);

  const allBanks = useMemo(() =>
    [...new Set([...(settings.banks || []), ...transactions.map((tx) => tx.bank).filter(Boolean)])],
    [transactions, settings]
  );
  const allAccts = useMemo(() =>
    [...new Set([...(settings.accounts || []), ...transactions.map((tx) => tx.account).filter(Boolean)])],
    [transactions, settings]
  );

  const filtered = useMemo(() => transactions.filter((tx) => {
    if (!inPeriod(tx.date, period)) return false;
    if (bankF !== "all" && tx.bank !== bankF) return false;
    if (acctF !== "all" && tx.account !== acctF) return false;
    if (catF !== "all" && tx.category !== catF) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!tx.merchant.toLowerCase().includes(s) && !tx.category.toLowerCase().includes(s) && !(tx.bank || "").toLowerCase().includes(s) && !tx.tags?.some((tg) => tg.toLowerCase().includes(s)))
        return false;
    }
    return true;
  }), [transactions, period, bankF, acctF, catF, search]);

  const fI = filtered.filter((tx) => tx.type === "income").reduce((s, tx) => s + tx.amount, 0);
  const fS = filtered.filter((tx) => tx.type === "expense").reduce((s, tx) => s + tx.amount, 0);

  const updateTx = async (id: string, upd: Partial<Transaction>) => {
    await saveTx(transactions.map((tx) => tx.id === id ? { ...tx, ...upd } : tx));
  };
  const deleteTx = async (id: string) => {
    await saveTx(transactions.filter((tx) => tx.id !== id));
    showToast("Deleted");
  };

  return (
    <div>
      <div style={{ marginBottom: 12 }}><PeriodSelector value={period} onChange={setPeriod} /></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: t.textQuat }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..."
            style={{ width: "100%", padding: "8px 8px 8px 30px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, boxSizing: "border-box", background: t.inputBg, color: t.text }} />
        </div>
        <select value={bankF} onChange={(e) => setBankF(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, background: t.selectBg, color: t.text }}>
          <option value="all">All banks</option>{allBanks.map((b) => <option key={b}>{b}</option>)}
        </select>
        <select value={acctF} onChange={(e) => setAcctF(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, background: t.selectBg, color: t.text }}>
          <option value="all">All accounts</option>{allAccts.map((a) => <option key={a}>{a}</option>)}
        </select>
        <select value={catF} onChange={(e) => setCatF(e.target.value)} style={{ padding: "8px 10px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, background: t.selectBg, color: t.text }}>
          <option value="all">All categories</option>{(settings.categories || []).map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 12, fontSize: 13, color: t.textSec }}>
        <span><strong>{filtered.length}</strong> transactions</span>
        <span style={{ color: t.green }}>Income: <strong>{fmt(fI)}</strong></span>
        <span style={{ color: t.orange }}>Spending: <strong>{fmt(fS)}</strong></span>
      </div>

      {filtered.length === 0
        ? <EmptyState icon={ArrowLeftRight} title="No transactions" desc="Add a transaction or import a CSV to get started." />
        : <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            {filtered.map((tx, i) => (
              <div key={tx.id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, padding: "10px 14px", background: i % 2 === 0 ? t.card : t.rowAlt, borderBottom: `1px solid ${t.cardBorder}` }}>
                <div style={{ flex: "1 1 180px", minWidth: 120 }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.text }}>{tx.merchant}</p>
                  <p style={{ margin: 0, fontSize: 12, color: t.textQuat }}>{tx.date} · {tx.account} · {tx.bank}</p>
                </div>
                <select value={tx.category} onChange={(e) => updateTx(tx.id, { category: e.target.value })}
                  style={{ padding: "4px 8px", border: `1px solid ${t.inputBorder}`, borderRadius: 6, fontSize: 12, background: t.selectBg, color: t.text, minWidth: 100 }}>
                  {(settings.categories || []).map((c) => <option key={c}>{c}</option>)}
                </select>
                <div style={{ display: "flex", gap: 3, flexWrap: "wrap", alignItems: "center", minWidth: 60 }}>
                  {(tx.tags || []).map((tg) => (
                    <span key={tg} style={{ display: "inline-flex", alignItems: "center", gap: 2, padding: "2px 6px", background: t.violetBg, borderRadius: 8, fontSize: 11, color: t.violet }}>
                      {tg}<X size={10} style={{ cursor: "pointer" }} onClick={() => updateTx(tx.id, { tags: tx.tags.filter((x) => x !== tg) })} />
                    </span>
                  ))}
                  <button onClick={() => setEditTag(tx.id)} style={{ width: 20, height: 20, borderRadius: 10, border: `1px dashed ${t.textQuat}`, background: "none", cursor: "pointer", fontSize: 12, color: t.textQuat, display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                </div>
                <span style={{ fontWeight: 600, fontSize: 14, color: tx.type === "income" ? t.green : t.text, minWidth: 80, textAlign: "right" }}>
                  {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                </span>
                <button onClick={() => deleteTx(tx.id)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <Trash2 size={14} color={t.textQuat} />
                </button>
              </div>
            ))}
          </div>}

      <TagModal
        open={!!editTag} onClose={() => setEditTag(null)} tags={tags} saveTags={saveTags}
        currentTags={transactions.find((tx) => tx.id === editTag)?.tags || []}
        onSave={async (nt) => { await updateTx(editTag!, { tags: nt }); setEditTag(null); }}
      />
    </div>
  );
}
