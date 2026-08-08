import { createClient } from "./supabase";
import type { Transaction, TagItem, Rule, DocumentMeta, Settings } from "./types";
import { defSettings } from "./storage";

const supabase = () => createClient();

async function getUserId() {
  const { data: { user } } = await supabase().auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// --- Transactions ---

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase()
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTransaction);
}

export async function insertTransaction(tx: Transaction): Promise<Transaction> {
  const userId = await getUserId();
  const { data, error } = await supabase()
    .from("transactions")
    .insert({ ...transactionToRow(tx), user_id: userId })
    .select()
    .single();
  if (error) throw error;
  return rowToTransaction(data);
}

export async function updateTransaction(tx: Transaction): Promise<void> {
  const { error } = await supabase()
    .from("transactions")
    .update(transactionToRow(tx))
    .eq("id", tx.id);
  if (error) throw error;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase().from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertTransactions(txs: Transaction[]): Promise<void> {
  if (txs.length === 0) return;
  const userId = await getUserId();
  const { error } = await supabase()
    .from("transactions")
    .upsert(txs.map((tx) => ({ ...transactionToRow(tx), user_id: userId })), { onConflict: "id" });
  if (error) throw error;
}

export async function checkFingerprints(fps: string[]): Promise<Set<string>> {
  if (fps.length === 0) return new Set();
  const { data, error } = await supabase()
    .from("transactions")
    .select("fingerprint")
    .in("fingerprint", fps);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.fingerprint));
}

// --- Tags ---

export async function fetchTags(): Promise<TagItem[]> {
  const { data, error } = await supabase()
    .from("tags")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({ name: r.name, createdAt: r.created_at }));
}

export async function saveTags(tags: TagItem[]): Promise<void> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await sb.from("tags").delete().neq("name", "");
  if (tags.length === 0) return;
  const { error } = await sb
    .from("tags")
    .insert(tags.map((t) => ({ user_id: user.id, name: t.name, created_at: t.createdAt })));
  if (error) throw error;
}

// --- Rules ---

export async function fetchRules(): Promise<Rule[]> {
  const { data, error } = await supabase()
    .from("rules")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    whenText: r.when_text,
    thenText: r.then_text,
    enabled: r.enabled,
    createdAt: r.created_at,
  }));
}

export async function saveRules(rules: Rule[]): Promise<void> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await sb.from("rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (rules.length === 0) return;
  const { error } = await sb
    .from("rules")
    .insert(rules.map((r) => ({
      id: r.id,
      user_id: user.id,
      when_text: r.whenText,
      then_text: r.thenText,
      enabled: r.enabled,
      created_at: r.createdAt,
    })));
  if (error) throw error;
}

// --- Documents ---

export async function fetchDocuments(): Promise<DocumentMeta[]> {
  const { data, error } = await supabase()
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    filename: r.filename,
    mimeType: r.mime_type,
    size: r.size,
    status: r.status,
    source: r.source,
    createdAt: r.created_at,
  }));
}

export async function saveDocuments(docs: DocumentMeta[]): Promise<void> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  await sb.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (docs.length === 0) return;
  const { error } = await sb
    .from("documents")
    .insert(docs.map((d) => ({
      id: d.id,
      user_id: user.id,
      filename: d.filename,
      mime_type: d.mimeType,
      size: d.size,
      status: d.status,
      source: d.source,
      created_at: d.createdAt,
    })));
  if (error) throw error;
}

// --- Settings ---

export async function fetchSettings(): Promise<Settings> {
  const { data, error } = await supabase()
    .from("settings")
    .select("data")
    .single();
  if (error && error.code === "PGRST116") return defSettings();
  if (error) throw error;
  return { ...defSettings(), ...(data?.data as Partial<Settings>) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const sb = supabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await sb
    .from("settings")
    .upsert({ user_id: user.id, data: settings, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// --- Wipe ---

export async function wipeAllData(): Promise<void> {
  const sb = supabase();
  await sb.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("tags").delete().neq("name", "");
  await sb.from("rules").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    await sb.from("settings").upsert({
      user_id: user.id,
      data: { ...defSettings(), freshStart: true, driveResetAt: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
  }
}

// --- Row mappers ---

function rowToTransaction(r: Record<string, unknown>): Transaction {
  return {
    id: r.id as string,
    date: r.date as string,
    merchant: r.merchant as string,
    category: r.category as string,
    amount: Number(r.amount),
    type: r.type as "expense" | "income",
    account: r.account as string,
    bank: r.bank as string,
    tags: (r.tags as string[]) ?? [],
    receipt: r.receipt as boolean,
    source: r.source as "manual" | "csv" | "google-drive",
    fingerprint: r.fingerprint as string,
    createdAt: r.created_at as string,
  };
}

function transactionToRow(tx: Transaction) {
  return {
    id: tx.id,
    date: tx.date,
    merchant: tx.merchant,
    category: tx.category,
    amount: tx.amount,
    type: tx.type,
    account: tx.account,
    bank: tx.bank,
    tags: tx.tags,
    receipt: tx.receipt,
    source: tx.source,
    fingerprint: tx.fingerprint,
    created_at: tx.createdAt,
  };
}
