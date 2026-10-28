/* مسیر دکتری — منطق مینی‌اپ (بدون وابستگی) */
(function () {
  'use strict';

  var API = {
    get: function (path) { return request('GET', path); },
    post: function (path, body) { return request('POST', path, body); },
    put: function (path, body) { return request('PUT', path, body); },
  };

  var API_BASE = (typeof window !== 'undefined' && window.AEL_API_BASE) || '';

  function request(method, path, body) {
    var token = localStorage.getItem('session_token') || '';
    return fetch(API_BASE + path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: token ? 'Bearer ' + token : '',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }).then(function (res) {
      if (res.status === 401) {
        localStorage.removeItem('session_token');
        showView('view-login');
        throw new Error('ابتدا وارد شوید');
      }
      return res.json().then(function (data) {
        if (!res.ok) throw new Error((data && data.error) || 'خطای سرور');
        return data;
      });
    });
  }

  var el = function (id) { return document.getElementById(id); };
  var state = {
    tracks: ['common'],
    queue: [],
    currentIndex: 0,
    selectedTrack: null,
    telegram: null,
  };

  /* ---------- نمایش ---------- */
  function showView(id) {
    ['view-login', 'view-tracks', 'view-app'].forEach(function (v) {
      el(v).hidden = v !== id;
    });
  }

  function showTab(tab) {
    ['today', 'map', 'settings'].forEach(function (t) {
      el('tab-' + t).hidden = t !== tab;
      var btn = document.querySelector('.tab[data-tab="' + t + '"]');
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'map') loadMap();
  }

  /* ---------- ورود ---------- */
  function tryTelegramLogin() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      state.telegram = window.Telegram.WebApp;
      state.telegram.ready();
      return API.post('/api/auth/telegram', { initData: state.telegram.initData })
        .then(function (data) { onAuthed(data); return true; })
        .catch(function () { return false; });
    }
    return Promise.resolve(false);
  }

  function onAuthed(data) {
    localStorage.setItem('session_token', data.token);
    state.tracks = (data.user && data.user.activeTracks) || ['common'];
    if (state.tracks.length <= 1) {
      // فقط هستهٔ مشترک — انتخاب گرایش لازم است
      showView('view-tracks');
    } else {
      showView('view-app');
      loadQueue();
    }
  }

  el('btn-login').addEventListener('click', function () {
    tryTelegramLogin().then(function (ok) {
      if (!ok) {
        var err = el('login-error');
        err.textContent = 'دسترسی تلگرام در دسترس نیست؛ از ورود نمایشی استفاده کنید.';
        err.hidden = false;
      }
    });
  });

  el('btn-demo').addEventListener('click', function () {
    API.post('/api/auth/demo', { displayName: 'داوطلب' }).then(onAuthed);
  });

  /* ---------- انتخاب گرایش ---------- */
  document.querySelectorAll('.track-card').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.track-card').forEach(function (b) { b.classList.remove('selected'); });
      btn.classList.add('selected');
      state.selectedTrack = btn.dataset.track;
      el('btn-tracks-save').disabled = false;
    });
  });

  el('btn-tracks-save').addEventListener('click', function () {
    if (!state.selectedTrack) return;
    API.put('/api/tracks', { tracks: [state.selectedTrack] }).then(function () {
      state.tracks = ['common', state.selectedTrack];
      showView('view-app');
      loadQueue();
    });
  });

  /* ---------- تب‌ها ---------- */
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () { showTab(btn.dataset.tab); });
  });

  /* ---------- صف امروز ---------- */
  function loadQueue() {
    API.get('/api/queue?limit=10').then(function (data) {
      state.queue = data.items || [];
      state.currentIndex = 0;
      renderCurrent();
    });
  }

  function renderCurrent() {
    var empty = el('queue-empty');
    var card = el('quiz-card');
    if (state.currentIndex >= state.queue.length) {
      card.hidden = true;
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    card.hidden = false;
    el('answer-feedback').hidden = true;
    var item = state.queue[state.currentIndex];
    el('q-course').textContent = item.course || '';
    el('q-chapter').textContent = item.chapter || '';
    var isTrap = item.card.cardType === 'trap_note';
    el('q-card-type').hidden = !isTrap;

    if (isTrap) {
      el('q-text').textContent = 'نکتهٔ دام: ' + (item.trapNote || item.question && item.question.text);
      renderTrapOptions(item);
    } else {
      el('q-text').textContent = item.question.text;
      renderOptions(item.question.options);
    }
  }

  function renderOptions(options) {
    var box = el('q-options');
    box.innerHTML = '';
    options.forEach(function (opt, i) {
      var btn = document.createElement('button');
      btn.className = 'option';
      btn.innerHTML = '<span class="key">' + (i + 1) + '</span><span>' + escapeHtml(opt) + '</span>';
      btn.addEventListener('click', function () { submitAnswer(i); });
      box.appendChild(btn);
    });
  }

  function renderTrapOptions(item) {
    var box = el('q-options');
    box.innerHTML = '';
    var btn = document.createElement('button');
    btn.className = 'option';
    btn.innerHTML = '<span class="key">✓</span><span>خواندم؛ این دام را به خاطر می‌سپارم</span>';
    btn.addEventListener('click', function () { submitAnswer(0); });
    box.appendChild(btn);
  }

  function submitAnswer(selected) {
    var item = state.queue[state.currentIndex];
    var questionId = item.card.questionId;
    var attemptId = 'att-' + questionId + '-' + Date.now() + '-' + Math.floor(Math.random() * 1e6);
    document.querySelectorAll('.option').forEach(function (b) { b.disabled = true; });
    API.post('/api/answers', {
      attemptId: attemptId,
      questionId: questionId,
      selectedOption: selected,
    }).then(function (data) {
      showFeedback(item, data.report, selected, data.correctOption);
    });
  }

  function showFeedback(item, report, selected, correctOption) {
    var box = el('answer-feedback');
    box.hidden = false;
    var head = el('feedback-head');
    if (report.wasCorrect) {
      head.textContent = 'پاسخ درست';
      head.className = 'feedback-head ok';
    } else {
      head.textContent = 'پاسخ نادرست';
      head.className = 'feedback-head bad';
    }
    var question = item.question;
    var options = document.querySelectorAll('.option');
    if (correctOption !== undefined && options[correctOption]) {
      options[correctOption].classList.add('correct');
    }
    if (options[selected] && !report.wasCorrect) options[selected].classList.add('wrong');

    el('feedback-explanation').textContent = question && question.explanation
      ? question.explanation
      : (item.trapNote || '');
    var trap = el('feedback-trap');
    if (question && question.trapNote) {
      trap.textContent = 'دام طراح: ' + question.trapNote;
      trap.hidden = false;
    } else {
      trap.hidden = true;
    }
    el('feedback-mentor').textContent = report.mentorMessage || '';
    renderRipple(report);
    el('btn-next').onclick = function () {
      state.currentIndex += 1;
      renderCurrent();
    };
  }

  function renderRipple(report) {
    var box = el('feedback-ripple');
    var deltas = (report.masteryDeltas || []).filter(function (d) { return d.before !== d.after; });
    if (deltas.length === 0) {
      box.innerHTML = '';
      return;
    }
    var html = '<p class="ripple-title">موج اثر این پاسخ بر نقشهٔ تسلط شما:</p>';
    deltas.forEach(function (d) {
      var pct = Math.round(d.after);
      var cls = pct < 40 ? 'bad' : pct < 60 ? 'warn' : pct < 85 ? '' : 'ok';
      html +=
        '<div class="mastery-row">' +
        '<div class="labels"><span>' + escapeHtml(d.nodeId) + '</span><span>' +
        d.before.toFixed(0) + '٪ ← ' + pct + '٪</span></div>' +
        '<div class="bar"><div class="fill ' + cls + '" style="width:' + pct + '%"></div></div>' +
        '</div>';
    });
    box.innerHTML = html;
  }

  /* ---------- نقشهٔ مسیر ---------- */
  function loadMap() {
    API.get('/api/map').then(function (data) {
      var container = el('map-container');
      var html = '';
      (data.courses || []).forEach(function (course) {
        html += '<section class="course-block"><h3 class="course-title">' + escapeHtml(course.course) + '</h3>';
        course.chapters.forEach(function (chapter) {
          html += '<p class="chapter-title">' + escapeHtml(chapter.chapter) + '</p>';
          chapter.nodes.forEach(function (node) {
            var pct = Math.round(node.mastery);
            var cls = pct < 40 ? 'bad' : pct < 60 ? 'warn' : pct < 85 ? '' : 'ok';
            var badge = {
              weak: 'ضعیف', unstable: 'متزلزل', learning: 'در حال یادگیری', mastered: 'تثبیت‌شده',
            }[node.status] || node.status;
            html +=
              '<div class="node-row"><div class="labels"><span class="node-name">' +
              escapeHtml(node.topic) + '</span>' +
              '<span class="status-badge ' + node.status + '">' + badge + ' · ' + pct + '٪</span></div>' +
              '<div class="bar"><div class="fill ' + cls + '" style="width:' + pct + '%"></div></div></div>';
          });
        });
        html += '</section>';
      });
      container.innerHTML = html || '<div class="empty-state"><p>گرایشی انتخاب نشده است.</p></div>';
    });
  }

  /* ---------- تنظیمات ---------- */
  function renderSettings() {
    document.querySelectorAll('.track-toggle .toggle').forEach(function (btn) {
      btn.classList.toggle('on', state.tracks.indexOf(btn.dataset.track) !== -1);
    });
  }

  document.querySelectorAll('.track-toggle .toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.dataset.track;
      var idx = state.tracks.indexOf(t);
      if (idx === -1) state.tracks.push(t); else state.tracks.splice(idx, 1);
      var tracks = state.tracks.filter(function (x) { return x !== 'common'; });
      API.put('/api/tracks', { tracks: tracks }).then(function () {
        renderSettings();
        loadQueue();
      });
    });
  });

  el('btn-logout').addEventListener('click', function () {
    localStorage.removeItem('session_token');
    showView('view-login');
  });

  el('tab-settings').addEventListener('click', renderSettings);

  /* ---------- راه‌اندازی ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' }[c];
    });
  }

  if (localStorage.getItem('session_token')) {
    API.get('/api/me').then(function (data) {
      state.tracks = (data.user && data.user.activeTracks) || ['common'];
      if (state.tracks.length <= 1) showView('view-tracks');
      else { showView('view-app'); loadQueue(); }
    }).catch(function () { /* 401 → صفحهٔ ورود */ });
  } else {
    tryTelegramLogin().then(function (ok) {
      if (!ok) showView('view-login');
    });
  }
})();
