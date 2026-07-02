import { getSupabaseStorageClient } from "@/lib/supabase-storage";

const SETTINGS_ROW_ID = "singleton";

export interface AppSettings {
  whatsappUrl: string;
}

function normalizeWhatsappUrl(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function readSettings(): Promise<AppSettings> {
  const supabase = getSupabaseStorageClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("whatsapp_url")
    .eq("id", SETTINGS_ROW_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    whatsappUrl: normalizeWhatsappUrl(data?.whatsapp_url),
  };
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const next: AppSettings = {
    whatsappUrl: normalizeWhatsappUrl(settings.whatsappUrl),
  };

  const supabase = getSupabaseStorageClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      {
        id: SETTINGS_ROW_ID,
        whatsapp_url: next.whatsappUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    throw error;
  }

  return next;
}
