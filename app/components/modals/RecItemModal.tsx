"use client";

import { useState, useEffect } from "react";
import { Modal, Btn, Input, Select } from "@/app/components/ui";
import type { RecurringItem, Settings } from "@/app/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  item: RecurringItem | null;
  onSave: (item: RecurringItem) => Promise<void>;
  settings: Settings;
}

export default function RecItemModal({ open, onClose, item, onSave, settings }: Props) {
  const [name, setName] = useState("");
  const [amt, setAmt] = useState("");
  const [cad, setCad] = useState("monthly");
  const [nd, setNd] = useState("");
  const [cat, setCat] = useState("Other");

  useEffect(() => {
    if (item) {
      setName(item.name || ""); setAmt(String(item.amount || ""));
      setCad(item.cadence || "monthly"); setNd(item.nextDate || "");
      setCat(item.category || "Other");
    } else {
      setName(""); setAmt(""); setCad("monthly"); setNd(""); setCat("Other");
    }
  }, [item, open]);

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit" : "Add"}>
      <Input label="Name" value={name} onChange={setName} placeholder="e.g. Electricity" />
      <Input label="Amount" value={amt} onChange={setAmt} type="number" placeholder="0.00" />
      <Select label="Cadence" value={cad} onChange={setCad} options={["weekly", "biweekly", "monthly", "quarterly", "annual"]} />
      <Select label="Category" value={cat} onChange={setCat} options={settings.categories || []} />
      <Input label="Next Date" value={nd} onChange={setNd} type="date" />
      <Btn
        onClick={() => onSave({ ...item, name, amount: Number(amt), cadence: cad, nextDate: nd, category: cat, active: true } as RecurringItem)}
        disabled={!name.trim() || !amt}
        style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
      >Save</Btn>
    </Modal>
  );
}
