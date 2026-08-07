"use client";

import { useState } from "react";
import { Plus, Edit3, Trash2, Repeat, Zap } from "lucide-react";
import { Card, Btn, Badge, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import RecItemModal from "@/app/components/modals/RecItemModal";
import { uuid, fmt } from "@/app/lib/helpers";
import type { Settings, DetectedPattern, RecurringItem } from "@/app/lib/types";

interface Props {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  detectedRecurring: DetectedPattern[];
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function RecurringPage({ settings, saveSettings, detectedRecurring, showToast }: Props) {
  const { t } = useTheme();
  const [addM, setAddM] = useState(false);
  const [editI, setEditI] = useState<RecurringItem | null>(null);
  const rec = settings.recurring || [];
  const bills = detectedRecurring.filter((d) => !d.isSub);
  const mo = rec.filter((r) => r.active !== false).reduce((s, r) => s + (r.amount || 0), 0);

  const keep = async (d: DetectedPattern) => {
    await saveSettings({ ...settings, recurring: [...rec, { id: uuid(), name: d.merchant, category: d.category, amount: d.avgAmount, cadence: d.cadence, nextDate: d.nextDate, active: true }] });
    showToast("Saved");
  };
  const dismiss = async (k: string) => {
    await saveSettings({ ...settings, dismissedPatterns: [...(settings.dismissedPatterns || []), k] });
  };
  const rm = async (id: string) => {
    await saveSettings({ ...settings, recurring: rec.filter((r) => r.id !== id) });
    showToast("Removed");
  };
  const sv = async (item: RecurringItem) => {
    const nr = item.id ? rec.map((r) => r.id === item.id ? item : r) : [...rec, { ...item, id: uuid() }];
    await saveSettings({ ...settings, recurring: nr });
    showToast("Saved"); setAddM(false); setEditI(null);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 200 }}><p style={{ margin: 0, fontSize: 12, color: t.textTer }}>Monthly</p><p style={{ margin: "4px 0", fontSize: 22, fontWeight: 700, color: t.text }}>{fmt(mo)}</p></Card>
        <Card style={{ flex: 1, minWidth: 200 }}><p style={{ margin: 0, fontSize: 12, color: t.textTer }}>Annual</p><p style={{ margin: "4px 0", fontSize: 22, fontWeight: 700, color: t.text }}>{fmt(mo * 12)}</p></Card>
      </div>

      <Card style={{ background: t.blueBg, border: `1px solid ${t.blue}33`, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Zap size={16} color={t.blue} /><span style={{ fontSize: 13, color: t.blue, fontWeight: 600 }}>Active detection</span>
          <Badge color={t.blue} bg={t.card}>{bills.length}</Badge>
        </div>
      </Card>

      {bills.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: t.text }}>Detected Patterns</h3>
          {bills.map((d) => (
            <Card key={d.key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: t.text }}>{d.merchant}</p>
                  <p style={{ margin: "2px 0", fontSize: 12, color: t.textTer }}>{d.cadence} · {d.occurrences}x · {d.confidence}</p>
                  <p style={{ margin: 0, fontSize: 12, color: t.textQuat }}>Avg {fmt(d.avgAmount)} · ~{fmt(d.monthly)}/mo · Next: {d.nextDate}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn small onClick={() => keep(d)}>Keep</Btn>
                  <Btn small variant="secondary" onClick={() => dismiss(d.key)}>Ignore</Btn>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Confirmed</h3>
        <Btn small onClick={() => setAddM(true)}><Plus size={14} />Add</Btn>
      </div>

      {rec.length === 0
        ? <EmptyState icon={Repeat} title="No recurring payments" desc="Keep a pattern or add manually." />
        : rec.map((r) => (
            <Card key={r.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: t.text }}>{r.name}</p>
                  <p style={{ margin: "2px 0", fontSize: 12, color: t.textTer }}>{r.cadence} · {fmt(r.amount)} · Next: {r.nextDate || "—"}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditI(r)} style={{ background: "none", border: "none", cursor: "pointer" }}><Edit3 size={14} color={t.textTer} /></button>
                  <button onClick={() => rm(r.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={t.textQuat} /></button>
                </div>
              </div>
            </Card>
          ))}

      <RecItemModal open={addM || !!editI} onClose={() => { setAddM(false); setEditI(null); }} item={editI} onSave={sv} settings={settings} />
    </div>
  );
}
