import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';

export function openDb(path: string): Database.Database {
  return new Database(path);
}

export function runMigrations(db: Database.Database): void {
  db.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf-8'));
}
