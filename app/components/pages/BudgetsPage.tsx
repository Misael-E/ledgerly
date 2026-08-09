"use client";

import { useState, useMemo } from "react";
import { Plus, Trash2, Target, Edit3, DollarSign, PieChart, Eye, EyeOff } from "lucide-react";
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

const PRESETS: { name: string; desc: string; items: { category: string; percent: number }[] }[] = [
  {
    name: "50/30/20",
    desc: "Balanced — 50% needs, 30% wants, 20% savings",
    items: [
      { category: "Housing", percent: 30 },
      { category: "Groceries", percent: 10 },
      { category: "Utilities", percent: 5 },
      { category: "Insurance", percent: 5 },
      { category: "Transportation", percent: 5 },
      { category: "Shopping", percent: 10 },
      { category: "Dining", percent: 8 },
      { category: "Entertainment", percent: 7 },
      { category: "Subscriptions", percent: 5 },
      { category: "Health", percent: 5 },
      { category: "Other", percent: 10 },
    ],
  },
  {
    name: "70/20/10",
    desc: "Aggressive savings — 70% living, 20% savings, 10% debt",
    items: [
      { category: "Housing", percent: 28 },
      { category: "Groceries", percent: 12 },
      { category: "Utilities", percent: 5 },
      { category: "Insurance", percent: 5 },
      { category: "Transportation", percent: 5 },
      { category: "Shopping", percent: 5 },
      { category: "Dining", percent: 5 },
      { category: "Entertainment", percent: 3 },
      { category: "Subscriptions", percent: 2 },
      { category: "Health", percent: 5 },
      { category: "Other", percent: 5 },
    ],
  },
];

export default function BudgetsPage({ settings, saveSettings, transactions, showToast }: Props) {
  const { t } = useTheme();
  const [addM, setAddM] = useState(false);
  const [editIncome, setEditIncome] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [presetM, setPresetM] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editPct, setEditPct] = useState("");
  const [editLim, setEditLim] = useState("");
  const [addCat, setAddCat] = useState("");
  const [addMode, setAddMode] = useState<"percent" | "fixed">("percent");
  const [addPct, setAddPct] = useState("");
  const [addLim, setAddLim] = useState("");
  const [hideAmounts, setHideAmounts] = useState(false);

  const mask = (v: string) => hideAmounts ? "••••••" : v;

  const budgets = settings.budgets || [];
  const monthlyIncome = settings.monthlyIncome || 0;
  const now = new Date();
  const thisM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const mExp = transactions.filter((tx) => tx.type === "expense" && tx.date.startsWith(thisM) && tx.category !== "Transfer");

  const detectedIncome = useMemo(() => {
    const incomeTxs = transactions.filter((tx) => tx.type === "income" && tx.category !== "Transfer" && tx.date.startsWith(thisM));
    return incomeTxs.reduce((s, tx) => s + tx.amount, 0);
  }, [transactions, thisM]);

  const effectiveIncome = monthlyIncome || detectedIncome;

  const totalAllocatedPct = budgets.reduce((s, b) => s + (b.percent || 0), 0);
  const unallocatedPct = 100 - totalAllocatedPct;

  const getBudgetLimit = (b: Budget) => {
    if (b.percent && effectiveIncome > 0) return (b.percent / 100) * effectiveIncome;
    return b.limit;
  };

  const totalLimit = budgets.filter((b) => b.active !== false).reduce((s, b) => s + getBudgetLimit(b), 0);
  const totalSpent = budgets.filter((b) => b.active !== false).reduce((s, b) => s + mExp.filter((tx) => tx.category === b.category).reduce((a, tx) => a + tx.amount, 0), 0);

  const saveIncome = async () => {
    const val = parseFloat(incomeInput);
    if (isNaN(val) || val < 0) { showToast("Invalid amount", "error"); return; }
    await saveSettings({ ...settings, monthlyIncome: val });
    showToast("Income updated");
    setEditIncome(false);
  };

  const applyPreset = async (preset: typeof PRESETS[number]) => {
    const cats = settings.categories || [];
    const newBudgets: Budget[] = preset.items
      .filter((item) => cats.includes(item.category))
      .map((item) => ({
        id: uuid(),
        category: item.category,
        limit: effectiveIncome > 0 ? (item.percent / 100) * effectiveIncome : 0,
        percent: item.percent,
        active: true,
      }));
    await saveSettings({ ...settings, budgets: newBudgets });
    showToast(`Applied ${preset.name} template`);
    setPresetM(false);
  };

  const saveBudget = async (b: Budget) => {
    const nb = b.id && budgets.some((x) => x.id === b.id)
      ? budgets.map((x) => x.id === b.id ? b : x)
      : [...budgets, { ...b, id: b.id || uuid() }];
    await saveSettings({ ...settings, budgets: nb });
    showToast("Saved");
    setAddM(false);
    setEditId(null);
  };

  const rmBudget = async (id: string) => {
    await saveSettings({ ...settings, budgets: budgets.filter((b) => b.id !== id) });
    showToast("Removed");
  };

  const avail = (settings.categories || []).filter(
    (c) => !budgets.some((b) => b.category === c) && c !== "Income" && c !== "Needs review" && c !== "Transfer"
  );

  const startEdit = (b: Budget) => {
    setEditId(b.id);
    setEditPct(b.percent ? String(b.percent) : "");
    setEditLim(String(b.limit));
  };

  const saveEdit = async (b: Budget) => {
    const pct = editPct ? parseFloat(editPct) : undefined;
    const lim = editLim ? parseFloat(editLim) : b.limit;
    await saveBudget({ ...b, percent: pct, limit: pct && effectiveIncome > 0 ? (pct / 100) * effectiveIncome : lim });
    setEditId(null);
  };

  return (
    <div>
      {/* Income section */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <DollarSign size={18} color={t.green} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Monthly Income</h3>
              <button onClick={() => setHideAmounts(!hideAmounts)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, display: "flex", alignItems: "center" }} title={hideAmounts ? "Show amounts" : "Hide amounts"}>
                {hideAmounts ? <EyeOff size={16} color={t.textQuat} /> : <Eye size={16} color={t.textQuat} />}
              </button>
            </div>
            {effectiveIncome > 0 ? (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: t.green }}>{mask(fmt(effectiveIncome))}</span>
                {!monthlyIncome && detectedIncome > 0 && (
                  <span style={{ fontSize: 12, color: t.textQuat, marginLeft: 8 }}>auto-detected from transactions</span>
                )}
                {monthlyIncome > 0 && (
                  <span style={{ fontSize: 12, color: t.textQuat, marginLeft: 8 }}>manually set</span>
                )}
              </div>
            ) : (
              <p style={{ fontSize: 13, color: t.textQuat, margin: "6px 0 0" }}>Set your income to enable percentage-based budgets</p>
            )}
          </div>
          <Btn small variant="secondary" onClick={() => { setIncomeInput(String(monthlyIncome || "")); setEditIncome(true); }}>
            <Edit3 size={14} />{effectiveIncome > 0 ? "Edit" : "Set income"}
          </Btn>
        </div>
      </Card>

      {/* Allocation overview */}
      {budgets.length > 0 && effectiveIncome > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 15, fontWeight: 600, color: t.text }}>Budget Allocation</h3>
          <div style={{ display: "flex", height: 24, borderRadius: 8, overflow: "hidden", marginBottom: 8 }}>
            {budgets.filter((b) => b.active !== false && (b.percent || 0) > 0).map((b, i) => (
              <div key={b.id} style={{ width: `${b.percent}%`, background: ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"][i % 10], display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(b.percent || 0) >= 8 && <span style={{ fontSize: 10, color: "#fff", fontWeight: 600 }}>{b.percent}%</span>}
              </div>
            ))}
            {unallocatedPct > 0 && (
              <div style={{ width: `${unallocatedPct}%`, background: t.rowAlt, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {unallocatedPct >= 8 && <span style={{ fontSize: 10, color: t.textQuat, fontWeight: 600 }}>{unallocatedPct}%</span>}
              </div>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
            <span style={{ color: t.textSec }}>Allocated: <strong>{fmtPct(totalAllocatedPct)}</strong> ({fmt(totalLimit)})</span>
            <span style={{ color: unallocatedPct > 0 ? t.green : unallocatedPct === 0 ? t.textQuat : t.red }}>
              {unallocatedPct > 0 ? `${fmtPct(unallocatedPct)} unallocated` : unallocatedPct === 0 ? "Fully allocated" : `${fmtPct(Math.abs(unallocatedPct))} over-allocated`}
            </span>
          </div>
        </Card>
      )}

      {/* This month health */}
      {budgets.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>This Month</h3>
            <span style={{ fontSize: 13, color: t.textSec }}>{fmt(totalSpent)} of {fmt(totalLimit)}</span>
          </div>
          <ProgressBar value={totalSpent} max={totalLimit} color={totalSpent > totalLimit ? t.red : t.green} height={12} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12 }}>
            <span style={{ color: t.textQuat }}>{fmtPct(totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0)} used</span>
            <span style={{ color: totalSpent > totalLimit ? t.red : t.green, fontWeight: 600 }}>
              {totalSpent > totalLimit ? `Over by ${fmt(totalSpent - totalLimit)}` : `${fmt(totalLimit - totalSpent)} remaining`}
            </span>
          </div>
        </Card>
      )}

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Categories</h3>
        <div style={{ display: "flex", gap: 8 }}>
          {effectiveIncome > 0 && (
            <Btn small variant="secondary" onClick={() => setPresetM(true)}><PieChart size={14} />Templates</Btn>
          )}
          <Btn small onClick={() => { setAddCat(""); setAddPct(""); setAddLim(""); setAddMode(effectiveIncome > 0 ? "percent" : "fixed"); setAddM(true); }}><Plus size={14} />Add category</Btn>
        </div>
      </div>

      {/* Budget cards */}
      {budgets.length === 0
        ? <EmptyState icon={Target} title="No budgets yet" desc={effectiveIncome > 0 ? "Use a template or add categories manually." : "Set your income above, then create budgets."} action={effectiveIncome > 0 ? <Btn small onClick={() => setPresetM(true)}>Use a template</Btn> : undefined} />
        : budgets.map((b, i) => {
            const limit = getBudgetLimit(b);
            const sp = mExp.filter((tx) => tx.category === b.category).reduce((s, tx) => s + tx.amount, 0);
            const rem = limit - sp;
            const ov = sp > limit;
            const isEditing = editId === b.id;
            const barColor = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#6366f1", "#14b8a6", "#f97316", "#84cc16"][i % 10];

            return (
              <Card key={b.id} style={{ marginBottom: 8 }}>
                {isEditing ? (
                  <div>
                    <p style={{ margin: "0 0 8px", fontWeight: 600, fontSize: 14, color: t.text }}>{b.category}</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
                      {effectiveIncome > 0 && (
                        <div style={{ flex: 1, minWidth: 100 }}>
                          <label style={{ fontSize: 12, color: t.textTer, display: "block", marginBottom: 4 }}>% of income</label>
                          <input value={editPct} onChange={(e) => { setEditPct(e.target.value); if (e.target.value && effectiveIncome) setEditLim(String(Math.round((parseFloat(e.target.value) / 100) * effectiveIncome * 100) / 100)); }}
                            type="number" placeholder="e.g. 10"
                            style={{ width: "100%", padding: "6px 10px", border: `1px solid ${t.inputBorder}`, borderRadius: 6, fontSize: 13, background: t.inputBg, color: t.text, boxSizing: "border-box" }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 100 }}>
                        <label style={{ fontSize: 12, color: t.textTer, display: "block", marginBottom: 4 }}>$ limit</label>
                        <input value={editLim} onChange={(e) => { setEditLim(e.target.value); if (effectiveIncome > 0) setEditPct(String(Math.round((parseFloat(e.target.value) / effectiveIncome) * 10000) / 100)); }}
                          type="number" placeholder="0.00"
                          style={{ width: "100%", padding: "6px 10px", border: `1px solid ${t.inputBorder}`, borderRadius: 6, fontSize: 13, background: t.inputBg, color: t.text, boxSizing: "border-box" }} />
                      </div>
                      <Btn small onClick={() => saveEdit(b)}>Save</Btn>
                      <Btn small variant="secondary" onClick={() => setEditId(null)}>Cancel</Btn>
                    </div>
                    {editPct && effectiveIncome > 0 && (
                      <p style={{ margin: "6px 0 0", fontSize: 12, color: t.textQuat }}>{editPct}% of {mask(fmt(effectiveIncome))} = {fmt((parseFloat(editPct) / 100) * effectiveIncome)}</p>
                    )}
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>{b.category}</span>
                        {b.percent && <span style={{ fontSize: 11, color: t.textQuat, padding: "1px 6px", background: t.rowAlt, borderRadius: 4 }}>{b.percent}%</span>}
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button onClick={() => startEdit(b)} style={{ background: "none", border: "none", cursor: "pointer" }}><Edit3 size={14} color={t.textTer} /></button>
                        <button onClick={() => rmBudget(b.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={t.textQuat} /></button>
                      </div>
                    </div>
                    <ProgressBar value={sp} max={limit} color={ov ? t.red : barColor} />
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 12, color: t.textSec }}>
                      <span>{fmt(sp)} spent</span><span>{fmt(limit)} limit</span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: ov ? t.red : t.green, fontWeight: 600 }}>
                      {ov ? `Over by ${fmt(Math.abs(rem))}` : `${fmt(rem)} remaining`}
                    </p>
                  </>
                )}
              </Card>
            );
          })}

      {/* Add budget modal */}
      <Modal open={addM} onClose={() => setAddM(false)} title="Add Budget Category">
        <Select label="Category" value={addCat} onChange={setAddCat} options={avail} placeholder="Select category" />

        {effectiveIncome > 0 && (
          <div style={{ display: "flex", gap: 8, margin: "12px 0" }}>
            <button onClick={() => setAddMode("percent")}
              style={{ flex: 1, padding: "8px 12px", border: `1px solid ${addMode === "percent" ? t.violet : t.inputBorder}`, borderRadius: 8, fontSize: 13, background: addMode === "percent" ? t.violetBg : "transparent", color: addMode === "percent" ? t.violet : t.textSec, cursor: "pointer", fontWeight: addMode === "percent" ? 600 : 400 }}>
              % of income
            </button>
            <button onClick={() => setAddMode("fixed")}
              style={{ flex: 1, padding: "8px 12px", border: `1px solid ${addMode === "fixed" ? t.violet : t.inputBorder}`, borderRadius: 8, fontSize: 13, background: addMode === "fixed" ? t.violetBg : "transparent", color: addMode === "fixed" ? t.violet : t.textSec, cursor: "pointer", fontWeight: addMode === "fixed" ? 600 : 400 }}>
              Fixed amount
            </button>
          </div>
        )}

        {addMode === "percent" && effectiveIncome > 0 ? (
          <>
            <Input label="Percentage of income" value={addPct} onChange={(v) => { setAddPct(v); if (v) setAddLim(String(Math.round((parseFloat(v) / 100) * effectiveIncome * 100) / 100)); }} type="number" placeholder="e.g. 10" />
            {addPct && <p style={{ fontSize: 12, color: t.textQuat, margin: "4px 0" }}>{addPct}% of {mask(fmt(effectiveIncome))} = <strong>{fmt((parseFloat(addPct) / 100) * effectiveIncome)}</strong></p>}
          </>
        ) : (
          <Input label="Monthly Limit" value={addLim} onChange={setAddLim} type="number" placeholder="0.00" />
        )}

        <Btn onClick={() => {
          const pct = addMode === "percent" && addPct ? parseFloat(addPct) : undefined;
          const lim = addLim ? parseFloat(addLim) : (pct && effectiveIncome > 0 ? (pct / 100) * effectiveIncome : 0);
          saveBudget({ id: uuid(), category: addCat, limit: lim, percent: pct, active: true });
        }} disabled={!addCat || (!addPct && !addLim)} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
          Save
        </Btn>
      </Modal>

      {/* Income modal */}
      <Modal open={editIncome} onClose={() => setEditIncome(false)} title="Set Monthly Income">
        <Input label="Monthly take-home pay" value={incomeInput} onChange={setIncomeInput} type="number" placeholder="e.g. 4252.62" />
        {detectedIncome > 0 && (
          <div style={{ margin: "8px 0" }}>
            <p style={{ fontSize: 12, color: t.textTer, margin: "0 0 4px" }}>Detected from this month&apos;s transactions:</p>
            <button onClick={() => setIncomeInput(String(detectedIncome))}
              style={{ padding: "6px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 6, fontSize: 13, background: t.rowAlt, color: t.green, cursor: "pointer", fontWeight: 600 }}>
              Use {fmt(detectedIncome)}
            </button>
          </div>
        )}
        <p style={{ fontSize: 12, color: t.textQuat, margin: "8px 0" }}>This is used to calculate percentage-based budget limits. All existing %-based budgets will update automatically.</p>
        <Btn onClick={saveIncome} disabled={!incomeInput} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>Save</Btn>
      </Modal>

      {/* Template modal */}
      <Modal open={presetM} onClose={() => setPresetM(false)} title="Budget Templates">
        <p style={{ fontSize: 12, color: t.textQuat, margin: "0 0 12px" }}>Based on your income of <strong>{mask(fmt(effectiveIncome))}</strong>. This will replace your current budgets.</p>

        {PRESETS.map((p) => (
          <Card key={p.name} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => applyPreset(p)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: t.text }}>{p.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textTer }}>{p.desc}</p>
              </div>
              <span style={{ fontSize: 12, color: t.violet, fontWeight: 500 }}>Apply →</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
              {p.items.filter((item) => (settings.categories || []).includes(item.category)).map((item) => (
                <span key={item.category} style={{ fontSize: 11, padding: "2px 8px", background: t.rowAlt, borderRadius: 4, color: t.textSec }}>
                  {item.category} {item.percent}% ({fmt((item.percent / 100) * effectiveIncome)})
                </span>
              ))}
            </div>
          </Card>
        ))}
      </Modal>
    </div>
  );
}
