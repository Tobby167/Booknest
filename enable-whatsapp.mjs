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

async function enableWhatsApp() {
  console.log("Enabling WhatsApp for all businesses...\n");

  const { data, error } = await supabase
    .from('businesses')
    .update({ whatsapp_enabled: true })
    .match({ whatsapp_enabled: false });

  if (error) {
    console.error("Error updating database:", error.message);
  } else {
    console.log("Database updated successfully! whatsapp_enabled is now true for all businesses.");
  }
}

enableWhatsApp();
