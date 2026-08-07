"use client";

import { useState } from "react";
import { Plus, Trash2, X, AlertTriangle, Building2 } from "lucide-react";
import { Card, Btn, Modal, Input, EmptyState } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import SimpleNameModal from "@/app/components/modals/SimpleNameModal";
import { fmt, isoNow } from "@/app/lib/helpers";
import type { Settings } from "@/app/lib/types";

interface Props {
  settings: Settings;
  saveSettings: (s: Settings) => Promise<void>;
  showToast: (msg: string, type?: "success" | "error") => void;
  wipeAll: () => Promise<void>;
}

export default function SettingsPage({ settings, saveSettings, showToast, wipeAll }: Props) {
  const { t } = useTheme();
  const [assets, setAssets] = useState(String(settings.assets || 0));
  const [liab, setLiab] = useState(String(settings.liabilities || 0));
  const [wipeC, setWipeC] = useState(false);
  const [wipeT, setWipeT] = useState("");
  const [addCat, setAddCat] = useState(false);
  const [addAcct, setAddAcct] = useState(false);
  const [addBank, setAddBank] = useState(false);
  const nwP = Number(assets) - Number(liab);

  const saveNW = async () => {
    await saveSettings({ ...settings, assets: Number(assets), liabilities: Number(liab), netWorthConfigured: true });
    showToast("Net worth saved");
  };
  const addItem = async (k: keyof Settings, name: string) => {
    const list = (settings[k] as string[]) || [];
    if (list.some((x) => x.toLowerCase() === name.toLowerCase())) { showToast("Exists", "error"); return; }
    await saveSettings({ ...settings, [k]: [...list, name] }); showToast("Added");
  };
  const rmItem = async (k: keyof Settings, name: string) => {
    await saveSettings({ ...settings, [k]: ((settings[k] as string[]) || []).filter((x) => x !== name) }); showToast("Removed");
  };
  const restoreDismissed = async () => {
    await saveSettings({ ...settings, dismissedPatterns: [] }); showToast("Restored");
  };
  const doWipe = async () => { await wipeAll(); setWipeC(false); setWipeT(""); };

  const sections = [
    { key: "categories" as const, label: "Categories", modal: addCat, setModal: setAddCat },
    { key: "accounts" as const, label: "Accounts", modal: addAcct, setModal: setAddAcct },
    { key: "banks" as const, label: "Banks / Institutions", modal: addBank, setModal: setAddBank },
  ];

  return (
    <div style={{ maxWidth: 640 }}>
      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: t.text }}>Net Worth</h3>
        <p style={{ fontSize: 12, color: t.textTer, margin: "0 0 12px" }}>Assets − Liabilities. Separate from monthly income/expenses.</p>
        <Input label="Total Assets" value={assets} onChange={setAssets} type="number" />
        <Input label="Total Liabilities" value={liab} onChange={setLiab} type="number" />
        <p style={{ fontSize: 14, fontWeight: 600, color: nwP >= 0 ? t.green : t.red, margin: "0 0 12px" }}>Preview: {fmt(nwP)}</p>
        <Btn onClick={saveNW}>Save</Btn>
      </Card>

      {sections.map((sec) => (
        <Card key={sec.key} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: t.text }}>{sec.label}</h3>
            <Btn small onClick={() => sec.setModal(true)}><Plus size={14} />Add</Btn>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {((settings[sec.key] as string[]) || []).map((item) => (
              <div key={item} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: t.rowAlt, borderRadius: 8, fontSize: 13, color: t.textSec }}>
                {sec.key === "banks" && <Building2 size={12} color={t.textTer} />}
                {item}
                <button onClick={() => rmItem(sec.key, item)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <X size={12} color={t.textQuat} />
                </button>
              </div>
            ))}
          </div>
          <SimpleNameModal open={sec.modal} onClose={() => sec.setModal(false)} title={`Add ${sec.label.replace(/s$/, "").replace(/ \/ Institution/, "")}`} label="Name" onSave={(n) => { addItem(sec.key, n); sec.setModal(false); }} />
        </Card>
      ))}

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: t.text }}>Detection Settings</h3>
        <p style={{ fontSize: 12, color: t.textTer, margin: "0 0 8px" }}>Ledgerly analyzes expenses to detect recurring patterns and subscriptions.</p>
        <p style={{ fontSize: 13, color: t.textSec }}>Ignored: <strong>{(settings.dismissedPatterns || []).length}</strong></p>
        {(settings.dismissedPatterns || []).length > 0 && <Btn small variant="secondary" onClick={restoreDismissed}>Restore ignored</Btn>}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: t.text }}>Google Drive Sync</h3>
        <p style={{ fontSize: 13, color: t.textSec, margin: "0 0 4px" }}>Folder: {settings.driveFolderName || "Not configured"}</p>
        <p style={{ fontSize: 12, color: t.textQuat, margin: "0 0 4px" }}>Last sync: {settings.lastDriveSync || "Never"} · Files: {(settings.processedDriveFiles || []).length}</p>
        {settings.driveResetAt && <p style={{ fontSize: 12, color: t.orange, margin: "0 0 4px" }}>Reset at: {settings.driveResetAt}</p>}
        <p style={{ fontSize: 12, color: t.textTer, margin: "8px 0", lineHeight: 1.4 }}>Add files to your Ledgerly Financial Inbox on Drive, then ask Claude to sync.</p>
        <Btn small variant="secondary" onClick={async () => { await saveSettings({ ...settings, processedDriveFiles: [], driveResetAt: isoNow() }); showToast("Cleared"); }}>
          Clear sync history
        </Btn>
      </Card>

      <Card style={{ borderColor: t.red + "33" }}>
        <h3 style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600, color: t.red }}>Danger Zone</h3>
        <p style={{ fontSize: 12, color: t.textTer, margin: "0 0 12px" }}>Permanently delete all Ledgerly data. Drive files remain.</p>
        <Btn variant="danger" small onClick={() => setWipeC(true)}><Trash2 size={14} />Erase all data</Btn>
      </Card>

      <Modal open={wipeC} onClose={() => { setWipeC(false); setWipeT(""); }} title="Erase All Data">
        <div style={{ textAlign: "center" }}>
          <AlertTriangle size={40} color={t.red} style={{ marginBottom: 8 }} />
          <h3 style={{ margin: "0 0 8px", color: t.red }}>Erase All Data</h3>
          <p style={{ fontSize: 13, color: t.textTer, margin: "0 0 4px" }}>This permanently deletes everything. Drive files remain.</p>
          <Input label='Type "DELETE" to confirm' value={wipeT} onChange={setWipeT} placeholder="DELETE" />
          <Btn variant="danger" onClick={doWipe} disabled={wipeT !== "DELETE"} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
            <Trash2 size={14} />Permanently erase
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
