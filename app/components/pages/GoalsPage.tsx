"use client";

import { useState } from "react";
import { Plus, Edit3, Trash2, PiggyBank } from "lucide-react";
import { Card, Btn, EmptyState, ProgressBar } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import GoalModal from "@/app/components/modals/GoalModal";
import { uuid, fmt, fmtPct } from "@/app/lib/helpers";
import type { Settings, Goal } from "@/app/lib/types";

interface Props {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function GoalsPage({ settings, saveSettings, showToast }: Props) {
  const { t } = useTheme();
  const [addM, setAddM] = useState(false);
  const [editI, setEditI] = useState<Goal | null>(null);
  const goals = settings.goals || [];

  const sv = async (g: Goal) => {
    const ng = g.id ? goals.map((x) => x.id === g.id ? g : x) : [...goals, { ...g, id: uuid() }];
    await saveSettings({ ...settings, goals: ng });
    showToast("Saved"); setAddM(false); setEditI(null);
  };
  const rm = async (id: string) => {
    await saveSettings({ ...settings, goals: goals.filter((g) => g.id !== id) });
    showToast("Removed");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Savings Goals</h3>
        <Btn small onClick={() => setAddM(true)}><Plus size={14} />Create goal</Btn>
      </div>

      {goals.length === 0
        ? <EmptyState icon={PiggyBank} title="No goals yet" desc="Set a savings goal." action={<Btn small onClick={() => setAddM(true)}>Create goal</Btn>} />
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12 }}>
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0;
              return (
                <Card key={g.id}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>{g.name}</h4>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setEditI(g)} style={{ background: "none", border: "none", cursor: "pointer" }}><Edit3 size={14} color={t.textTer} /></button>
                      <button onClick={() => rm(g.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={t.textQuat} /></button>
                    </div>
                  </div>
                  {g.dueDate && <p style={{ margin: "2px 0", fontSize: 12, color: t.textQuat }}>Due: {g.dueDate}</p>}
                  <div style={{ margin: "12px 0" }}><ProgressBar value={g.current} max={g.target} color={t.green} height={10} /></div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: t.textSec }}>
                    <span>{fmt(g.current)} saved</span><span>{fmt(g.target)} target</span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: t.green, fontWeight: 600 }}>{fmtPct(pct)} · {fmt(g.target - g.current)} to go</p>
                  {g.note && <p style={{ margin: "8px 0 0", fontSize: 12, color: t.textQuat, fontStyle: "italic" }}>{g.note}</p>}
                </Card>
              );
            })}
          </div>}

      <GoalModal open={addM || !!editI} onClose={() => { setAddM(false); setEditI(null); }} item={editI} onSave={sv} />
    </div>
  );
}
