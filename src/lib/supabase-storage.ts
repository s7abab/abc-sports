import { createClient } from "@supabase/supabase-js";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

interface Database {
  public: {
    Tables: {
      matches: {
        Row: {
          id: string;
          position: number;
          live: boolean;
          status: string;
          competition: string;
          date: string;
          home: string;
          away: string;
          player_id: string;
          home_logo_url: string;
          away_logo_url: string;
        };
        Insert: {
          id: string;
          position: number;
          live: boolean;
          status: string;
          competition: string;
          date: string;
          home: string;
          away: string;
          player_id: string;
          home_logo_url?: string;
          away_logo_url?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          position: number;
          name: string;
          primary_server: string;
          servers: Json;
        };
        Insert: {
          id: string;
          position: number;
          name: string;
          primary_server: string;
          servers: Json;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Insert"]>;
        Relationships: [];
      };
      chat_messages: {
        Row: {
          id: string;
          player_id: string;
          author: string;
          body: string;
          kind: string;
          created_at: string;
        };
        Insert: {
          id: string;
          player_id: string;
          author: string;
          body: string;
          kind: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let client: ReturnType<typeof createClient<Database>> | null = null;

export function getSupabaseStorageClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Supabase environment variables are not configured.");
  }

  if (!client) {
    client = createClient<Database>(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return client;
}
