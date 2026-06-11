import pg from 'pg';
import type { Message } from '../types/chat.js';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost')
    ? false
    : { rejectUnauthorized: false },
  max: 10,
});

export async function ensureTables(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      metadata JSONB DEFAULT '{}'::jsonb
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('user', 'ai')),
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_at);
  `);
  await pool.query(`
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
  `);
}

export async function getOrCreateConversation(
  sessionId: string
): Promise<string> {
  await pool.query(
    'INSERT INTO conversations (id) VALUES ($1) ON CONFLICT (id) DO NOTHING',
    [sessionId]
  );
  return sessionId;
}

export async function updateConversationMetadata(
  conversationId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await pool.query(
    'UPDATE conversations SET metadata = metadata || $2::jsonb WHERE id = $1',
    [conversationId, JSON.stringify(metadata)]
  );
}

export async function getHistory(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const result = await pool.query(
    `SELECT id, conversation_id, sender, text, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT $2`,
    [conversationId, limit]
  );
  return result.rows;
}

export async function insertMessage(
  id: string,
  conversationId: string,
  sender: 'user' | 'ai',
  text: string
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (id, conversation_id, sender, text)
     VALUES ($1, $2, $3, $4)`,
    [id, conversationId, sender, text]
  );
}

export interface ConversationSummary {
  id: string;
  preview: string;
  created_at: Date;
}

export async function listConversations(
  limit = 50
): Promise<ConversationSummary[]> {
  const result = await pool.query(
    `SELECT c.id, c.created_at,
            COALESCE(c.metadata->>'preview', 'New conversation') AS preview
     FROM conversations c
     ORDER BY COALESCE(
       (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
       c.created_at
     ) DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function closePool(): Promise<void> {
  await pool.end();
}
