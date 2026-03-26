import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: pData, error: pError } = await supabase.from('players').select('*').limit(1);
  console.log("Players:", pData || pError);
  const { data: mData, error: mError } = await supabase.from('matches').select('*').limit(1);
  console.log("Matches:", mData || mError);
}
run();
