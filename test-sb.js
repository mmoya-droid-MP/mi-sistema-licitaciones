import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
const { data } = await supabase.from('evaluaciones_ia').select('*').limit(1);
console.log(JSON.stringify(data, null, 2));
