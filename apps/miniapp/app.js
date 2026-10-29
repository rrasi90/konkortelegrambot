/* آموزش کنکور — منطق مینی‌اپ (بدون وابستگی) */
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
    nightMode: false,
    home: null,
  };

  /* ---------- نمایش ---------- */
  function showView(id) {
    ['view-login', 'view-tracks', 'view-app'].forEach(function (v) {
      el(v).hidden = v !== id;
    });
  }

  var TABS = ['home', 'today', 'lessons', 'map', 'settings'];
  function showTab(tab) {
    TABS.forEach(function (t) {
      var panel = el('tab-' + t);
      if (panel) panel.hidden = t !== tab;
      var btn = document.querySelector('.nav-btn[data-tab="' + t + '"]');
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'lessons') loadLessons();
    if (tab === 'map') loadMap();
    if (tab === 'home') loadHome();
    if (tab === 'settings') renderSettings();
  }

  /* ---------- سرصفحه: سلام و آمار ---------- */
  function renderHeader() {
    var h = state.home;
    if (!h) return;
    el('header-greeting').hidden = false;
    el('header-greeting').textContent = greetingFor() + (h.user.displayName || 'داوطلب');
    el('chip-streak').hidden = false;
    el('chip-coins').hidden = false;
    el('chip-streak-n').textContent = h.stats.streakDays + ' روز پیوسته';
    el('chip-coins-n').textContent = h.stats.coins;
  }

  function greetingFor() {
    var hour = new Date().getHours();
    if (hour < 5) return 'شب‌های بخیر، ';
    if (hour < 12) return 'صبح بخیر، ';
    if (hour < 17) return 'وقت‌بخیر، ';
    if (hour < 21) return 'عصر بخیر، ';
    return 'شب بخیر، ';
  }

  function updateStatsChips(stats) {
    if (!stats) return;
    if (state.home) {
      state.home.stats.coins = stats.coins;
      state.home.stats.streakDays = stats.streakDays;
    }
    el('chip-streak-n').textContent = stats.streakDays + ' روز پیوسته';
    el('chip-coins-n').textContent = stats.coins;
  }

  /* ---------- ورود ---------- */
  function tryTelegramLogin() {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      state.telegram = window.Telegram.WebApp;
      state.telegram.ready();
      return API.post('/api/auth/telegram', { initData: state.telegram.initData })
        .then(function (data) { onAuthed(data); return true; })
        .catch(function (err) {
          console.warn('Telegram WebApp auth error:', err);
          return false;
        });
    }
    return Promise.resolve(false);
  }

  function loginWithUsername(username) {
    var err = el('login-error');
    if (err) err.hidden = true;
    return API.post('/api/auth/telegram', { telegramUsername: username })
      .then(function (data) {
        onAuthed(data);
        return true;
      })
      .catch(function (e) {
        if (err) {
          err.textContent = e.message || 'خطا در ورود به پروفایل';
          err.hidden = false;
        }
        return false;
      });
  }

  function onAuthed(data) {
    localStorage.setItem('session_token', data.token);
    state.tracks = (data.user && data.user.activeTracks) || ['common'];
    if (state.tracks.length <= 1) {
      showView('view-tracks');
    } else {
      enterApp();
    }
  }

  function enterApp() {
    showView('view-app');
    showTab('home');
  }

  var btnLogin = el('btn-login');
  if (btnLogin) {
    btnLogin.addEventListener('click', function () {
      tryTelegramLogin().then(function (ok) {
        if (!ok) {
          var input = el('input-tg-username');
          var username = input ? (input.value || '').trim() : '';
          if (username) {
            loginWithUsername(username);
          } else {
            var err = el('login-error');
            if (err) {
              err.textContent = 'برای ورود، شناسهٔ تلگرام خود را در کادر زیر وارد کنید یا دکمهٔ باز کردن ربات را لمس کنید.';
              err.hidden = false;
            }
            if (input) input.focus();
          }
        }
      });
    });
  }

  var btnWebLogin = el('btn-web-login');
  if (btnWebLogin) {
    btnWebLogin.addEventListener('click', function () {
      var input = el('input-tg-username');
      var username = input ? (input.value || '').trim() : '';
      if (!username) {
        var err = el('login-error');
        if (err) {
          err.textContent = 'لطفاً نام یا شناسهٔ تلگرام خود را در کادر بالا وارد کنید.';
          err.hidden = false;
        }
        if (input) input.focus();
        return;
      }
      loginWithUsername(username);
    });
  }

  var inputTg = el('input-tg-username');
  if (inputTg) {
    inputTg.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var username = (inputTg.value || '').trim();
        if (username) loginWithUsername(username);
      }
    });
  }

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
      enterApp();
    });
  });

  /* ---------- ناوبری پایین ---------- */
  document.querySelectorAll('.nav-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { showTab(btn.dataset.tab); });
  });

  /* ---------- داشبورد خانه ---------- */
  function loadHome() {
    API.get('/api/home').then(function (data) {
      state.home = data;
      renderHeader();
      renderHome(data);
    });
  }

  function renderHome(h) {
    var container = el('home-container');
    var trackName = { business: 'مدیریت بازرگانی', technology: 'مدیریت تکنولوژی' }[
      (h.user.activeTracks || []).filter(function (t) { return t !== 'common'; })[0]
    ] || 'هستهٔ مشترک';

    var html = '';

    // کارت همراه (ماسکات) + پیام منتور
    html +=
      '<section class="dash-card mascot-card">' +
      '<div class="mascot" aria-hidden="true">' +
      '<svg viewBox="0 0 64 64" width="56" height="56">' +
      '<circle cx="32" cy="32" r="30" fill="var(--primary-soft)"/>' +
      '<path d="M18 34a14 14 0 0 1 28 0" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"/>' +
      '<circle cx="24" cy="30" r="3" fill="var(--primary)"/>' +
      '<circle cx="40" cy="30" r="3" fill="var(--primary)"/>' +
      '<path d="M26 42c2 2 4 3 6 3s4-1 6-3" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round"/>' +
      '</svg></div>' +
      '<div class="mascot-text"><strong>همراه شما</strong>' +
      '<p>' + escapeHtml(h.mentorMessage) + '</p></div></section>';

    // کارت هدف: شمارش معکوس + پیشرفت کل مسیر
    html += '<section class="dash-card goal-card">';
    if (h.stats.daysLeft !== null && h.stats.daysLeft >= 0) {
      html +=
        '<div class="goal-countdown"><span class="count-num">' + h.stats.daysLeft + '</span>' +
        '<span class="count-label">روز تا کنکور</span></div>';
    }
    html +=
      '<div class="goal-title">هدف: ' + escapeHtml(trackName) + '</div>' +
      '<div class="labels"><span>کل مسیر</span><span>' + h.progress.overall + '٪</span></div>' +
      '<div class="bar"><div class="fill" style="width:' + h.progress.overall + '%"></div></div>' +
      '</section>';

    // کارت درس روز
    html +=
      '<section class="dash-card lesson-card">' +
      '<div class="lesson-head"><span>روز ' + (h.stats.dayNumber + (h.today.answered > 0 ? 0 : 1)) + '</span>' +
      '<span>' + h.reviewDue + ' کارت برای مرور</span></div>' +
      '<p class="lesson-sub">امروز ' + h.today.answered + ' پاسخ ثبت کرده‌اید (' + h.today.correct + ' درست)</p>' +
      '<button id="btn-start-lesson" class="btn primary">شروع درس امروز</button>' +
      '</section>';

    // کوییز شبانه
    html += '<section class="dash-card night-card' + (h.nightQuiz.available ? '' : ' off') + '">';
    if (h.nightQuiz.available) {
      html +=
        '<div class="night-head"><span class="night-icon" aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z" fill="currentColor"/></svg></span>' +
        '<div><strong>کوییز شبانه</strong>' +
        '<p>' + h.nightQuiz.wrongCount + ' سؤالِ اشتباه امروز را دوباره می‌سنجیم</p></div></div>' +
        '<button id="btn-night-quiz" class="btn ghost small">شروع کوییز شبانه</button>';
    } else {
      html +=
        '<div class="night-head"><div><strong>کوییز شبانه</strong>' +
        '<p>امروز اشتباهی نداشته‌اید؛ شب که شد، گره‌های متزلزل را مرور می‌کنیم.</p></div></div>';
    }
    html += '</section>';

    container.innerHTML = html;

    var startBtn = el('btn-start-lesson');
    if (startBtn) startBtn.addEventListener('click', function () {
      state.nightMode = false;
      showTab('today');
      loadQueue();
    });
    var nightBtn = el('btn-night-quiz');
    if (nightBtn) nightBtn.addEventListener('click', startNightQuiz);
  }

  function startNightQuiz() {
    API.get('/api/night-quiz').then(function (data) {
      if (!data.items || data.items.length === 0) return;
      state.queue = data.items;
      state.nightMode = true;
      state.currentIndex = 0;
      showTab('today');
      renderCurrent();
    });
  }

  /* ---------- صف امروز ---------- */
  function loadQueue() {
    API.get('/api/queue?limit=10').then(function (data) {
      state.queue = data.items || [];
      state.nightMode = false;
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
      empty.querySelector('p').textContent = state.nightMode
        ? 'کوییز شبانه تمام شد؛ خواب خوبی داشته باشید.'
        : 'برای امروز برنامه‌ای نمانده است. خسته نباشید!';
      return;
    }
    empty.hidden = true;
    card.hidden = false;
    el('answer-feedback').hidden = true;
    var item = state.queue[state.currentIndex];
    el('q-course').textContent = (state.nightMode ? 'کوییز شبانه — ' : '') + (item.course || '');
    el('q-chapter').textContent = item.chapter || '';
    var isTrap = item.card.cardType === 'trap_note';
    el('q-card-type').hidden = !isTrap;
    var vChip = el('q-verification');
    if (vChip) {
      vChip.hidden = false;
      if (item.question && item.question.isVerified) {
        vChip.className = 'chip success';
        vChip.textContent = 'سؤال رسمی تأییدشده';
      } else {
        vChip.className = 'chip ghost';
        vChip.textContent = 'نمونهٔ آموزشی (تأییدنشده)';
      }
    }

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
      if (data.stats) updateStatsChips(data.stats);
      showFeedback(item, data.report, selected, data.correctOption, data.explanation, data.trapNote, data.lesson);
    });
  }

  function showFeedback(item, report, selected, correctOption, explanation, trapNote, lesson) {
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

    var finalExplanation = explanation || (question && question.explanation) || (item.trapNote || '');
    el('feedback-explanation').textContent = finalExplanation;
    var finalTrap = trapNote || (question && question.trapNote) || '';
    var trap = el('feedback-trap');
    if (finalTrap) {
      trap.textContent = 'دام طراح: ' + finalTrap;
      trap.hidden = false;
    } else {
      trap.hidden = true;
    }
    el('feedback-mentor').textContent = report.mentorMessage || '';
    renderRipple(report);

    // آموزش کامل مبحث کنکور زیر هر سؤال
    var lessonBox = el('feedback-lesson-card');
    if (lessonBox) {
      if (lesson) {
        lessonBox.hidden = false;
        el('lesson-feedback-title').textContent = (lesson.course ? lesson.course + ' — ' : '') + (lesson.topic || '');
        el('lesson-feedback-body').textContent = lesson.summary || '';

        var tipsBox = el('lesson-feedback-tips');
        if (tipsBox) {
          if (lesson.konkoorTips && lesson.konkoorTips.length > 0) {
            tipsBox.hidden = false;
            tipsBox.innerHTML = '<strong>💡 نکات طلایی و تله‌های تستی کنکور دکتری:</strong><ul style="margin:6px 0 0;padding-right:16px;">' +
              lesson.konkoorTips.map(function (tip) { return '<li>' + escapeHtml(tip) + '</li>'; }).join('') +
              '</ul>';
          } else {
            tipsBox.hidden = true;
          }
        }

        var termsBox = el('lesson-feedback-terms');
        if (termsBox) {
          if (lesson.keyTerms && lesson.keyTerms.length > 0) {
            termsBox.hidden = false;
            termsBox.innerHTML = '<span style="font-size:11px;color:var(--ink-soft);margin-left:4px;">اصطلاحات تخصصی:</span>' +
              lesson.keyTerms.map(function (term) { return '<span class="lesson-term-badge">' + escapeHtml(term) + '</span>'; }).join('');
          } else {
            termsBox.hidden = true;
          }
        }
      } else {
        lessonBox.hidden = true;
      }
    }

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

  /* ---------- تنظیمات / من ---------- */
  function renderSettings() {
    document.querySelectorAll('.track-toggle .toggle').forEach(function (btn) {
      btn.classList.toggle('on', state.tracks.indexOf(btn.dataset.track) !== -1);
    });
    if (state.home && state.home.stats.examDate) {
      el('input-exam-date').value = state.home.stats.examDate;
    }
  }

  document.querySelectorAll('.track-toggle .toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var t = btn.dataset.track;
      var idx = state.tracks.indexOf(t);
      if (idx === -1) state.tracks.push(t); else state.tracks.splice(idx, 1);
      var tracks = state.tracks.filter(function (x) { return x !== 'common'; });
      API.put('/api/tracks', { tracks: tracks }).then(function () {
        renderSettings();
      });
    });
  });

  el('btn-save-exam').addEventListener('click', function () {
    var value = el('input-exam-date').value || null;
    API.put('/api/settings', { examDate: value }).then(function () {
      el('settings-saved').hidden = false;
      loadHome();
      setTimeout(function () { el('settings-saved').hidden = true; }, 2000);
    });
  });

  el('btn-logout').addEventListener('click', function () {
    localStorage.removeItem('session_token');
    showView('view-login');
  });

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
      else enterApp();
    }).catch(function () { /* 401 → صفحهٔ ورود */ });
  } else {
    tryTelegramLogin().then(function (ok) {
      if (!ok) {
        var params = new URLSearchParams(window.location.search);
        var tgParam = params.get('tg') || params.get('user');
        if (tgParam) {
          loginWithUsername(tgParam);
        } else {
          showView('view-login');
        }
      }
    });
  }
})();
