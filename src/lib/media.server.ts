import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BUCKET = "course-media";

/** Creates a time-limited URL for a private storage object. */
export async function signPath(path: string | null | undefined, expiresIn = 60 * 60 * 24 * 7) {
  if (!path) return null;
  const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  return data?.signedUrl ?? null;
}

export async function signMany(paths: (string | null | undefined)[], expiresIn = 60 * 60 * 24 * 7) {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  await Promise.all(
    unique.map(async (p) => {
      const url = await signPath(p, expiresIn);
      if (url) out.set(p, url);
    }),
  );
  return out;
}
