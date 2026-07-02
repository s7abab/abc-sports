# Live Chat Architecture

This chat uses Supabase as the hot store and realtime transport:

- `chat_messages` stores the recent room tail for each `player_id`.
- The API route validates, moderates, rate-limits, and inserts messages.
- The client subscribes to Supabase Realtime `INSERT` events and also polls every few seconds with `?after=` as a recovery path.
- React keeps only the latest rendered messages in memory, so a busy match does not grow the browser heap forever.

For production live platforms, do not keep every message forever in the same table that powers the live room. The common pattern is:

1. Keep a small hot window per room, usually the latest few hundred messages or the last 12-24 hours.
2. Archive raw events separately only if you need audit, moderation review, analytics, or legal retention.
3. Store aggregates for product features: message count, active users, reaction counts, spam counters.
4. Expire or partition old chat rows so the live query stays fast.
5. Use a server route or edge function for writes, not direct client inserts, so rate limits and moderation cannot be bypassed.

For this app, `src/lib/chat-storage.ts` keeps the live room capped to `MAX_STORED_ROOM_MESSAGES` rows and the client renders at most `MAX_RENDERED_MESSAGES`.
