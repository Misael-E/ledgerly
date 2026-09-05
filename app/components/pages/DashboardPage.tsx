"use client";

import { useState, useMemo } from "react";
import { PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Target, AlertCircle, Repeat, ArrowUpRight, ArrowDownRight, ShoppingBag, CreditCard, CheckCircle, Trash2 } from "lucide-react";
import { Card, PeriodSelector, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import { PIE_COLORS } from "@/app/lib/constants";
import { fmt, fmtPct } from "@/app/lib/helpers";
import type { Transaction, Settings, DetectedPattern } from "@/app/lib/types";

interface Props {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  period: string;
  setPeriod: (p: string) => Promise<void>;
  filteredByPeriod: Transaction[];
  income: number;
  spending: number;
  savingsRate: number;
  transactions: Transaction[];
  detectedRecurring: DetectedPattern[];
  setTab: (tab: string) => void;
}

export default function DashboardPage({ settings, saveSettings, period, setPeriod, filteredByPeriod, income, spending, savingsRate, transactions, detectedRecurring, setTab }: Props) {
  const { t } = useTheme();
  const [bankF, setBankF] = useState("all");
  const [showAllActivity, setShowAllActivity] = useState(false);

  const allBanks = useMemo(() =>
    [...new Set(transactions.map((tx) => tx.bank).filter(Boolean))],
    [transactions]
  );

  const filtered = useMemo(() =>
    bankF === "all" ? filteredByPeriod : filteredByPeriod.filter((tx) => tx.bank === bankF),
    [filteredByPeriod, bankF]
  );

  const filteredIncome = useMemo(() => filtered.filter((tx) => tx.type === "income" && tx.category !== "Transfer").reduce((s, tx) => s + tx.amount, 0), [filtered]);
  const filteredSpending = useMemo(() => filtered.filter((tx) => tx.type === "expense" && tx.category !== "Transfer").reduce((s, tx) => s + tx.amount, 0), [filtered]);
  const filteredSavingsRate = filteredIncome > 0 ? ((filteredIncome - filteredSpending) / filteredIncome) * 100 : 0;

  const nw = settings.netWorthConfigured ? settings.assets - settings.liabilities : null;
  const needsReview = filtered.filter((tx) => tx.category === "Needs review").length;

  const chartData = useMemo(() => {
    const mo: Record<string, { month: string; Income: number; Expenses: number }> = {};
    filtered.forEach((tx) => {
      if (tx.category === "Transfer") return;
      const m = tx.date.slice(0, 7);
      if (!mo[m]) mo[m] = { month: m, Income: 0, Expenses: 0 };
      if (tx.type === "income") mo[m].Income += tx.amount;
      else mo[m].Expenses += tx.amount;
    });
    return Object.values(mo).sort((a, b) => a.month.localeCompare(b.month)).slice(-7);
  }, [filtered]);

  const catData = useMemo(() => {
    const c: Record<string, number> = {};
    filtered.filter((tx) => tx.type === "expense" && tx.category !== "Transfer").forEach((tx) => {
      c[tx.category] = (c[tx.category] || 0) + tx.amount;
    });
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const upcoming = useMemo(() =>
    [...(settings.recurring || []), ...(settings.subscriptions || [])]
      .filter((r) => r.active !== false && r.nextDate)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
      .slice(0, 5),
    [settings]
  );

  const topMerchants = useMemo(() => {
    const m: Record<string, { name: string; total: number; count: number }> = {};
    filtered.filter((tx) => tx.type === "expense" && tx.category !== "Transfer").forEach((tx) => {
      const key = tx.merchant.toLowerCase();
      if (!m[key]) m[key] = { name: tx.merchant, total: 0, count: 0 };
      m[key].total += tx.amount;
      m[key].count++;
    });
    return Object.values(m).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [filtered]);

  const spendingByBank = useMemo(() => {
    const b: Record<string, { bank: string; spending: number; income: number }> = {};
    filtered.filter((tx) => tx.category !== "Transfer").forEach((tx) => {
      const key = tx.bank || "Unknown";
      if (!b[key]) b[key] = { bank: key, spending: 0, income: 0 };
      if (tx.type === "expense") b[key].spending += tx.amount;
      else b[key].income += tx.amount;
    });
    return Object.values(b).sort((a, b) => b.spending - a.spending);
  }, [filtered]);

  const dailySpending = useMemo(() => {
    const days: Record<string, number> = {};
    filtered.filter((tx) => tx.type === "expense" && tx.category !== "Transfer").forEach((tx) => {
      days[tx.date] = (days[tx.date] || 0) + tx.amount;
    });
    return Object.entries(days)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);
  }, [filtered]);

  const avgDaily = dailySpending.length > 0 ? dailySpending.reduce((s, d) => s + d.amount, 0) / dailySpending.length : 0;

  const sortedActivity = useMemo(() =>
    [...filtered].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)),
    [filtered]
  );
  const activityLimit = showAllActivity ? 25 : 8;

  const largestExpense = useMemo(() => {
    const expenses = filtered.filter((tx) => tx.type === "expense" && tx.category !== "Transfer");
    return expenses.length > 0 ? expenses.reduce((max, tx) => tx.amount > max.amount ? tx : max, expenses[0]) : null;
  }, [filtered]);

  const balances = (settings.statementBalances || []).sort((a, b) => b.statementDate.localeCompare(a.statementDate));
  const unpaidBalances = balances.filter((b) => !b.paid);
  const totalOwing = unpaidBalances.reduce((s, b) => s + b.balance, 0);

  const togglePaid = async (id: string) => {
    const updated = balances.map((b) => b.id === id ? { ...b, paid: !b.paid } : b);
    await saveSettings({ ...settings, statementBalances: updated });
  };

  const removeBalance = async (id: string) => {
    const updated = balances.filter((b) => b.id !== id);
    await saveSettings({ ...settings, statementBalances: updated });
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <PeriodSelector value={period} onChange={setPeriod} />
        <select value={bankF} onChange={(e) => setBankF(e.target.value)}
          style={{ padding: "8px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, background: t.selectBg, color: t.text }}>
          <option value="all">All banks</option>
          {allBanks.map((b) => <option key={b}>{b}</option>)}
        </select>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 20 }}>
        <Card>
          <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Net Worth</p>
          {nw !== null
            ? <p style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: "4px 0" }}>{fmt(nw)}</p>
            : <>
                <p style={{ fontSize: 18, fontWeight: 600, color: t.textQuat, margin: "4px 0" }}>Not set</p>
                <p style={{ fontSize: 12, color: t.textQuat, margin: 0, cursor: "pointer" }} onClick={() => setTab("settings")}>Set up in Settings →</p>
              </>}
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>Assets − Liabilities</p>
        </Card>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Income</p>
            <ArrowUpRight size={14} color={t.green} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, color: t.green, margin: "4px 0" }}>{fmt(filteredIncome)}</p>
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>{filtered.filter((tx) => tx.type === "income" && tx.category !== "Transfer").length} transactions</p>
        </Card>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Spending</p>
            <ArrowDownRight size={14} color={t.orange} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, color: t.orange, margin: "4px 0" }}>{fmt(filteredSpending)}</p>
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>{filtered.filter((tx) => tx.type === "expense" && tx.category !== "Transfer").length} transactions</p>
        </Card>
        <Card>
          <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Savings Rate</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: filteredSavingsRate >= 0 ? t.green : t.red, margin: "4px 0" }}>{fmtPct(filteredSavingsRate)}</p>
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>{filteredIncome > 0 ? "(Income − Spending) / Income" : "No trend yet"}</p>
        </Card>
        {largestExpense && (
          <Card>
            <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Largest Expense</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: t.red, margin: "4px 0" }}>{fmt(largestExpense.amount)}</p>
            <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{largestExpense.merchant}</p>
          </Card>
        )}
        {avgDaily > 0 && (
          <Card>
            <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Avg Daily Spending</p>
            <p style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: "4px 0" }}>{fmt(avgDaily)}</p>
            <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>Over {dailySpending.length} days</p>
          </Card>
        )}
      </div>

      {/* Statement Balances */}
      {balances.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard size={18} color={t.orange} />
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Statement Balances</h3>
            </div>
            {totalOwing > 0 && (
              <span style={{ fontSize: 14, fontWeight: 700, color: t.red }}>Total owing: {fmt(totalOwing)}</span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 8 }}>
            {balances.slice(0, 6).map((b) => (
              <div key={b.id} style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${b.paid ? t.green + "44" : t.cardBorder}`, background: b.paid ? t.greenBg : t.rowAlt, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: t.text }}>{b.bank}</p>
                  <p style={{ margin: "2px 0 0", fontSize: 12, color: t.textQuat }}>
                    {b.statementDate}{b.dueDate ? ` · Due: ${b.dueDate}` : ""}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: b.paid ? t.green : t.red }}>{fmt(b.balance)}</span>
                  <button onClick={() => togglePaid(b.id)} title={b.paid ? "Mark as unpaid" : "Mark as paid"}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                    <CheckCircle size={20} color={b.paid ? t.green : t.textQuat} fill={b.paid ? t.greenBg : "none"} />
                  </button>
                  <button onClick={() => { if (confirm("Remove this statement balance?")) removeBalance(b.id); }} title="Remove"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 2, opacity: 0.5 }}>
                    <Trash2 size={16} color={t.textQuat} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Cash Flow</h3>
          {chartData.length === 0
            ? <EmptyState icon={TrendingUp} title="No data yet" desc="Import or add transactions to see cash flow." />
            : <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: t.textTer }} tickFormatter={(v) => v.slice(5)} stroke={t.cardBorder} />
                  <YAxis tick={{ fontSize: 11, fill: t.textTer }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} stroke={t.cardBorder} />
                  <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 8, color: t.text }} formatter={(v) => fmt(Number(v))} />
                  <Area type="monotone" dataKey="Income" stroke={t.green} fill={t.greenBg} strokeWidth={2} />
                  <Area type="monotone" dataKey="Expenses" stroke={t.orange} fill={t.orangeBg} strokeWidth={2} />
                  <Legend />
                </AreaChart>
              </ResponsiveContainer>}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Spending by Category</h3>
          {catData.length === 0
            ? <EmptyState icon={Target} title="No expenses yet" desc="Add expenses to see breakdown." />
            : <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ResponsiveContainer width="50%" height={180}>
                  <PieChart><Pie data={catData} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>{catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie></PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, fontSize: 12 }}>
                  {catData.slice(0, 6).map((c, i) => (
                    <div key={c.name} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, color: t.textSec }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: PIE_COLORS[i % PIE_COLORS.length], display: "inline-block" }} />{c.name}
                      </span>
                      <span style={{ fontWeight: 600, color: t.text }}>{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </div>}
        </Card>
      </div>

      {/* Daily spending + spending by bank */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16, marginBottom: 16 }}>
        {dailySpending.length > 0 && (
          <Card>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Daily Spending</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={dailySpending}>
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: t.textTer }} tickFormatter={(v) => v.slice(8)} stroke={t.cardBorder} />
                <YAxis tick={{ fontSize: 11, fill: t.textTer }} tickFormatter={(v) => `$${v}`} stroke={t.cardBorder} />
                <Tooltip contentStyle={{ background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 8, color: t.text }} formatter={(v) => fmt(Number(v))} labelFormatter={(l) => l} />
                <Bar dataKey="amount" fill={t.violet} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p style={{ margin: "8px 0 0", fontSize: 12, color: t.textQuat, textAlign: "center" }}>Avg: {fmt(avgDaily)}/day</p>
          </Card>
        )}

        {spendingByBank.length > 1 && (
          <Card>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>By Account</h3>
            {spendingByBank.map((b) => {
              const maxVal = Math.max(...spendingByBank.map((x) => x.spending));
              const pct = maxVal > 0 ? (b.spending / maxVal) * 100 : 0;
              return (
                <div key={b.bank} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                    <span style={{ color: t.textSec, fontWeight: 500 }}>{b.bank}</span>
                    <span style={{ color: t.text, fontWeight: 600 }}>{fmt(b.spending)}</span>
                  </div>
                  <div style={{ height: 6, background: t.rowAlt, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: t.violet, borderRadius: 3 }} />
                  </div>
                  {b.income > 0 && <p style={{ margin: "2px 0 0", fontSize: 11, color: t.green }}>+{fmt(b.income)} income</p>}
                </div>
              );
            })}
          </Card>
        )}
      </div>

      {/* Activity + sidebar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Recent Activity</h3>
            {filtered.length > activityLimit && (
              <button onClick={() => setShowAllActivity(!showAllActivity)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: t.violet, fontWeight: 500 }}>
                {showAllActivity ? "Show less" : `View all (${filtered.length})`}
              </button>
            )}
          </div>
          {sortedActivity.length === 0
            ? <p style={{ fontSize: 14, color: t.textQuat }}>No transactions in this period.</p>
            : sortedActivity.slice(0, activityLimit).map((tx) => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.merchant}</p>
                    <p style={{ margin: 0, fontSize: 12, color: t.textQuat }}>{tx.date} · {tx.category} · {tx.bank}</p>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: tx.type === "income" ? t.green : t.text, whiteSpace: "nowrap", marginLeft: 12 }}>
                    {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
          {!showAllActivity && sortedActivity.length > activityLimit && (
            <button onClick={() => setShowAllActivity(true)} style={{ width: "100%", padding: "10px 0", marginTop: 8, background: "none", border: `1px solid ${t.cardBorder}`, borderRadius: 8, cursor: "pointer", fontSize: 13, color: t.violet, fontWeight: 500 }}>
              Show {sortedActivity.length - activityLimit} more transactions
            </button>
          )}
          {sortedActivity.length > 0 && (
            <button onClick={() => setTab("transactions")} style={{ width: "100%", padding: "8px 0", marginTop: 8, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: t.textQuat }}>
              Go to Transactions →
            </button>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Top Merchants</h3>
            {topMerchants.length === 0
              ? <EmptyState icon={ShoppingBag} title="No expenses" desc="Import transactions to see top merchants." />
              : topMerchants.map((m, i) => {
                  const maxVal = topMerchants[0].total;
                  const pct = maxVal > 0 ? (m.total / maxVal) * 100 : 0;
                  return (
                    <div key={m.name} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}>
                        <span style={{ color: t.textSec, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                          <span style={{ color: t.textQuat, fontSize: 11, marginRight: 6 }}>#{i + 1}</span>{m.name}
                        </span>
                        <span style={{ color: t.text, fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>{fmt(m.total)}</span>
                      </div>
                      <div style={{ height: 4, background: t.rowAlt, borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 2 }} />
                      </div>
                      <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textQuat }}>{m.count} transaction{m.count > 1 ? "s" : ""}</p>
                    </div>
                  );
                })}
          </Card>

          <Card>
            <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Insights & Upcoming</h3>
            {needsReview > 0 && (
              <div onClick={() => setTab("transactions")} style={{ padding: "8px 12px", background: t.orangeBg, borderRadius: 8, marginBottom: 8, fontSize: 13, color: t.orange, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <AlertCircle size={14} />{needsReview} transaction{needsReview > 1 ? "s" : ""} need review
              </div>
            )}
            {detectedRecurring.length > 0 && (
              <div onClick={() => setTab("recurring")} style={{ padding: "8px 12px", background: t.blueBg, borderRadius: 8, marginBottom: 8, fontSize: 13, color: t.blue, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                <Repeat size={14} />{detectedRecurring.length} recurring pattern{detectedRecurring.length > 1 ? "s" : ""} detected
              </div>
            )}
            <h4 style={{ margin: "12px 0 8px", fontSize: 13, fontWeight: 600, color: t.textSec }}>Coming Up</h4>
            {upcoming.length === 0
              ? <p style={{ fontSize: 13, color: t.textQuat, margin: 0 }}>No upcoming payments. <span style={{ color: t.violet, cursor: "pointer" }} onClick={() => setTab("recurring")}>Set up recurring →</span></p>
              : upcoming.map((u, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13, color: t.textSec }}>
                    <span>{u.name}</span><span>{u.nextDate} · {fmt(u.amount)}</span>
                  </div>
                ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
