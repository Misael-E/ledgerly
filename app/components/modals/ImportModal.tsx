"use client";

import { useState, useRef } from "react";
import { Upload, Check, FileText, FileSpreadsheet } from "lucide-react";
import { Modal, Btn, Input, Select } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import type { Settings, ImportResult } from "@/app/lib/types";
import type { BankFormat } from "@/app/lib/pdf-parser";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  onImport: (rows: Record<string, unknown>[], bank: string) => Promise<ImportResult>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

const BANK_FORMATS: { value: BankFormat; label: string }[] = [
  { value: "scotiabank", label: "Scotiabank" },
  { value: "bmo", label: "BMO" },
  { value: "amex", label: "Amex" },
  { value: "neo", label: "Neo Financial" },
  { value: "cibc", label: "CIBC" },
];

export default function ImportModal({ open, onClose, settings, saveSettings, onImport, showToast }: Props) {
  const { t } = useTheme();
  const [mode, setMode] = useState<"choose" | "csv" | "pdf">("choose");
  const [step, setStep] = useState(1);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [bank, setBank] = useState(settings.banks?.[0] || "");
  const [newBank, setNewBank] = useState("");
  const [mapping, setMapping] = useState<Record<string, number | undefined>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);

  // PDF state
  const [pdfFormat, setPdfFormat] = useState<BankFormat>("scotiabank");
  const [pdfParsed, setPdfParsed] = useState<{ date: string; merchant: string; amount: number; type: string }[]>([]);
  const [pdfRawText, setPdfRawText] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showRaw, setShowRaw] = useState(false);

  const reset = () => {
    setMode("choose"); setStep(1); setHeaders([]); setRows([]); setBank(settings.banks?.[0] || "");
    setNewBank(""); setMapping({}); setResult(null);
    setPdfParsed([]); setPdfRawText(""); setPdfLoading(false); setShowRaw(false);
  };

  // --- CSV ---
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

  const handleCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => parseCSV(ev.target?.result as string);
    r.readAsText(f);
  };

  const doCSVImport = async () => {
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

  // --- PDF ---
  const handlePDFFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPdfLoading(true);
    try {
      const { parsePDF, parseStatementRows, getRawText, extractStatementInfo } = await import("@/app/lib/pdf-parser");
      const pages = await parsePDF(f);
      setPdfRawText(getRawText(pages));
      const parsed = parseStatementRows(pages, pdfFormat);
      setPdfParsed(parsed);

      const stmtInfo = extractStatementInfo(pages, pdfFormat);
      if (stmtInfo.balance !== null && stmtInfo.balance > 0) {
        const bankName = BANK_FORMATS.find((b) => b.value === pdfFormat)?.label || pdfFormat;
        const existing = settings.statementBalances || [];
        const id = `${bankName}-${stmtInfo.statementDate || new Date().toISOString().slice(0, 10)}`;
        const prior = existing.find((s) => s.id === id);
        const entry = {
          id,
          bank: bankName,
          balance: stmtInfo.balance,
          dueDate: stmtInfo.dueDate,
          statementDate: stmtInfo.statementDate || new Date().toISOString().slice(0, 10),
          paid: prior?.paid ?? false, // preserve paid status on re-import
          importedAt: new Date().toISOString(),
        };
        // Upsert by id so re-importing a statement refreshes a stale balance
        // instead of silently keeping the old (possibly wrong) value.
        await saveSettings({
          ...settings,
          statementBalances: prior
            ? existing.map((s) => (s.id === id ? entry : s))
            : [...existing, entry],
        });
      }

      setStep(3);
    } catch (err) {
      console.error("PDF parse error:", err);
      showToast("Failed to read PDF. Try a different file or use CSV.", "error");
    }
    setPdfLoading(false);
  };

  const doPDFImport = async () => {
    const bankName = BANK_FORMATS.find((b) => b.value === pdfFormat)?.label || pdfFormat;
    const b = newBank.trim() || bankName;
    if (newBank.trim() && !settings.banks?.some((x) => x.toLowerCase() === newBank.trim().toLowerCase())) {
      await saveSettings({ ...settings, banks: [...settings.banks, newBank.trim()] });
    }
    if (!settings.banks?.some((x) => x.toLowerCase() === b.toLowerCase())) {
      await saveSettings({ ...settings, banks: [...settings.banks, b] });
    }
    const mapped = pdfParsed.map((r) => ({
      date: r.date, merchant: r.merchant, amount: r.amount,
      type: r.type, category: "Needs review", account: "Imported account", bank: b,
    }));
    const res = await onImport(mapped as Record<string, unknown>[], b);
    setResult(res);
    setStep(4);
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="Import Statement" wide>
      {/* Step 0: Choose format */}
      {mode === "choose" && step === 1 && (
        <div>
          <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 16px" }}>Choose your statement format:</p>
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { setMode("csv"); }} style={{
              flex: 1, padding: "20px 16px", borderRadius: 12, border: `1px solid ${t.cardBorder}`,
              background: t.card, cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 8,
            }}>
              <FileSpreadsheet size={28} color={t.green} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>CSV file</span>
              <span style={{ fontSize: 12, color: t.textTer }}>Downloaded from online banking</span>
            </button>
            <button onClick={() => { setMode("pdf"); }} style={{
              flex: 1, padding: "20px 16px", borderRadius: 12, border: `1px solid ${t.cardBorder}`,
              background: t.card, cursor: "pointer", display: "flex", flexDirection: "column",
              alignItems: "center", gap: 8,
            }}>
              <FileText size={28} color={t.red} />
              <span style={{ fontSize: 14, fontWeight: 600, color: t.text }}>PDF statement</span>
              <span style={{ fontSize: 12, color: t.textTer }}>Bank or credit card statement</span>
            </button>
          </div>
        </div>
      )}

      {/* CSV flow: step 1 - file pick */}
      {mode === "csv" && step === 1 && (
        <div>
          <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 16px" }}>Select a CSV bank or card statement to import.</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVFile} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()} style={{ width: "100%", justifyContent: "center" }}><Upload size={16} />Choose CSV file</Btn>
          <div style={{ marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => { setMode("choose"); }}>Back</Btn>
          </div>
        </div>
      )}

      {/* CSV flow: step 2 - column mapping */}
      {mode === "csv" && step === 2 && (
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

      {/* CSV flow: step 3 - preview */}
      {mode === "csv" && step === 3 && (
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
            <Btn onClick={doCSVImport}>Import {rows.length} rows</Btn>
          </div>
        </div>
      )}

      {/* PDF flow: step 1 - select bank format */}
      {mode === "pdf" && step === 1 && (
        <div>
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: "0 0 12px" }}>Which bank is this PDF from?</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {BANK_FORMATS.map((b) => (
              <button key={b.value} onClick={() => setPdfFormat(b.value)} style={{
                padding: "12px 16px", borderRadius: 8, fontSize: 14, fontWeight: 500, cursor: "pointer",
                border: `2px solid ${pdfFormat === b.value ? t.violet : t.cardBorder}`,
                background: pdfFormat === b.value ? t.violetBg : t.card,
                color: pdfFormat === b.value ? t.violet : t.text,
              }}>
                {b.label}
              </button>
            ))}
          </div>
          <Input label="Custom bank name (optional)" value={newBank} onChange={setNewBank} placeholder="Override bank name..." />
          <input ref={pdfRef} type="file" accept=".pdf" onChange={handlePDFFile} style={{ display: "none" }} />
          <Btn onClick={() => pdfRef.current?.click()} disabled={pdfLoading} style={{ width: "100%", justifyContent: "center", marginTop: 12 }}>
            <Upload size={16} />{pdfLoading ? "Reading PDF..." : "Choose PDF file"}
          </Btn>
          <div style={{ marginTop: 12 }}>
            <Btn variant="secondary" onClick={() => { setMode("choose"); setStep(1); }}>Back</Btn>
          </div>
        </div>
      )}

      {/* PDF flow: step 2 - skipped, goes straight to 3 */}

      {/* PDF flow: step 3 - preview parsed transactions */}
      {mode === "pdf" && step === 3 && (
        <div>
          <p style={{ fontSize: 14, color: t.textSec, margin: "0 0 8px" }}>
            Found <strong>{pdfParsed.length}</strong> transactions from <strong>{newBank.trim() || BANK_FORMATS.find((b) => b.value === pdfFormat)?.label}</strong>
          </p>
          {pdfParsed.length === 0 ? (
            <div>
              <p style={{ fontSize: 13, color: t.orange, margin: "0 0 12px" }}>
                No transactions could be extracted. The PDF format may not match the selected bank, or the statement layout is different than expected.
              </p>
              <button onClick={() => setShowRaw(!showRaw)} style={{ background: "none", border: "none", color: t.violet, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 8 }}>
                {showRaw ? "Hide" : "Show"} raw extracted text
              </button>
              {showRaw && (
                <pre style={{ maxHeight: 200, overflowY: "auto", padding: 12, background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, fontSize: 11, color: t.textSec, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {pdfRawText}
                </pre>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Btn variant="secondary" onClick={() => setStep(1)}>Try again</Btn>
              </div>
            </div>
          ) : (
            <>
              <div style={{ maxHeight: 250, overflowY: "auto", border: `1px solid ${t.cardBorder}`, borderRadius: 8, marginBottom: 12 }}>
                <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: t.rowAlt, position: "sticky", top: 0 }}>
                      <th style={{ padding: "6px 8px", textAlign: "left", color: t.textSec }}>Date</th>
                      <th style={{ padding: "6px 8px", textAlign: "left", color: t.textSec }}>Merchant</th>
                      <th style={{ padding: "6px 8px", textAlign: "right", color: t.textSec }}>Amount</th>
                      <th style={{ padding: "6px 8px", textAlign: "center", color: t.textSec }}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pdfParsed.slice(0, 20).map((r, i) => (
                      <tr key={i} style={{ borderTop: `1px solid ${t.cardBorder}` }}>
                        <td style={{ padding: "4px 8px", color: t.text }}>{r.date}</td>
                        <td style={{ padding: "4px 8px", color: t.text }}>{r.merchant}</td>
                        <td style={{ padding: "4px 8px", textAlign: "right", color: t.text }}>${r.amount.toFixed(2)}</td>
                        <td style={{ padding: "4px 8px", textAlign: "center", color: r.type === "income" ? t.green : t.orange, fontSize: 11 }}>
                          {r.type === "income" ? "Credit" : "Debit"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pdfParsed.length > 20 && (
                <p style={{ fontSize: 12, color: t.textQuat, margin: "0 0 8px" }}>Showing 20 of {pdfParsed.length} transactions</p>
              )}
              <button onClick={() => setShowRaw(!showRaw)} style={{ background: "none", border: "none", color: t.violet, fontSize: 12, cursor: "pointer", padding: 0, marginBottom: 12 }}>
                {showRaw ? "Hide" : "Show"} raw extracted text
              </button>
              {showRaw && (
                <pre style={{ maxHeight: 150, overflowY: "auto", padding: 12, background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, fontSize: 11, color: t.textSec, whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 12 }}>
                  {pdfRawText}
                </pre>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="secondary" onClick={() => setStep(1)}>Back</Btn>
                <Btn onClick={doPDFImport}>Import {pdfParsed.length} transactions</Btn>
              </div>
            </>
          )}
        </div>
      )}

      {/* Shared: step 4 - result */}
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
