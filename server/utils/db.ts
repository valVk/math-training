import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { PROBLEM_TYPES } from '#shared/utils/problemTypes'

let instance: Database.Database | null = null

const MIGRATIONS: string[] = [
  `
  CREATE TABLE type_settings (
    type_key TEXT PRIMARY KEY,
    position INTEGER NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1
  );
  CREATE TABLE problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type_key TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX problems_type ON problems(type_key);
  CREATE TABLE attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_id INTEGER NOT NULL REFERENCES problems(id),
    type_key TEXT NOT NULL,
    user_email TEXT NOT NULL,
    served_at INTEGER NOT NULL,
    finished_at INTEGER,
    status TEXT NOT NULL DEFAULT 'open',
    active_ms INTEGER NOT NULL DEFAULT 0,
    answers TEXT NOT NULL,
    hint_used INTEGER NOT NULL DEFAULT 0,
    translation_opened INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX attempts_user ON attempts(user_email, status);
  CREATE INDEX attempts_problem ON attempts(problem_id);
  `,
  `
  ALTER TABLE problems ADD COLUMN generator_version INTEGER NOT NULL DEFAULT 1;
  CREATE INDEX problems_type_version ON problems(type_key, generator_version);
  `,
  `
  ALTER TABLE attempts ADD COLUMN is_return INTEGER NOT NULL DEFAULT 0;
  `,
  // Split "mult_div_beyond_table" into multiplication and division. Multiplication keeps the old
  // position and history; division goes right after it with the same enabled flag. A fresh
  // database has no rows here.
  `
  UPDATE type_settings SET position = position + 1
    WHERE position > (SELECT position FROM type_settings WHERE type_key = 'mult_div_beyond_table');
  INSERT INTO type_settings (type_key, position, enabled)
    SELECT 'div_beyond_table', position + 1, enabled FROM type_settings WHERE type_key = 'mult_div_beyond_table';
  UPDATE type_settings SET type_key = 'mult_beyond_table' WHERE type_key = 'mult_div_beyond_table';
  UPDATE problems SET type_key = 'mult_beyond_table' WHERE type_key = 'mult_div_beyond_table';
  UPDATE attempts SET type_key = 'mult_beyond_table' WHERE type_key = 'mult_div_beyond_table';
  `,
  `
  ALTER TABLE attempts ADD COLUMN teacher_used INTEGER NOT NULL DEFAULT 0;
  `,
  // A parent can take a broken problem out of rotation; it is kept for the stats.
  `
  ALTER TABLE problems ADD COLUMN retired INTEGER NOT NULL DEFAULT 0;
  `,
  // When the child first pressed "show the problem"; served_at is only when it was loaded.
  `
  ALTER TABLE attempts ADD COLUMN started_at INTEGER;
  `
]

function migrate(db: Database.Database) {
  const version = db.pragma('user_version', { simple: true }) as number
  for (let step = version; step < MIGRATIONS.length; step++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[step]!)
      db.pragma(`user_version = ${step + 1}`)
    })()
  }
}

/** Adds rows for problem types introduced after the database was created. */
function seedTypeSettings(db: Database.Database) {
  const existing = new Set(
    (db.prepare('SELECT type_key FROM type_settings').all() as Array<{ type_key: string }>).map(row => row.type_key)
  )
  const maxRow = db.prepare('SELECT MAX(position) AS max FROM type_settings').get() as { max: number | null }
  let position = (maxRow.max ?? -1) + 1
  const insert = db.prepare('INSERT INTO type_settings (type_key, position, enabled) VALUES (?, ?, 1)')
  for (const type of PROBLEM_TYPES) {
    if (!existing.has(type.key)) {
      insert.run(type.key, position++)
    }
  }
}

export function useDb(): Database.Database {
  if (!instance) {
    const { dbPath } = useRuntimeConfig()
    mkdirSync(dirname(dbPath), { recursive: true })
    instance = new Database(dbPath)
    instance.pragma('journal_mode = WAL')
    instance.pragma('foreign_keys = ON')
    migrate(instance)
    seedTypeSettings(instance)
  }
  return instance
}
