// Soundwave: MongoDB seed for Music catalog (Document Store)
db = db.getSiblingDB('soundwave_music');

db.createCollection('albums');
db.createCollection('tracks');

db.albums.insertMany([
  {
    _id: ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'),
    title: 'Midnight Echoes',
    artist: 'The Neon Ghosts',
    genre: 'Synthwave',
    year: 2023,
    cover_url: 'https://picsum.photos/seed/album1/300/300',
    tracks: [
      { order: 1, title: 'Neon Rain',       duration_s: 214 },
      { order: 2, title: 'Phantom Drive',   duration_s: 198 },
      { order: 3, title: 'Lost Signal',     duration_s: 241 },
    ]
  },
  {
    _id: ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'),
    title: 'Cerrado Sessions',
    artist: 'Trio Bandeiro',
    genre: 'MPB',
    year: 2022,
    cover_url: 'https://picsum.photos/seed/album2/300/300',
    tracks: [
      { order: 1, title: 'Vereda',          duration_s: 187 },
      { order: 2, title: 'Sertão Azul',     duration_s: 210 },
      { order: 3, title: 'Chapada',         duration_s: 228 },
    ]
  },
  {
    _id: ObjectId('cccccccccccccccccccccccc'),
    title: 'Deep Frequencies',
    artist: 'Orbital Phase',
    genre: 'Electronic',
    year: 2024,
    cover_url: 'https://picsum.photos/seed/album3/300/300',
    tracks: [
      { order: 1, title: 'Sub Zero',        duration_s: 320 },
      { order: 2, title: 'Resonance',       duration_s: 285 },
      { order: 3, title: 'Waveform 9',      duration_s: 298 },
    ]
  }
]);

db.albums.createIndex({ artist: 1 });
db.albums.createIndex({ genre: 1 });
db.albums.createIndex({ title: 'text', 'tracks.title': 'text' });
