"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Target, AlertCircle, Repeat } from "lucide-react";
import { Card, PeriodSelector, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import { PIE_COLORS } from "@/app/lib/constants";
import { fmt, fmtPct } from "@/app/lib/helpers";
import type { Transaction, Settings, DetectedPattern } from "@/app/lib/types";

interface Props {
  settings: Settings;
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

export default function DashboardPage({ settings, period, setPeriod, filteredByPeriod, income, spending, savingsRate, detectedRecurring, setTab }: Props) {
  const { t } = useTheme();
  const nw = settings.netWorthConfigured ? settings.assets - settings.liabilities : null;
  const needsReview = filteredByPeriod.filter((tx) => tx.category === "Needs review").length;

  const chartData = useMemo(() => {
    const mo: Record<string, { month: string; Income: number; Expenses: number }> = {};
    filteredByPeriod.forEach((tx) => {
      const m = tx.date.slice(0, 7);
      if (!mo[m]) mo[m] = { month: m, Income: 0, Expenses: 0 };
      if (tx.type === "income") mo[m].Income += tx.amount;
      else mo[m].Expenses += tx.amount;
    });
    return Object.values(mo).sort((a, b) => a.month.localeCompare(b.month)).slice(-7);
  }, [filteredByPeriod]);

  const catData = useMemo(() => {
    const c: Record<string, number> = {};
    filteredByPeriod.filter((tx) => tx.type === "expense").forEach((tx) => {
      c[tx.category] = (c[tx.category] || 0) + tx.amount;
    });
    return Object.entries(c).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredByPeriod]);

  const upcoming = useMemo(() =>
    [...(settings.recurring || []), ...(settings.subscriptions || [])]
      .filter((r) => r.active !== false && r.nextDate)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
      .slice(0, 3),
    [settings]
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}><PeriodSelector value={period} onChange={setPeriod} /></div>
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
          <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Income</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: t.green, margin: "4px 0" }}>{fmt(income)}</p>
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>{filteredByPeriod.filter((tx) => tx.type === "income").length} transactions</p>
        </Card>
        <Card>
          <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Spending</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: t.orange, margin: "4px 0" }}>{fmt(spending)}</p>
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>{filteredByPeriod.filter((tx) => tx.type === "expense").length} transactions</p>
        </Card>
        <Card>
          <p style={{ fontSize: 12, color: t.textTer, margin: 0 }}>Savings Rate</p>
          <p style={{ fontSize: 24, fontWeight: 700, color: savingsRate >= 0 ? t.green : t.red, margin: "4px 0" }}>{fmtPct(savingsRate)}</p>
          <p style={{ fontSize: 11, color: t.textQuat, margin: "4px 0 0" }}>{income > 0 ? "(Income − Spending) / Income" : "No trend yet"}</p>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 16 }}>
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

        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Recent Activity</h3>
          {filteredByPeriod.length === 0
            ? <p style={{ fontSize: 14, color: t.textQuat }}>No transactions in this period.</p>
            : filteredByPeriod.slice(0, 5).map((tx) => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.text }}>{tx.merchant}</p>
                    <p style={{ margin: 0, fontSize: 12, color: t.textQuat }}>{tx.date} · {tx.category} · {tx.bank}</p>
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: tx.type === "income" ? t.green : t.text }}>
                    {tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
        </Card>

        <Card>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600, color: t.text }}>Insights & Upcoming</h3>
          {needsReview > 0 && (
            <div style={{ padding: "8px 12px", background: t.orangeBg, borderRadius: 8, marginBottom: 8, fontSize: 13, color: t.orange, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={14} />{needsReview} transaction{needsReview > 1 ? "s" : ""} need review
            </div>
          )}
          {detectedRecurring.length > 0 && (
            <div style={{ padding: "8px 12px", background: t.blueBg, borderRadius: 8, marginBottom: 8, fontSize: 13, color: t.blue, display: "flex", alignItems: "center", gap: 6 }}>
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
  );
}
