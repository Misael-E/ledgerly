"use client";

import { useState } from "react";
import { Modal, Btn, Input } from "@/app/components/ui";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  label: string;
  onSave: (name: string) => void;
}

export default function SimpleNameModal({ open, onClose, title, label, onSave }: Props) {
  const [n, setN] = useState("");
  return (
    <Modal open={open} onClose={() => { setN(""); onClose(); }} title={title}>
      <Input label={label} value={n} onChange={setN} placeholder="Enter name" />
      <Btn onClick={() => { onSave(n.trim()); setN(""); }} disabled={!n.trim()} style={{ width: "100%", justifyContent: "center", marginTop: 8 }}>
        Save
      </Btn>
    </Modal>
  );
}
