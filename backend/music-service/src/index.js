const express    = require('express');
const cors       = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

const app    = express();
const port   = process.env.PORT || 3002;
const MONGO  = process.env.MONGO_URL || 'mongodb://soundwave:soundwave123@localhost:27017/soundwave_music?authSource=admin';

app.use(cors());
app.use(express.json());

let db;
MongoClient.connect(MONGO).then(client => {
  db = client.db('soundwave_music');
  console.log('✅ music-service connected to MongoDB');
}).catch(err => { console.error('MongoDB connection error:', err); process.exit(1); });

const albums = () => db.collection('albums');

// ── Health ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'music-service' }));

// ── CREATE album ──────────────────────────────────────────
app.post('/albums', async (req, res) => {
  const { title, artist, genre, year, cover_url, tracks = [] } = req.body;
  if (!title || !artist) return res.status(400).json({ error: 'title and artist are required' });
  try {
    const result = await albums().insertOne({ title, artist, genre, year, cover_url, tracks, created_at: new Date() });
    res.status(201).json({ _id: result.insertedId, title, artist, genre, year, cover_url, tracks });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── READ all albums (with optional search) ────────────────
app.get('/albums', async (req, res) => {
  try {
    const filter = {};
    if (req.query.q)     filter.$text   = { $search: req.query.q };
    if (req.query.genre) filter.genre   = req.query.genre;
    if (req.query.artist) filter.artist = new RegExp(req.query.artist, 'i');
    const docs = await albums().find(filter).toArray();
    res.json(docs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── READ single album ─────────────────────────────────────
app.get('/albums/:id', async (req, res) => {
  try {
    const doc = await albums().findOne({ _id: new ObjectId(req.params.id) });
    if (!doc) return res.status(404).json({ error: 'Album not found' });
    res.json(doc);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── UPDATE album ──────────────────────────────────────────
app.put('/albums/:id', async (req, res) => {
  const { title, artist, genre, year, cover_url, tracks } = req.body;
  const update = {};
  if (title)     update.title     = title;
  if (artist)    update.artist    = artist;
  if (genre)     update.genre     = genre;
  if (year)      update.year      = year;
  if (cover_url) update.cover_url = cover_url;
  if (tracks)    update.tracks    = tracks;
  try {
    const result = await albums().findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: { ...update, updated_at: new Date() } },
      { returnDocument: 'after' }
    );
    if (!result) return res.status(404).json({ error: 'Album not found' });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── DELETE album ──────────────────────────────────────────
app.delete('/albums/:id', async (req, res) => {
  try {
    const result = await albums().deleteOne({ _id: new ObjectId(req.params.id) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Album not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(port, () => console.log(`✅ music-service listening on :${port}`));
