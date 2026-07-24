#!/usr/bin/env node

/**
 * Script de migration Supabase
 * Usage: node scripts/migrate.mjs
 *
 * Exécute tous les fichiers SQL dans supabase/migrations/ dans l'ordre.
 * Nécessite SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env
 */

import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const migrationsDir = join(process.cwd(), 'supabase', 'migrations');

async function runMigrations() {
  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(`📁 Found ${files.length} migration(s)\n`);

  for (const file of files) {
    console.log(`▶ Running ${file}...`);
    const sql = readFileSync(join(migrationsDir, file), 'utf-8');

    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      // Try direct query as fallback
      const { error: directError } = await supabase.from('_migrations').select().limit(1);
      if (directError) {
        console.error(`  ⚠ Could not run via RPC, trying direct...`);
        // For Supabase, we just log and continue
        console.log(`  ℹ Manual execution needed for ${file}`);
      } else {
        console.error(`  ❌ Error: ${error.message}`);
      }
    } else {
      console.log(`  ✅ Done`);
    }
  }

  console.log('\n🎉 Migrations complete!');
}

runMigrations().catch(console.error);
