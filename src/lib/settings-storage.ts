import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

export interface AppSettings {
  whatsappUrl: string;
}

export function readSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      return {
        whatsappUrl: typeof parsed.whatsappUrl === "string" ? parsed.whatsappUrl.trim() : "",
      };
    }
  } catch (error) {
    console.error("Failed to read settings file:", error);
  }
  return { whatsappUrl: "" };
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
  const current = readSettings();
  const next: AppSettings = {
    whatsappUrl: typeof settings.whatsappUrl === "string" ? settings.whatsappUrl.trim() : current.whatsappUrl,
  };
  
  // Make sure the data directory exists
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(next, null, 2), "utf-8");
  return next;
}
