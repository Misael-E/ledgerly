"use client";

import { useEffect, type ReactNode, type CSSProperties } from "react";
import { X } from "lucide-react";
import { PERIODS } from "@/app/lib/constants";
import { useTheme } from "./ThemeProvider";

export function Modal({
  open, onClose, title, children, wide,
}: {
  open: boolean; onClose: () => void; title: string;
  children: ReactNode; wide?: boolean;
}) {
  const { t } = useTheme();
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: t.modalOverlay, padding: 16 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div role="dialog" aria-label={title} style={{ background: t.card, borderRadius: 16, width: "100%", maxWidth: wide ? 640 : 480, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", border: `1px solid ${t.cardBorder}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: `1px solid ${t.cardBorder}` }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: t.text }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
            <X size={20} color={t.textTer} />
          </button>
        </div>
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>{children}</div>
      </div>
    </div>
  );
}

export function Btn({
  children, onClick, variant = "primary", disabled, style: s, small,
}: {
  children: ReactNode; onClick?: () => void; variant?: "primary" | "secondary" | "danger" | "ghost";
  disabled?: boolean; style?: CSSProperties; small?: boolean;
}) {
  const { t } = useTheme();
  const base: CSSProperties = {
    border: "none", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 600, fontSize: small ? 13 : 14, display: "inline-flex", alignItems: "center",
    gap: 6, padding: small ? "6px 12px" : "10px 16px", opacity: disabled ? 0.5 : 1, transition: "all 0.15s",
  };
  const vars: Record<string, CSSProperties> = {
    primary: { background: t.violet, color: "#fff" },
    secondary: { background: t.cardBorder, color: t.textSec },
    danger: { background: t.red, color: "#fff" },
    ghost: { background: "transparent", color: t.violet },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled} style={{ ...base, ...vars[variant], ...s }}>
      {children}
    </button>
  );
}

export function Card({ children, style: s, onClick }: { children: ReactNode; style?: CSSProperties; onClick?: () => void }) {
  const { t } = useTheme();
  return (
    <div onClick={onClick} style={{ background: t.card, borderRadius: 14, border: `1px solid ${t.cardBorder}`, boxShadow: t.cardShadow, padding: 20, ...s }}>
      {children}
    </div>
  );
}

export function Input({
  label, value, onChange, type = "text", placeholder, style: s, ...rest
}: {
  label?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; style?: CSSProperties;
  onKeyDown?: (e: React.KeyboardEvent) => void;
}) {
  const { t } = useTheme();
  return (
    <label style={{ display: "block", marginBottom: 12, ...s }}>
      {label && <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: t.textSec, marginBottom: 4 }}>{label}</span>}
      <input
        value={value} onChange={(e) => onChange(e.target.value)} type={type} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box", outline: "none", background: t.inputBg, color: t.text }}
        {...rest}
      />
    </label>
  );
}

export function Select({
  label, value, onChange, options, placeholder,
}: {
  label?: string; value: string | number; onChange: (v: string) => void;
  options: (string | { value: string; label: string })[]; placeholder?: string;
}) {
  const { t } = useTheme();
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      {label && <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: t.textSec, marginBottom: 4 }}>{label}</span>}
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "10px 12px", border: `1px solid ${t.inputBorder}`, borderRadius: 8, fontSize: 14, background: t.selectBg, color: t.text, boxSizing: "border-box" }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </label>
  );
}

export function EmptyState({
  icon: Icon, title, desc, action,
}: {
  icon?: React.ComponentType<{ size?: number; color?: string; style?: CSSProperties }>;
  title: string; desc: string; action?: ReactNode;
}) {
  const { t } = useTheme();
  return (
    <div style={{ textAlign: "center", padding: "40px 20px", color: t.textTer }}>
      {Icon && <Icon size={40} color={t.textQuat} style={{ marginBottom: 12 }} />}
      <p style={{ fontSize: 16, fontWeight: 600, color: t.textSec, margin: "0 0 4px" }}>{title}</p>
      <p style={{ fontSize: 14, margin: "0 0 16px" }}>{desc}</p>
      {action}
    </div>
  );
}

export function Badge({ children, color, bg }: { children: ReactNode; color?: string; bg?: string }) {
  const { t } = useTheme();
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 600, color: color || t.violet, background: bg || t.violetBg }}>
      {children}
    </span>
  );
}

export function PeriodSelector({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTheme();
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {PERIODS.map((p) => (
        <button
          key={p.value} onClick={() => onChange(p.value)}
          style={{
            padding: "6px 12px", borderRadius: 8,
            border: value === p.value ? `2px solid ${t.violet}` : `1px solid ${t.cardBorder}`,
            background: value === p.value ? t.violetBg : t.card,
            color: value === p.value ? t.violet : t.textSec,
            fontSize: 13, fontWeight: value === p.value ? 600 : 400, cursor: "pointer",
          }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

export function ProgressBar({ value, max, color, height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const { t } = useTheme();
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div style={{ width: "100%", height, background: t.cardBorder, borderRadius: height / 2, overflow: "hidden" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: color || t.violet, borderRadius: height / 2, transition: "width 0.3s" }} />
    </div>
  );
}
