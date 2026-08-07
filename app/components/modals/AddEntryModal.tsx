"use client";

import { useState } from "react";
import { Modal, Btn, Input, Select } from "@/app/components/ui";
import { useTheme } from "@/app/components/ThemeProvider";
import { DEFAULT_CATEGORIES, DEFAULT_ACCOUNTS, DEFAULT_BANKS } from "@/app/lib/constants";
import { today } from "@/app/lib/helpers";
import type { Settings, TagItem, Transaction } from "@/app/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  tags: TagItem[];
  saveTags: (tags: TagItem[]) => Promise<void>;
  onSave: (tx: Partial<Transaction>) => Promise<boolean>;
}

export default function AddEntryModal({ open, onClose, settings, tags, onSave }: Props) {
  const { t } = useTheme();
  const [type, setType] = useState<"expense" | "income">("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState("Needs review");
  const [account, setAccount] = useState(settings.accounts?.[0] || "");
  const [bank, setBank] = useState(settings.banks?.[0] || "");
  const [selTags, setSelTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType("expense"); setAmount(""); setMerchant(""); setDate(today());
    setCategory("Needs review"); setAccount(settings.accounts?.[0] || "");
    setBank(settings.banks?.[0] || ""); setSelTags([]);
  };

  const save = async () => {
    if (!merchant.trim() || !amount || isNaN(Number(amount)) || Number(amount) <= 0) return;
    setSaving(true);
    const ok = await onSave({
      date, merchant: merchant.trim(), category, amount: Number(amount),
      type, account, bank, tags: selTags, receipt: false,
    });
    setSaving(false);
    if (ok) { reset(); onClose(); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add entry">
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {(["expense", "income"] as const).map((v) => (
          <button key={v} onClick={() => setType(v)} style={{
            flex: 1, padding: 10, border: `2px solid ${type === v ? t.violet : t.cardBorder}`,
            borderRadius: 8, background: type === v ? t.violetBg : t.card,
            color: type === v ? t.violet : t.textSec, fontWeight: 600, fontSize: 14,
            cursor: "pointer", textTransform: "capitalize",
          }}>{v}</button>
        ))}
      </div>
      <Input label="Amount" value={amount} onChange={setAmount} type="number" placeholder="0.00" />
      <Input label="Merchant / Source" value={merchant} onChange={setMerchant} placeholder="e.g. Grocery Store" />
      <Input label="Date" value={date} onChange={setDate} type="date" />
      <Select label="Category" value={category} onChange={setCategory} options={settings.categories || DEFAULT_CATEGORIES} />
      <Select label="Account" value={account} onChange={setAccount} options={settings.accounts || DEFAULT_ACCOUNTS} />
      <Select label="Bank / Institution" value={bank} onChange={setBank} options={settings.banks || DEFAULT_BANKS} />
      <div style={{ marginBottom: 12 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: t.textSec, marginBottom: 4 }}>Tags</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {tags.map((tg) => (
            <button key={tg.name} onClick={() => setSelTags((s) => s.includes(tg.name) ? s.filter((x) => x !== tg.name) : [...s, tg.name])}
              style={{
                padding: "4px 10px", borderRadius: 12,
                border: `1px solid ${selTags.includes(tg.name) ? t.violet : t.cardBorder}`,
                background: selTags.includes(tg.name) ? t.violetBg : t.card,
                fontSize: 12, cursor: "pointer", color: selTags.includes(tg.name) ? t.violet : t.textSec,
              }}>{tg.name}</button>
          ))}
        </div>
      </div>
      <Btn onClick={save} disabled={saving || !merchant.trim() || !amount} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
        {saving ? "Saving..." : "Save transaction"}
      </Btn>
    </Modal>
  );
}
