import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const LEADS_FILE = path.join(DATA_DIR, 'leads.jsonl');

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

/**
 * Persist a lead to a local append-only JSONL file.
 * This is the CRM fallback / source of truth when no external CRM is wired up.
 */
export async function saveLead(lead) {
  await ensureDir();
  await fs.appendFile(LEADS_FILE, JSON.stringify(lead) + '\n', 'utf8');
}

/** Read all stored leads (newest first). */
export async function readLeads() {
  try {
    const raw = await fs.readFile(LEADS_FILE, 'utf8');
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .reverse();
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}
