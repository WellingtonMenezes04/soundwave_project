/**
 * Playback Service – Redis
 *
 * Data model:
 *   playlist:{userId}         → Redis List  (track IDs in order)
 *   history:{userId}          → Redis List  (last 50 played tracks, newest first)
 *   nowplaying:{userId}       → Redis Hash  { trackId, albumId, title, startedAt }
 */
const express = require('express');
const cors    = require('cors');
const Redis   = require('ioredis');

const app   = express();
const port  = process.env.PORT || 3003;
const redis = new Redis(process.env.REDIS_URL || 'redis://:soundwave123@localhost:6379');

redis.on('connect', () => console.log('✅ playback-service connected to Redis'));
redis.on('error',   (err) => console.error('Redis error:', err));

app.use(cors());
app.use(express.json());

// ── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'playback-service' }));

// ═══════════════════════════════════════════════
// PLAYLIST CRUD
// ═══════════════════════════════════════════════

// CREATE – add track to end of playlist
app.post('/playlist/:userId', async (req, res) => {
  const { userId } = req.params;
  const { trackId, albumId, title } = req.body;
  if (!trackId || !title) return res.status(400).json({ error: 'trackId and title are required' });
  try {
    const entry = JSON.stringify({ trackId, albumId, title, addedAt: new Date().toISOString() });
    await redis.rpush(`playlist:${userId}`, entry);
    res.status(201).json({ message: 'Track added to playlist' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// READ – get full playlist
app.get('/playlist/:userId', async (req, res) => {
  try {
    const raw = await redis.lrange(`playlist:${req.params.userId}`, 0, -1);
    res.json(raw.map(JSON.parse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// UPDATE – replace a track at index
app.put('/playlist/:userId/:index', async (req, res) => {
  const { userId, index } = req.params;
  const { trackId, albumId, title } = req.body;
  try {
    const entry = JSON.stringify({ trackId, albumId, title, updatedAt: new Date().toISOString() });
    await redis.lset(`playlist:${userId}`, parseInt(index), entry);
    res.json({ message: 'Playlist entry updated' });
  } catch (err) {
    if (err.message.includes('index out of range'))
      return res.status(404).json({ error: 'Index out of range' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE – remove entire playlist
app.delete('/playlist/:userId', async (req, res) => {
  try {
    await redis.del(`playlist:${req.params.userId}`);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ═══════════════════════════════════════════════
// PLAYBACK / NOW PLAYING
// ═══════════════════════════════════════════════

// Play a track (sets now-playing + appends to history)
app.post('/play/:userId', async (req, res) => {
  const { userId } = req.params;
  const { trackId, albumId, title } = req.body;
  if (!trackId || !title) return res.status(400).json({ error: 'trackId and title are required' });
  try {
    const pipe = redis.pipeline();
    pipe.hset(`nowplaying:${userId}`, { trackId, albumId: albumId || '', title, startedAt: new Date().toISOString() });
    const histEntry = JSON.stringify({ trackId, albumId, title, playedAt: new Date().toISOString() });
    pipe.lpush(`history:${userId}`, histEntry);
    pipe.ltrim(`history:${userId}`, 0, 49); // keep last 50
    await pipe.exec();
    res.json({ message: `Now playing: ${title}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get now playing
app.get('/nowplaying/:userId', async (req, res) => {
  try {
    const data = await redis.hgetall(`nowplaying:${req.params.userId}`);
    if (!data || !data.trackId) return res.json(null);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get history
app.get('/history/:userId', async (req, res) => {
  try {
    const raw = await redis.lrange(`history:${req.params.userId}`, 0, 49);
    res.json(raw.map(JSON.parse));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Clear history
app.delete('/history/:userId', async (req, res) => {
  try {
    await redis.del(`history:${req.params.userId}`);
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => console.log(`✅ playback-service listening on :${port}`));
