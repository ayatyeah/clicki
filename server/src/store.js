import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { insertLead, listLeads, countLeads } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');

/**
 * Persist a lead. The DB is the source of truth: the previous JSONL file lived on
 * the container's ephemeral filesystem and was destroyed on every redeploy, so
 * every lead collected between two deploys was silently lost.
 */
export async function saveLead(lead) {
  await insertLead(lead);
}

/** Read stored leads (newest first). */
export async function readLeads(limit = 1000) {
  return listLeads(limit);
}

/**
 * One-time import of any leads still sitting in the legacy JSONL file. Runs only
 * when the file exists AND the leads table is empty, so a restart can never
 * double-import. The file is left on disk untouched as a backup.
 */
export async function migrateLegacyLeads() {
  let raw;
  try {
    raw = await fs.readFile(LEADS_FILE, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') return { migrated: 0, skipped: 'no-file' };
    throw err;
  }

  if ((await countLeads()) > 0) return { migrated: 0, skipped: 'table-not-empty' };

  let migrated = 0;
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let lead;
    try {
      lead = JSON.parse(line);
    } catch {
      continue; // a truncated final line shouldn't abort the whole import
    }
    await insertLead(lead);
    migrated += 1;
  }
  return { migrated };
}
