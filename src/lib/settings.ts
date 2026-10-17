import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";

export const DEFAULT_DRIVE_URL =
  "https://drive.google.com/drive/folders/1OSCphKi7hF756dsOiFXSTys17BFRBXtU";

/**
 * Cached fetcher for the shared class Google Drive resources URL.
 * Cached in Next.js data cache for 60 seconds with 'settings' tag.
 * Revalidated automatically or upon admin settings update.
 */
export const getCachedDriveUrl = unstable_cache(
  async (): Promise<string> => {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        return DEFAULT_DRIVE_URL;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "resources_drive_url")
        .maybeSingle();

      if (data?.value && data.value !== "https://drive.google.com") {
        return data.value;
      }
      return DEFAULT_DRIVE_URL;
    } catch {
      return DEFAULT_DRIVE_URL;
    }
  },
  ["resources-drive-url"],
  { revalidate: 60, tags: ["settings"] }
);
