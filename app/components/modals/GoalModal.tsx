"use client";

import { useState, useEffect } from "react";
import { Modal, Btn, Input } from "@/app/components/ui";
import type { Goal } from "@/app/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  item: Goal | null;
  onSave: (goal: Goal) => Promise<void>;
}

export default function GoalModal({ open, onClose, item, onSave }: Props) {
  const [name, setName] = useState("");
  const [tgt, setTgt] = useState("");
  const [cur, setCur] = useState("0");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (item) {
      setName(item.name || ""); setTgt(String(item.target || ""));
      setCur(String(item.current || "0")); setDue(item.dueDate || "");
      setNote(item.note || "");
    } else {
      setName(""); setTgt(""); setCur("0"); setDue(""); setNote("");
    }
  }, [item, open]);

  return (
    <Modal open={open} onClose={onClose} title={item ? "Edit Goal" : "Create Goal"}>
      <Input label="Name" value={name} onChange={setName} placeholder="e.g. Emergency Fund" />
      <Input label="Target" value={tgt} onChange={setTgt} type="number" placeholder="0.00" />
      <Input label="Current Saved" value={cur} onChange={setCur} type="number" />
      <Input label="Due Date" value={due} onChange={setDue} type="date" />
      <Input label="Note" value={note} onChange={setNote} placeholder="Optional" />
      <Btn
        onClick={() => onSave({ ...item, name, target: Number(tgt), current: Number(cur), dueDate: due, note } as Goal)}
        disabled={!name.trim() || !tgt}
        style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
      >Save</Btn>
    </Modal>
  );
}
