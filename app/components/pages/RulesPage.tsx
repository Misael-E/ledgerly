"use client";

import { useState } from "react";
import { Plus, Edit3, Trash2, Zap, Tag, X, ToggleLeft, ToggleRight, RefreshCw } from "lucide-react";
import { Card, Btn, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import RuleModal from "@/app/components/modals/RuleModal";
import SimpleNameModal from "@/app/components/modals/SimpleNameModal";
import { uuid, isoNow, normMerch } from "@/app/lib/helpers";
import type { Rule, TagItem, Transaction, Settings } from "@/app/lib/types";

interface Props {
  rules: Rule[];
  saveRules: (rules: Rule[]) => Promise<void>;
  tags: TagItem[];
  saveTags: (tags: TagItem[]) => Promise<void>;
  transactions: Transaction[];
  saveTx: (txs: Transaction[]) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
  settings: Settings;
}

export default function RulesPage({ rules, saveRules, tags, saveTags, transactions, saveTx, showToast, settings }: Props) {
  const { t } = useTheme();
  const [addR, setAddR] = useState(false);
  const [addT, setAddT] = useState(false);
  const [editR, setEditR] = useState<Rule | null>(null);

  const svRule = async (r: Rule) => {
    const nr = r.id ? rules.map((x) => x.id === r.id ? r : x) : [...rules, { ...r, id: uuid(), createdAt: isoNow() }];
    await saveRules(nr); showToast("Saved"); setAddR(false); setEditR(null);
  };
  const rmRule = async (id: string) => { await saveRules(rules.filter((r) => r.id !== id)); showToast("Removed"); };
  const togRule = async (id: string) => { await saveRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r)); };
  const mkTag = async (name: string) => {
    if (tags.some((tg) => tg.name.toLowerCase() === name.toLowerCase())) { showToast("Exists", "error"); return; }
    await saveTags([...tags, { name, createdAt: isoNow() }]); showToast("Created"); setAddT(false);
  };
  const rmTag = async (name: string) => { await saveTags(tags.filter((tg) => tg.name !== name)); showToast("Removed"); };

  const reapplyRules = async () => {
    const enabled = rules.filter((r) => r.enabled);
    if (enabled.length === 0) { showToast("No enabled rules", "error"); return; }
    let count = 0;
    const updated = transactions.map((tx) => {
      for (const r of enabled) {
        if (normMerch(tx.merchant).includes(normMerch(r.whenText)) && tx.category !== r.thenText) {
          count++;
          return { ...tx, category: r.thenText };
        }
      }
      return tx;
    });
    if (count === 0) { showToast("No transactions matched"); return; }
    await saveTx(updated);
    showToast(`Re-categorized ${count} transactions`);
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Categorization Rules</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="secondary" onClick={reapplyRules}><RefreshCw size={14} />Re-apply to all</Btn>
          <Btn small onClick={() => setAddR(true)}><Plus size={14} />Create rule</Btn>
        </div>
      </div>
      <p style={{ fontSize: 13, color: t.textTer, margin: "0 0 12px" }}>Rules auto-categorize new imports when the merchant matches. Use &quot;Re-apply to all&quot; to bulk-categorize existing transactions.</p>

      {rules.length === 0
        ? <EmptyState icon={Zap} title="No rules" desc="Create a rule to auto-categorize." />
        : rules.map((r) => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <p style={{ margin: 0, fontSize: 14, color: t.text }}>When <strong>&quot;{r.whenText}&quot;</strong> → <strong>{r.thenText}</strong></p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button onClick={() => togRule(r.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                    {r.enabled ? <ToggleRight size={20} color={t.green} /> : <ToggleLeft size={20} color={t.textQuat} />}
                  </button>
                  <button onClick={() => setEditR(r)} style={{ background: "none", border: "none", cursor: "pointer" }}><Edit3 size={14} color={t.textTer} /></button>
                  <button onClick={() => rmRule(r.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={t.textQuat} /></button>
                </div>
              </div>
            </Card>
          ))}

      <RuleModal open={addR || !!editR} onClose={() => { setAddR(false); setEditR(null); }} item={editR} onSave={svRule} categories={settings.categories || []} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "24px 0 8px" }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Tags</h3>
        <Btn small onClick={() => setAddT(true)}><Plus size={14} />Create tag</Btn>
      </div>

      {tags.length === 0
        ? <p style={{ fontSize: 13, color: t.textQuat }}>No tags yet.</p>
        : <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {tags.map((tg) => {
              const cnt = transactions.filter((tx) => tx.tags?.includes(tg.name)).length;
              return (
                <div key={tg.name} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", background: t.violetBg, borderRadius: 12 }}>
                  <Tag size={12} color={t.violet} />
                  <span style={{ fontSize: 13, color: t.violet, fontWeight: 500 }}>{tg.name}</span>
                  <span style={{ fontSize: 11, color: t.textQuat }}>({cnt})</span>
                  <button onClick={() => rmTag(tg.name)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: 4 }}>
                    <X size={12} color={t.textQuat} />
                  </button>
                </div>
              );
            })}
          </div>}

      <SimpleNameModal open={addT} onClose={() => setAddT(false)} title="Create Tag" label="Tag name" onSave={mkTag} />
    </div>
  );
}
