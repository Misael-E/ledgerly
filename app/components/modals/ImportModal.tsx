"use client";

import { useState, useRef } from "react";
import { Upload, Check } from "lucide-react";
import { Modal, Btn, Input, Select } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import type { Settings, ImportResult } from "@/app/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  onImport: (rows: Record<string, unknown>[], bank: string) => Promise<ImportResult>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function ImportModal({ open, onClose, settings, saveSettings, onImport, showToast }: Props) {
  const { t } = useTheme();
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [bank, setBank] = useState(settings.banks?.[0] || "");
  const [newBank, setNewBank] = useState("");
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1); setHeaders([]); setRows([]); setBank(settings.banks?.[0] || "");
    setNewBank(""); setMapping({}); setResult(null);
  };

  const parseCSV = (text: string) => {
    const lines = text.trim().split("\n").map((l) => {
      const res: string[] = [];
      let cur = "";
      let inQ = false;
      for (let i = 0; i < l.length; i++) {
        if (l[i] === '"') inQ = !inQ;
        else if (l[i] === ',' && !inQ) { res.push(cur.trim()); cur = ""; }
        else cur += l[i];
      }
      res.push(cur.trim());
      return res;
    });
    if (lines.length < 2) return;
    const hdrs = lines[0].map((h) => h.replace(/"/g, "").trim());
    setHeaders(hdrs);
    setRows(lines.slice(1).filter((r) => r.length >= 2));
    const m: Record<string, number> = {};
    const lh = hdrs.map((h) => h.toLowerCase());
    const di = lh.findIndex((h) => h.includes("date") || h.includes("posted"));
    const mi = lh.findIndex((h) => h.includes("desc") || h.includes("merchant") || h.includes("payee") || h.includes("memo") || h.includes("narration") || h.includes("transaction details"));
    const ai = lh.findIndex((h) => h === "amount" || h.includes("amount"));
    const dbi = lh.findIndex((h) => h.includes("debit") || h.includes("withdrawal"));
    const ci = lh.findIndex((h) => h.includes("credit") || h.includes("deposit"));
    if (di >= 0) m.date = di;
    if (mi >= 0) m.merchant = mi;
    if (ai >= 0) m.amount = ai;
    if (dbi >= 0) m.debit = dbi;
    if (ci >= 0) m.credit = ci;
    setMapping(m);
    setStep(2);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => parseCSV(ev.target?.result as string);
    r.readAsText(f);
  };

  const doImport = async () => {
    const b = newBank.trim() || bank;
    if (!b) { showToast("Select a bank", "error"); return; }
    if (newBank.trim() && !settings.banks?.some((x) => x.toLowerCase() === newBank.trim().toLowerCase())) {
      await saveSettings({ ...settings, banks: [...settings.banks, newBank.trim()] });
    }
    const parsed = rows.map((r) => {
      try {
        let dv = r[mapping.date!]?.replace(/"/g, "").trim();
        if (!dv) return null;
        const d = new Date(dv);
        if (isNaN(d.getTime())) return null;
        dv = d.toISOString().slice(0, 10);
        const merch = r[mapping.merchant!]?.replace(/"/g, "").trim();
        if (!merch) return null;
        let amt = 0, tp: "expense" | "income" = "expense";
        if (mapping.amount !== undefined) {
          const raw = parseFloat(r[mapping.amount]?.replace(/[",$ ]/g, ""));
          if (isNaN(raw)) return null;
          amt = Math.abs(raw);
          tp = raw > 0 ? "expense" : "income";
        } else if (mapping.debit !== undefined || mapping.credit !== undefined) {
          const db = mapping.debit !== undefined ? parseFloat(r[mapping.debit]?.replace(/[",$ ]/g, "") || "0") : 0;
          const cr = mapping.credit !== undefined ? parseFloat(r[mapping.credit]?.replace(/[",$ ]/g, "") || "0") : 0;
          if (db && !isNaN(db) && db > 0) { amt = Math.abs(db); tp = "expense"; }
          else if (cr && !isNaN(cr) && cr > 0) { amt = Math.abs(cr); tp = "income"; }
          else return null;
        }
        if (amt <= 0) return null;
        return { date: dv, merchant: merch, amount: amt, type: tp, category: "Needs review", account: "Imported account", bank: b };
      } catch { return null; }
    }).filter(Boolean);
    const res = await onImport(parsed as Record<string, unknown>[], b);
    setResult(res);
    setStep(4);
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Import CSV Statement" wide>
      {step === 1 && (
        <div>
          <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 16px" }}>Select a CSV bank or card statement to import.</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()} style={{ width: "100%", justifyContent: "center" }}><Upload size={16} />Choose CSV file</Btn>
        </div>
      )}
      {step === 2 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 12px" }}>Which bank is this statement from?</p>
          <Select label="Select bank" value={bank} onChange={setBank} options={settings.banks || []} placeholder="Choose bank..." />
          <Input label="Or add new bank" value={newBank} onChange={setNewBank} placeholder="e.g. TD Bank" />
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "16px 0 8px" }}>Column mapping ({rows.length} rows)</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {(["date", "merchant", "amount", "debit", "credit"] as const).map((f) => (
              <Select key={f} label={f.charAt(0).toUpperCase() + f.slice(1)} value={mapping[f] ?? ""} onChange={(v) => setMapping((m) => ({ ...m, [f]: v === "" ? undefined : parseInt(v) }))} options={headers.map((h, i) => ({ value: String(i), label: h }))} placeholder="—" />
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Btn variant="secondary" onClick={() => setStep(1)}>Back</Btn>
            <Btn onClick={() => setStep(3)} disabled={mapping.date === undefined || mapping.merchant === undefined || (mapping.amount === undefined && mapping.debit === undefined)}>Preview</Btn>
          </div>
        </div>
      )}
      {step === 3 && (
        <div>
          <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 8px" }}>{rows.length} rows from <strong>{newBank.trim() || bank}</strong></p>
          <div style={{ maxHeight: 200, overflowY: "auto", border: `1px solid ${t.cardBorder}`, borderRadius: 8, marginBottom: 12 }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: t.rowAlt }}>
                  <th style={{ padding: "6px 8px", textAlign: "left", color: t.textSec }}>Date</th>
                  <th style={{ padding: "6px 8px", textAlign: "left", color: t.textSec }}>Merchant</th>
                  <th style={{ padding: "6px 8px", textAlign: "right", color: t.textSec }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                    <td style={{ padding: "4px 8px", color: t.text }}>{r[mapping.date!]}</td>
                    <td style={{ padding: "4px 8px", color: t.text }}>{r[mapping.merchant!]}</td>
                    <td style={{ padding: "4px 8px", textAlign: "right", color: t.text }}>{r[mapping.amount !== undefined ? mapping.amount : (mapping.debit || 0)]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="secondary" onClick={() => setStep(2)}>Back</Btn>
            <Btn onClick={doImport}>Import {rows.length} rows</Btn>
          </div>
        </div>
      )}
      {step === 4 && result && (
        <div style={{ textAlign: "center" }}>
          <Check size={40} color={t.green} style={{ marginBottom: 8 }} />
          <p style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Import complete</p>
          <p style={{ fontSize: 14, color: t.textSec }}>{result.inserted} imported · {result.dupes} duplicates · {result.skipped} skipped</p>
          <Btn onClick={() => { reset(); onClose(); }} style={{ marginTop: 12 }}>Done</Btn>
        </div>
      )}
    </Modal>
  );
}
