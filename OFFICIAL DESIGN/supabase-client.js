import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { supabaseAnonKey, supabaseUrl } from "./supabase-config.js";

export { supabaseAnonKey, supabaseUrl };

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
