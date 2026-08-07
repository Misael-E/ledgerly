"use client";

import { useState, useEffect } from "react";
import { Check } from "lucide-react";
import { Modal, Btn } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import { isoNow } from "@/app/lib/helpers";
import type { TagItem } from "@/app/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  tags: TagItem[];
  saveTags: (tags: TagItem[]) => Promise<void>;
  currentTags: string[];
  onSave: (tags: string[]) => Promise<void>;
}

export default function TagModal({ open, onClose, tags, saveTags, currentTags, onSave }: Props) {
  const { t } = useTheme();
  const [sel, setSel] = useState<string[]>([]);
  const [nw, setNw] = useState("");

  useEffect(() => { setSel([...currentTags]); }, [currentTags, open]);

  const toggle = (n: string) => setSel((s) => s.includes(n) ? s.filter((x) => x !== n) : [...s, n]);

  const addN = async () => {
    const n = nw.trim();
    if (!n) return;
    if (!tags.some((tg) => tg.name.toLowerCase() === n.toLowerCase())) {
      await saveTags([...tags, { name: n, createdAt: isoNow() }]);
    }
    setSel((s) => s.includes(n) ? s : [...s, n]);
    setNw("");
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit Tags">
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {tags.map((tg) => (
          <button key={tg.name} onClick={() => toggle(tg.name)} style={{
            padding: "6px 12px", borderRadius: 12,
            border: `1px solid ${sel.includes(tg.name) ? t.violet : t.cardBorder}`,
            background: sel.includes(tg.name) ? t.violetBg : t.card,
            fontSize: 13, cursor: "pointer", color: sel.includes(tg.name) ? t.violet : t.textSec,
          }}>
            {sel.includes(tg.name) && <Check size={12} style={{ marginRight: 4 }} />}{tg.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={nw} onChange={(e) => setNw(e.target.value)} placeholder="New tag" onKeyDown={(e) => e.key === "Enter" && addN()}
          style={{ flex: 1, padding: "8px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 13, background: t.inputBg, color: t.text }} />
        <Btn small onClick={addN} disabled={!nw.trim()}>Add</Btn>
      </div>
      <Btn onClick={() => onSave(sel)} style={{ width: "100%", justifyContent: "center" }}>Save tags</Btn>
    </Modal>
  );
}
