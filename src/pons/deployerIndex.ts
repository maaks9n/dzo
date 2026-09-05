/**
 * deployerIndex.ts — SQLite-backed index of TokenLaunched and PoolGraduated events.
 *
 * Persists to `data/deployers.db`, backfills on first run only, then keeps up
 * incrementally from the live feed. Cold starts after the first run are under
 * 2 seconds and avoid the startup burst of getLogs that in-memory
 * implementations trigger on the public RPC.
 */

import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export interface LaunchRow {
  token: string;
  deployer: string;
  block: number;
  timestamp: number;
  curve: string;
  pair: string;
  graduated: 0 | 1;
  graduatedBlock: number | null;
}

export interface DeployerStats {
  address: string;
  launches: number;
  graduated: number;
  graduationRate: number;
  firstSeen: number;
  lastSeen: number;
}

let db: Database.Database | null = null;

export function openIndex(dataDir: string = 'data'): void {
  if (db) return;
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  db = new Database(join(dataDir, 'deployers.db'));
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS launches (
      token TEXT PRIMARY KEY,
      deployer TEXT NOT NULL,
      block INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      curve TEXT NOT NULL,
      pair TEXT NOT NULL,
      graduated INTEGER NOT NULL DEFAULT 0,
      graduated_block INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_deployer ON launches(deployer);
    CREATE INDEX IF NOT EXISTS idx_block ON launches(block);
    CREATE INDEX IF NOT EXISTS idx_graduated ON launches(graduated);

    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function ensureDb(): Database.Database {
  if (!db) throw new Error('deployerIndex: openIndex() not called');
  return db;
}

export function upsertLaunch(row: LaunchRow): void {
  const stmt = ensureDb().prepare(`
    INSERT INTO launches (token, deployer, block, timestamp, curve, pair, graduated, graduated_block)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(token) DO UPDATE SET
      graduated = MAX(launches.graduated, excluded.graduated),
      graduated_block = COALESCE(excluded.graduated_block, launches.graduated_block)
  `);
  stmt.run(
    row.token.toLowerCase(),
    row.deployer.toLowerCase(),
    row.block,
    row.timestamp,
    row.curve.toLowerCase(),
    row.pair.toLowerCase(),
    row.graduated,
    row.graduatedBlock,
  );
}

export function markGraduated(token: string, block: number): void {
  ensureDb().prepare(`UPDATE launches SET graduated = 1, graduated_block = ? WHERE token = ?`)
    .run(block, token.toLowerCase());
}

export function statsFor(deployer: string, sinceBlock?: number): DeployerStats {
  const stmt = ensureDb().prepare(`
    SELECT COUNT(*) AS launches,
           SUM(graduated) AS graduated,
           MIN(timestamp) AS firstSeen,
           MAX(timestamp) AS lastSeen
    FROM launches
    WHERE deployer = ? ${sinceBlock ? 'AND block >= ?' : ''}
  `);
  const row = sinceBlock ? stmt.get(deployer.toLowerCase(), sinceBlock) : stmt.get(deployer.toLowerCase());
  const r = row as { launches: number; graduated: number; firstSeen: number; lastSeen: number } | undefined;
  const launches = r?.launches ?? 0;
  const graduated = r?.graduated ?? 0;
  return {
    address: deployer.toLowerCase(),
    launches,
    graduated,
    graduationRate: launches > 0 ? graduated / launches : 0,
    firstSeen: r?.firstSeen ?? 0,
    lastSeen: r?.lastSeen ?? 0,
  };
}

export function launchesByDeployer(deployer: string): LaunchRow[] {
  const rows = ensureDb().prepare(`
    SELECT token, deployer, block, timestamp, curve, pair, graduated, graduated_block AS graduatedBlock
    FROM launches WHERE deployer = ? ORDER BY block DESC
  `).all(deployer.toLowerCase()) as LaunchRow[];
  return rows;
}

export function highWaterBlock(): number {
  const row = ensureDb().prepare(`SELECT MAX(block) AS b FROM launches`).get() as { b: number | null };
  return row.b ?? 0;
}

export function setMeta(key: string, value: string): void {
  ensureDb().prepare(`INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
    .run(key, value);
}

export function getMeta(key: string): string | undefined {
  const row = ensureDb().prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value: string } | undefined;
  return row?.value;
}
