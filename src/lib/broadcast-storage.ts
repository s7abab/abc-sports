import { getSupabaseStorageClient, type Json } from "@/lib/supabase-storage";

const BROADCAST_ROW_ID = "singleton";

export interface BroadcastMessage {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  cancelLabel: string;
  actionUrl: string;
  imageUrls: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 3);
}

function normalizeBroadcast(value: unknown): BroadcastMessage | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const broadcast = value as Partial<BroadcastMessage> & {
    imageUrls?: unknown;
    image_urls?: unknown;
    action_label?: unknown;
    cancel_label?: unknown;
    action_url?: unknown;
    is_active?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
  };

  const title = normalizeString(broadcast.title);
  const description = normalizeString(broadcast.description);
  const actionLabel = normalizeString(broadcast.actionLabel ?? broadcast.action_label) || "Open";
  const cancelLabel = normalizeString(broadcast.cancelLabel ?? broadcast.cancel_label) || "Close";
  const actionUrl = normalizeString(broadcast.actionUrl ?? broadcast.action_url);
  const imageUrls = normalizeImageUrls(broadcast.imageUrls ?? broadcast.image_urls);
  const createdAt = normalizeString(broadcast.createdAt ?? broadcast.created_at);
  const updatedAt = normalizeString(broadcast.updatedAt ?? broadcast.updated_at);

  return {
    id: normalizeString(broadcast.id) || BROADCAST_ROW_ID,
    title,
    description,
    actionLabel,
    cancelLabel,
    actionUrl,
    imageUrls,
    isActive: Boolean(broadcast.isActive ?? broadcast.is_active),
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString(),
  };
}

export async function readBroadcast(): Promise<BroadcastMessage | null> {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase
    .from("broadcast_messages")
    .select("id, title, description, action_label, cancel_label, action_url, image_urls, is_active, created_at, updated_at")
    .eq("id", BROADCAST_ROW_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return normalizeBroadcast(data);
}

export async function saveBroadcast(input: unknown): Promise<BroadcastMessage> {
  if (!input || typeof input !== "object") {
    throw new Error("Invalid broadcast payload.");
  }

  const incoming = input as Partial<BroadcastMessage> & { imageUrls?: unknown };
  const next: BroadcastMessage = {
    id: BROADCAST_ROW_ID,
    title: normalizeString(incoming.title),
    description: normalizeString(incoming.description),
    actionLabel: normalizeString(incoming.actionLabel) || "Open",
    cancelLabel: normalizeString(incoming.cancelLabel) || "Close",
    actionUrl: normalizeString(incoming.actionUrl),
    imageUrls: normalizeImageUrls(incoming.imageUrls),
    isActive: Boolean(incoming.isActive),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (next.isActive && !next.title && !next.description && next.imageUrls.length === 0 && !next.actionUrl) {
    throw new Error("Broadcast content cannot be empty.");
  }

  const supabase = getSupabaseStorageClient();
  const { data: existing, error: readError } = await supabase
    .from("broadcast_messages")
    .select("created_at")
    .eq("id", BROADCAST_ROW_ID)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  next.createdAt = normalizeString(existing?.created_at) || next.createdAt;

  const { error } = await supabase
    .from("broadcast_messages")
    .upsert(
      {
        id: next.id,
        title: next.title,
        description: next.description,
        action_label: next.actionLabel,
        cancel_label: next.cancelLabel,
        action_url: next.actionUrl,
        image_urls: next.imageUrls as Json,
        is_active: next.isActive,
        created_at: next.createdAt,
        updated_at: next.updatedAt,
      },
      { onConflict: "id" }
    );

  if (error) {
    throw error;
  }

  return next;
}

export async function clearBroadcast(): Promise<BroadcastMessage> {
  return saveBroadcast({
    title: "",
    description: "",
    actionLabel: "Open",
    cancelLabel: "Close",
    actionUrl: "",
    imageUrls: [],
    isActive: false,
  });
}

