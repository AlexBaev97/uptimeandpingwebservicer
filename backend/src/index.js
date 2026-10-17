const express = require('express');
const path = require('path');
const fs = require('fs');
const pool = require('./db');
const { startScheduler } = require('./checker');

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);

async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
}

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

app.get('/api/targets', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM targets ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/targets', async (req, res) => {
  const { name, url, interval_seconds } = req.body || {};
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required' });
  }
  let normalized = url;
  if (!/^https?:\/\//i.test(normalized)) normalized = 'https://' + normalized;
  try {
    const { rows } = await pool.query(
      'INSERT INTO targets (name, url, interval_seconds) VALUES ($1, $2, $3) RETURNING *',
      [name, normalized, interval_seconds || 60]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/targets/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { is_active, name, url, interval_seconds } = req.body || {};
  try {
    const { rows } = await pool.query(
      'UPDATE targets SET is_active = COALESCE($2, is_active), name = COALESCE($3, name), url = COALESCE($4, url), interval_seconds = COALESCE($5, interval_seconds) WHERE id = $1 RETURNING *',
      [id, is_active, name, url, interval_seconds]
    );
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/targets/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const { rowCount } = await pool.query('DELETE FROM targets WHERE id = $1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/checks', async (req, res) => {
  const targetId = req.query.target_id ? Number(req.query.target_id) : null;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);
  try {
    if (targetId) {
      const { rows } = await pool.query(
        'SELECT * FROM checks WHERE target_id = $1 ORDER BY checked_at DESC LIMIT $2',
        [targetId, limit]
      );
      return res.json(rows);
    }
    const { rows } = await pool.query('SELECT * FROM checks ORDER BY checked_at DESC LIMIT $1', [limit]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT t.id, t.name, t.url, t.is_active, t.last_status, t.last_response_time_ms, t.last_checked_at, count(c.id) FILTER (WHERE c.status = 'up') AS ups, count(c.id) AS total FROM targets t LEFT JOIN checks c ON c.target_id = t.id GROUP BY t.id ORDER BY t.created_at DESC"
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

initDb()
  .then(() => startScheduler(pool))
  .then(() => {
    app.listen(PORT, () => console.log('API listening on :' + PORT));
  })
  .catch((e) => {
    console.error('startup failed', e);
    process.exit(1);
  });
