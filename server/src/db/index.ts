import Database from "better-sqlite3";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  text_prompt TEXT NOT NULL,
  reference_image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  player1_id TEXT,
  player2_id TEXT,
  winner_id TEXT,
  win_condition TEXT,
  environment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  battle_data TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(id)
);

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
CREATE INDEX IF NOT EXISTS idx_battles_room_id ON battles(room_id);
`;

export function initDb(): Database.Database {
  const dbPath = process.env.DATABASE_PATH || "./game.db";
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA);

  console.log(`Database initialized at ${dbPath}`);
  return db;
}
