"use client";

import { useState } from "react";
import { Plus, Trash2, Target } from "lucide-react";
import { Card, Btn, Modal, Select, Input, EmptyState, ProgressBar } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import { uuid, fmt, fmtPct } from "@/app/lib/helpers";
import type { Transaction, Settings, Budget } from "@/app/lib/types";

interface Props {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  transactions: Transaction[];
  showToast: (msg: string, type?: "success" | "error") => void;
}

function BudgetForm({ categories, onSave, existingCats }: { categories: string[]; onSave: (b: Budget) => Promise<void>; existingCats: string[] }) {
  const [cat, setCat] = useState("");
  const [lim, setLim] = useState("");
  const avail = categories.filter((c) => !existingCats.includes(c) && c !== "Income" && c !== "Needs review");
  return (
    <>
      <Select label="Category" value={cat} onChange={setCat} options={avail} placeholder="Select category" />
      <Input label="Monthly Limit" value={lim} onChange={setLim} type="number" placeholder="0.00" />
      <Btn onClick={() => onSave({ category: cat, limit: Number(lim), active: true } as Budget)} disabled={!cat || !lim} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>Save</Btn>
    </>
  );
}

export default function BudgetsPage({ settings, saveSettings, transactions, showToast }: Props) {
  const { t } = useTheme();
  const [addM, setAddM] = useState(false);
  const budgets = settings.budgets || [];
  const now = new Date();
  const thisM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mExp = transactions.filter((tx) => tx.type === "expense" && tx.date.startsWith(thisM));

  const saveBudget = async (b: Budget) => {
    const nb = b.id ? budgets.map((x) => x.id === b.id ? b : x) : [...budgets, { ...b, id: uuid() }];
    await saveSettings({ ...settings, budgets: nb });
    showToast("Saved"); setAddM(false);
  };
  const rmBudget = async (id: string) => {
    await saveSettings({ ...settings, budgets: budgets.filter((b) => b.id !== id) });
    showToast("Removed");
  };

  const tL = budgets.filter((b) => b.active !== false).reduce((s, b) => s + b.limit, 0);
  const tS = budgets.filter((b) => b.active !== false).reduce((s, b) => s + mExp.filter((tx) => tx.category === b.category).reduce((a, tx) => a + tx.amount, 0), 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>{budgets.length > 0 && <p style={{ margin: 0, fontSize: 13, color: t.textSec }}>This month: {fmt(tS)} of {fmt(tL)}</p>}</div>
        <Btn small onClick={() => setAddM(true)}><Plus size={14} />Create budget</Btn>
      </div>

      {budgets.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: t.text }}>Budget Health</h3>
          <ProgressBar value={tS} max={tL} color={tS > tL ? t.red : t.green} height={12} />
          <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textSec }}>{fmtPct(tL > 0 ? tS / tL * 100 : 0)} used</p>
        </Card>
      )}

      {budgets.length === 0
        ? <EmptyState icon={Target} title="No budgets yet" desc="Create a budget to track spending." action={<Btn small onClick={() => setAddM(true)}>Create budget</Btn>} />
        : budgets.map((b) => {
            const sp = mExp.filter((tx) => tx.category === b.category).reduce((s, tx) => s + tx.amount, 0);
            const rem = b.limit - sp;
            const ov = sp > b.limit;
            return (
              <Card key={b.id} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{b.category}</span>
                  <button onClick={() => rmBudget(b.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={t.textQuat} /></button>
                </div>
                <ProgressBar value={sp} max={b.limit} color={ov ? t.red : t.violet} />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: t.textSec }}>
                  <span>{fmt(sp)} spent</span><span>{fmt(b.limit)} limit</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: ov ? t.red : t.green, fontWeight: 600 }}>
                  {ov ? `Over by ${fmt(Math.abs(rem))}` : `${fmt(rem)} remaining`}
                </p>
              </Card>
            );
          })}

      <Modal open={addM} onClose={() => setAddM(false)} title="Create Budget">
        <BudgetForm categories={settings.categories || []} onSave={saveBudget} existingCats={budgets.map((b) => b.category)} />
      </Modal>
    </div>
  );
}
