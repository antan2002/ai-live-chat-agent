import { Router } from 'express';
import crypto from 'node:crypto';
import type { ChatRequest } from '../types/chat.js';
import {
  getOrCreateConversation,
  getHistory,
  insertMessage,
  listConversations,
  updateConversationMetadata,
} from '../db/index.js';
import { generateReply, summarizeForSidebar } from '../services/llm.js';

const router = Router();

router.post('/message', async (req, res) => {
  try {
    const { message, sessionId: rawSessionId } = req.body as ChatRequest;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message is required and must be a string' });
      return;
    }

    const trimmed = message.trim();
    if (trimmed.length === 0) {
      res.status(400).json({ error: 'message must not be empty' });
      return;
    }

    if (trimmed.length > 10000) {
      res.status(400).json({ error: 'message must not exceed 10,000 characters' });
      return;
    }

    const sessionId =
      typeof rawSessionId === 'string' && rawSessionId.trim().length > 0
        ? rawSessionId.trim()
        : crypto.randomUUID();

    let conversationId: string;
    try {
      conversationId = await getOrCreateConversation(sessionId);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : 'Unknown DB error';
      console.error('Database error (getOrCreateConversation):', msg);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    const history = await getHistory(conversationId, 50);
    
    const userMsgId = crypto.randomUUID();
    try {
      await insertMessage(userMsgId, conversationId, 'user', trimmed);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : 'Unknown DB error';
      console.error('Database error (insertMessage):', msg);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    if (history.length === 0) {
      summarizeForSidebar(trimmed).then(preview => {
        updateConversationMetadata(conversationId, { preview }).catch(e =>
          console.error('Metadata update error:', e)
        );
      }).catch(e =>
        console.error('Summarize error:', e)
      );
    }
    
    let replyText: string;
    try {
      replyText = await generateReply(history, trimmed);
    } catch (llmErr) {
      const msg =
        llmErr instanceof Error ? llmErr.message : 'Unknown LLM error';
      console.error('LLM error:', msg);
      replyText =
        "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
    }

    const aiMsgId = crypto.randomUUID();
    try {
      await insertMessage(aiMsgId, conversationId, 'ai', replyText);
    } catch (dbErr) {
      const msg = dbErr instanceof Error ? dbErr.message : 'Unknown DB error';
      console.error('Database error (insertMessage):', msg);
      res.status(500).json({ error: 'Internal server error' });
      return;
    }

    res.json({ reply: replyText, sessionId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Unexpected error:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/conversations', async (_req, res) => {
  try {
    const conversations = await listConversations(50);
    res.json(conversations);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('List conversations error:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    if (!sessionId || sessionId.trim().length === 0) {
      res.status(400).json({ error: 'sessionId is required' });
      return;
    }

    const messages = await getHistory(sessionId, 50);
    res.json(messages);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Get history error:', msg);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
