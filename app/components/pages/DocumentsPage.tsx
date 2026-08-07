"use client";

import { useState, useRef } from "react";
import { Upload, HardDrive, ChevronRight, FileText } from "lucide-react";
import { Card, Btn, Badge, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import { uuid, isoNow } from "@/app/lib/helpers";
import type { DocumentMeta, Settings, ImportResult } from "@/app/lib/types";

interface Props {
  documents: DocumentMeta[];
  saveDocs: (docs: DocumentMeta[]) => Promise<void>;
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  processDriveImport: (payload: string) => Promise<ImportResult>;
  showToast: (msg: string, type?: "success" | "error") => void;
}

export default function DocumentsPage({ documents, saveDocs, settings, processDriveImport, showToast }: Props) {
  const { t } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [driveJson, setDriveJson] = useState("");
  const [driveOpen, setDriveOpen] = useState(false);
  const [driveRes, setDriveRes] = useState<ImportResult | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const nd: DocumentMeta[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) { showToast(`${f.name} exceeds 20 MB`, "error"); continue; }
      nd.push({ id: uuid(), filename: f.name, mimeType: f.type, size: f.size, status: "stored", source: "upload", createdAt: isoNow() });
    }
    if (nd.length) { await saveDocs([...nd, ...documents]); showToast(`${nd.length} document(s) recorded`); }
  };

  const handleDI = async () => {
    try {
      const res = await processDriveImport(driveJson);
      setDriveRes(res); setDriveJson("");
      showToast(`${res.inserted} new, ${res.dupes} duplicates`);
    } catch (e) { showToast((e as Error).message, "error"); }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginBottom: 20 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Upload size={18} color={t.violet} /><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Upload Documents</h3>
          </div>
          <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 12px" }}>Receipts, statements, invoices — max 20 MB each.</p>
          <input ref={fileRef} type="file" multiple onChange={handleUpload} style={{ display: "none" }} />
          <Btn onClick={() => fileRef.current?.click()} style={{ width: "100%", justifyContent: "center" }}><Upload size={14} />Choose files</Btn>
        </Card>
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <HardDrive size={18} color={t.blue} /><h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>Google Drive Inbox</h3>
          </div>
          {settings.driveFolderName
            ? <>
                <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 4px" }}>Folder: <strong>{settings.driveFolderName}</strong></p>
                {settings.driveFolderUrl && <a href={settings.driveFolderUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: t.violet }}>Open in Drive →</a>}
                <p style={{ fontSize: 12, color: t.textQuat, margin: "4px 0" }}>Last sync: {settings.lastDriveSync || "Never"} · {(settings.processedDriveFiles || []).length} files processed</p>
              </>
            : <p style={{ fontSize: 13, color: t.textQuat, margin: 0 }}>Not configured. Ask Claude to set up your Drive inbox.</p>}
          <p style={{ fontSize: 12, color: t.textTer, margin: "8px 0 0", lineHeight: 1.4 }}>Drop files into your Ledgerly Financial Inbox, then ask Claude to sync.</p>
        </Card>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <button onClick={() => setDriveOpen(!driveOpen)} style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none", cursor: "pointer", width: "100%", padding: 0 }}>
          <ChevronRight size={14} color={t.textTer} style={{ transform: driveOpen ? "rotate(90deg)" : "none", transition: "0.2s" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: t.textSec }}>Import from Claude (Drive sync)</span>
        </button>
        {driveOpen && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12, color: t.textTer, margin: "0 0 8px" }}>Paste JSON from Claude:</p>
            <textarea value={driveJson} onChange={(e) => setDriveJson(e.target.value)} rows={6}
              placeholder='{"transactions":[...],"processedFiles":[...]}'
              style={{ width: "100%", padding: 10, border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical", background: t.inputBg, color: t.text }} />
            <Btn onClick={handleDI} disabled={!driveJson.trim()} style={{ marginTop: 8 }}>Process Import</Btn>
            {driveRes && <p style={{ fontSize: 12, color: t.green, margin: "8px 0 0" }}>{driveRes.inserted} new, {driveRes.dupes} duplicates</p>}
          </div>
        )}
      </Card>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px", color: t.text }}>Document Vault</h3>
      {documents.length === 0
        ? <EmptyState icon={FileText} title="No documents yet" desc="Upload a file or sync your Drive inbox." />
        : <div style={{ border: `1px solid ${t.cardBorder}`, borderRadius: 12, overflow: "hidden" }}>
            {documents.map((d, i) => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: i % 2 === 0 ? t.card : t.rowAlt, borderBottom: `1px solid ${t.cardBorder}` }}>
                <div>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: t.text }}>{d.filename}</p>
                  <p style={{ margin: 0, fontSize: 12, color: t.textQuat }}>{d.mimeType} · {(d.size / 1024).toFixed(1)} KB · {d.source}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge color={d.status === "stored" ? t.green : d.status === "review" ? t.orange : t.textTer} bg={d.status === "stored" ? t.greenBg : d.status === "review" ? t.orangeBg : t.cardBorder}>
                    {d.status}
                  </Badge>
                  <span style={{ fontSize: 11, color: t.textQuat }}>{d.createdAt?.slice(0, 10)}</span>
                </div>
              </div>
            ))}
          </div>}
    </div>
  );
}
