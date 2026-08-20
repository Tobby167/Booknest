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
  console.log("Checking Supabase Database...\n");

  // Check latest appointments
  const { data: appts, error: apptErr } = await supabase
    .from('appointments')
    .select('id, client_name, client_phone, created_at, total_price')
    .order('created_at', { ascending: false })
    .limit(3);

  if (apptErr) {
    console.error("Error fetching appointments:", apptErr.message);
  } else {
    console.log("--- LATEST APPOINTMENTS ---");
    console.log(JSON.stringify(appts, null, 2));
  }

  // Check latest chat messages
  console.log("\n--- LATEST CHAT MESSAGES ---");
  const { data: msgs, error: msgErr } = await supabase
    .from('chat_messages')
    .select('id, sender, body, created_at')
    .order('created_at', { ascending: false })
    .limit(5);

  if (msgErr) {
    console.error("Error fetching chat messages (might table not exist?):", msgErr.message);
  } else {
    console.log(JSON.stringify(msgs, null, 2));
  }

  // Check conversations
  console.log("\n--- LATEST CONVERSATIONS ---");
  const { data: convs, error: convErr } = await supabase
    .from('chat_conversations')
    .select('id, external_chat_id, state, last_message_at')
    .order('last_message_at', { ascending: false })
    .limit(3);

  if (convErr) {
    console.error("Error fetching conversations:", convErr.message);
  } else {
    console.log(JSON.stringify(convs, null, 2));
  }
}

check();
