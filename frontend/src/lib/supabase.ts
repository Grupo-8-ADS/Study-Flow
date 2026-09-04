import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://fsevgdeegpaxdhcwkkcz.supabase.co";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzZXZnZGVlZ3BheGRoY3dra2N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2Mjg2MDYsImV4cCI6MjA5OTIwNDYwNn0.J8rWkpAeueZ2-ji4gG4-IFlrq1Z4Na0K73muaySkf-4";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

