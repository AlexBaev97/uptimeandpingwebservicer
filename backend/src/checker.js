const http = require('http');
const https = require('https');
const { URL } = require('url');

const TICK = Number(process.env.SCHEDULER_TICK_MS || 5000);
const TIMEOUT = Number(process.env.CHECK_TIMEOUT_MS || 10000);

function checkUrl(rawUrl) {
  return new Promise((resolve) => {
    let url;
    try {
      url = new URL(rawUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return resolve({ status: 'down', error_message: 'unsupported protocol' });
      }
    } catch (e) {
      return resolve({ status: 'down', error_message: 'invalid url' });
    }
    const mod = url.protocol === 'https:' ? https : http;
    const started = Date.now();
    const req = mod.get(url, { headers: { 'User-Agent': 'uptime-monitor/1.0' } }, (res) => {
      const ms = Date.now() - started;
      const ok = res.statusCode >= 200 && res.statusCode < 400;
      res.resume();
      resolve({ status: ok ? 'up' : 'down', http_code: res.statusCode, response_time_ms: ms });
    });
    const hard = setTimeout(() => req.destroy(new Error('timeout')), TIMEOUT);
    req.on('close', () => clearTimeout(hard));
    req.on('error', (err) => resolve({ status: 'down', error_message: err.message }));
  });
}

async function runCheck(pool, target) {
  const result = await checkUrl(target.url);
  try {
    await pool.query(
      'INSERT INTO checks (target_id, status, http_code, response_time_ms, error_message) VALUES ($1, $2, $3, $4, $5)',
      [target.id, result.status, result.http_code ?? null, result.response_time_ms ?? null, result.error_message ?? null]
    );
    await pool.query(
      'UPDATE targets SET last_status = $2, last_response_time_ms = $3, last_checked_at = now() WHERE id = $1',
      [target.id, result.status, result.response_time_ms ?? null]
    );
  } catch (e) {
    console.error('failed to record check', e.message);
  }
}

async function tick(pool) {
  let targets;
  try {
    const { rows } = await pool.query('SELECT * FROM targets WHERE is_active = TRUE');
    targets = rows;
  } catch (e) {
    console.error('failed to load targets', e.message);
    return;
  }
  const now = Date.now();
  const due = targets.filter((t) => {
    if (!t.last_checked_at) return true;
    const last = new Date(t.last_checked_at).getTime();
    return now - last >= (t.interval_seconds || 60) * 1000;
  });
  await Promise.allSettled(due.map((t) => runCheck(pool, t)));
}

function startScheduler(pool) {
  tick(pool);
  setInterval(() => tick(pool), TICK);
  console.log('scheduler started (tick ' + TICK + 'ms, timeout ' + TIMEOUT + 'ms)');
}

module.exports = { startScheduler, checkUrl };
