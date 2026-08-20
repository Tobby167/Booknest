import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env.local manually
const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
  if (match) {
    env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, '');
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function check() {
  console.log("Checking Supabase Database details...\n");

  // Check businesses
  const { data: businesses, error: busErr } = await supabase
    .from('businesses')
    .select('id, name, slug, whatsapp_enabled');

  if (busErr) {
    console.error("Error fetching businesses:", busErr.message);
  } else {
    console.log("--- BUSINESSES ---");
    console.log(JSON.stringify(businesses, null, 2));
  }

  // Check services
  const { data: services, error: servErr } = await supabase
    .from('services')
    .select('id, name, business_id');

  if (servErr) {
    console.error("Error fetching services:", servErr.message);
  } else {
    console.log("\n--- SERVICES ---");
    console.log(JSON.stringify(services, null, 2));
  }
}

check();
