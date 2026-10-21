import { createClient } from '@supabase/supabase-js';
// Server-side only. Uses the service role key, which bypasses row level security.
export const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: { fetch: (url, options = {}) => fetch(url, { ...options, cache: 'no-store' }) },
});
