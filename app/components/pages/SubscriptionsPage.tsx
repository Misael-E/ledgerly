"use client";

import { useState } from "react";
import { Plus, Edit3, Trash2, CreditCard } from "lucide-react";
import { Card, Btn, EmptyState } from "@/app/components/ui";
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

export default function SubscriptionsPage({ settings, saveSettings, detectedRecurring, showToast }: Props) {
  const { t } = useTheme();
  const [addM, setAddM] = useState(false);
  const [editI, setEditI] = useState<RecurringItem | null>(null);
  const subs = settings.subscriptions || [];
  const subS = detectedRecurring.filter((d) => d.isSub);
  const mo = subs.filter((s) => s.active !== false).reduce((s, r) => s + (r.amount || 0), 0);

  const keep = async (d: DetectedPattern) => {
    await saveSettings({ ...settings, subscriptions: [...subs, { id: uuid(), name: d.merchant, category: "Subscriptions", amount: d.avgAmount, cadence: d.cadence, nextDate: d.nextDate, active: true }] });
    showToast("Saved");
  };
  const dismiss = async (k: string) => {
    await saveSettings({ ...settings, dismissedPatterns: [...(settings.dismissedPatterns || []), k] });
  };
  const rm = async (id: string) => {
    await saveSettings({ ...settings, subscriptions: subs.filter((s) => s.id !== id) });
    showToast("Removed");
  };
  const sv = async (item: RecurringItem) => {
    const ns = item.id ? subs.map((s) => s.id === item.id ? item : s) : [...subs, { ...item, id: uuid() }];
    await saveSettings({ ...settings, subscriptions: ns });
    showToast("Saved"); setAddM(false); setEditI(null);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 200 }}><p style={{ margin: 0, fontSize: 12, color: t.textTer }}>Monthly</p><p style={{ margin: "4px 0", fontSize: 22, fontWeight: 700, color: t.text }}>{fmt(mo)}</p></Card>
        <Card style={{ flex: 1, minWidth: 200 }}><p style={{ margin: 0, fontSize: 12, color: t.textTer }}>Annual</p><p style={{ margin: "4px 0", fontSize: 22, fontWeight: 700, color: t.text }}>{fmt(mo * 12)}</p></Card>
      </div>

      {subS.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: t.text }}>Detected Subscriptions</h3>
          {subS.map((d) => (
            <Card key={d.key} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: t.text }}>{d.merchant}</p>
                  <p style={{ margin: "2px 0", fontSize: 12, color: t.textTer }}>{d.cadence} · {d.occurrences}x · {d.confidence}</p>
                  <p style={{ margin: 0, fontSize: 12, color: t.textQuat }}>{fmt(d.avgAmount)} · ~{fmt(d.monthly)}/mo · Next: {d.nextDate}</p>
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

      {subs.length === 0
        ? <EmptyState icon={CreditCard} title="No subscriptions" desc="Keep a pattern or add manually." />
        : subs.map((s) => (
            <Card key={s.id} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 600, fontSize: 14, color: t.text }}>{s.name}</p>
                  <p style={{ margin: "2px 0", fontSize: 12, color: t.textTer }}>{s.cadence} · {fmt(s.amount)} · Next: {s.nextDate || "—"}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditI(s)} style={{ background: "none", border: "none", cursor: "pointer" }}><Edit3 size={14} color={t.textTer} /></button>
                  <button onClick={() => rm(s.id)} style={{ background: "none", border: "none", cursor: "pointer" }}><Trash2 size={14} color={t.textQuat} /></button>
                </div>
              </div>
            </Card>
          ))}

      <RecItemModal open={addM || !!editI} onClose={() => { setAddM(false); setEditI(null); }} item={editI} onSave={sv} settings={settings} />
    </div>
  );
}
