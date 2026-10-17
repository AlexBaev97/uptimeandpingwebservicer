(function () {
  var API = '/api';
  var refreshMs = 10000;

  var form = document.getElementById('add-form');
  var targetsEl = document.getElementById('targets');
  var toastEl = document.getElementById('toast');

  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isError ? ' error' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.className = 'toast hidden'; }, 3000);
  }

  function fmtDate(s) {
    if (!s) return '—';
    var d = new Date(s);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('ru-RU');
  }

  function fetchJSON(url, opts) {
    return fetch(url, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || ('HTTP ' + r.status));
        return j;
      });
    });
  }

  function renderTargets(targets, statsMap) {
    targetsEl.innerHTML = '';
    if (!targets.length) {
      var empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'Пока нет ни одного сайта. Добавьте первый выше.';
      targetsEl.appendChild(empty);
      return;
    }
    targets.forEach(function (t) {
      var st = statsMap[t.id] || {};
      var card = document.createElement('div');
      card.className = 'card target';

      var head = document.createElement('div');
      head.className = 'target-head';

      var info = document.createElement('div');
      var nameEl = document.createElement('h3');
      nameEl.textContent = t.name;
      var urlEl = document.createElement('a');
      urlEl.href = t.url;
      urlEl.target = '_blank';
      urlEl.rel = 'noopener';
      urlEl.textContent = t.url;
      info.appendChild(nameEl);
      info.appendChild(urlEl);

      var statusEl = document.createElement('span');
      var cls = t.last_status === 'up' ? 'up' : (t.last_status === 'down' ? 'down' : 'pending');
      var label = t.last_status === 'up' ? 'UP' : (t.last_status === 'down' ? 'DOWN' : 'ожидание');
      statusEl.className = 'badge ' + cls;
      statusEl.textContent = label;

      head.appendChild(info);
      head.appendChild(statusEl);

      var meta = document.createElement('div');
      meta.className = 'meta';
      var rt = document.createElement('span');
      rt.textContent = 'Ответ: ' + (t.last_response_time_ms != null ? t.last_response_time_ms + ' мс' : '—');
      var last = document.createElement('span');
      last.textContent = 'Проверено: ' + fmtDate(t.last_checked_at);
      var uptime = document.createElement('span');
      var pct = (st.total > 0) ? Math.round((st.ups / st.total) * 100) : null;
      uptime.textContent = 'Uptime: ' + (pct == null ? '—' : pct + '%');
      meta.appendChild(rt);
      meta.appendChild(last);
      meta.appendChild(uptime);

      var actions = document.createElement('div');
      actions.className = 'actions';

      var toggleBtn = document.createElement('button');
      toggleBtn.textContent = t.is_active ? 'Пауза' : 'Возобновить';
      toggleBtn.className = 'ghost';
      toggleBtn.addEventListener('click', function () { toggleTarget(t.id, !t.is_active); });

      var delBtn = document.createElement('button');
      delBtn.textContent = 'Удалить';
      delBtn.className = 'danger';
      delBtn.addEventListener('click', function () { deleteTarget(t.id); });

      actions.appendChild(toggleBtn);
      actions.appendChild(delBtn);

      card.appendChild(head);
      card.appendChild(meta);
      card.appendChild(actions);
      targetsEl.appendChild(card);
    });
  }

  function load() {
    Promise.all([
      fetchJSON(API + '/targets'),
      fetchJSON(API + '/stats')
    ]).then(function (res) {
      var statsMap = {};
      res[1].forEach(function (s) { statsMap[s.id] = s; });
      renderTargets(res[0], statsMap);
    }).catch(function (e) {
      toast('Ошибка загрузки: ' + e.message, true);
    });
  }

  function addTarget() {
    var name = document.getElementById('name').value.trim();
    var url = document.getElementById('url').value.trim();
    var interval = parseInt(document.getElementById('interval').value, 10) || 60;
    if (!name || !url) { toast('Заполните название и URL', true); return; }
    fetchJSON(API + '/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name, url: url, interval_seconds: interval })
    }).then(function () {
      form.reset();
      toast('Сайт добавлен');
      load();
    }).catch(function (e) {
      toast('Ошибка: ' + e.message, true);
    });
  }

  function deleteTarget(id) {
    fetchJSON(API + '/targets/' + id, { method: 'DELETE' })
      .then(function () { toast('Удалено'); load(); })
      .catch(function (e) { toast('Ошибка: ' + e.message, true); });
  }

  function toggleTarget(id, active) {
    fetchJSON(API + '/targets/' + id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: active })
    }).then(function () { load(); })
      .catch(function (e) { toast('Ошибка: ' + e.message, true); });
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    addTarget();
  });

  load();
  setInterval(load, refreshMs);
})();
