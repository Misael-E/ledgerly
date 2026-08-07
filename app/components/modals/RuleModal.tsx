"use client";

import { useState, useEffect } from "react";
import { Modal, Btn, Input, Select } from "@/app/components/ui";
import type { Rule } from "@/app/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  item: Rule | null;
  onSave: (rule: Rule) => Promise<void>;
  categories: string[];
}

export default function RuleModal({ open, onClose, item, onSave, categories }: Props) {
  const [w, setW] = useState("");
  const [th, setTh] = useState("");

  useEffect(() => {
    if (item) { setW(item.whenText || ""); setTh(item.thenText || ""); }
    else { setW(""); setTh(""); }
  }, [item, open]);

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit Rule" : "Create Rule"}>
      <Input label='When merchant contains...' value={w} onChange={setW} placeholder="e.g. netflix" />
      <Select label="Then set category to..." value={th} onChange={setTh} options={categories} placeholder="Select" />
      <Btn
        onClick={() => onSave({ ...item, whenText: w, thenText: th, enabled: item?.enabled ?? true } as Rule)}
        disabled={!w.trim() || !th}
        style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
      >Save</Btn>
    </Modal>
  );
}
