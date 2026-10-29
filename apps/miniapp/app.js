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
    nightMode: false,
    home: null,
  };

  /* ---------- نمایش ---------- */
  function showView(id) {
    ['view-login', 'view-tracks', 'view-app'].forEach(function (v) {
      el(v).hidden = v !== id;
    });
  }

  var TABS = ['home', 'today', 'map', 'settings'];
  function showTab(tab) {
    TABS.forEach(function (t) {
      el('tab-' + t).hidden = t !== tab;
      var btn = document.querySelector('.nav-btn[data-tab="' + t + '"]');
      if (btn) btn.classList.toggle('active', t === tab);
    });
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
      enterApp();
    }
  }

  function enterApp() {
    showView('view-app');
    showTab('home');
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
    item.startedAt = Date.now();
    el('q-course').textContent = (state.nightMode ? 'کوییز شبانه — ' : '') + (item.course || '');
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
    btn.addEventListener('click', markTrapRead);
    box.appendChild(btn);
  }

  function markTrapRead() {
    var item = state.queue[state.currentIndex];
    document.querySelectorAll('.option').forEach(function (b) { b.disabled = true; });
    API.post('/api/trap-cards/seen', { cardId: item.card.id }).then(function () {
      el('answer-feedback').hidden = false;
      el('feedback-head').textContent = 'نکته ثبت شد';
      el('feedback-head').className = 'feedback-head ok';
      el('feedback-explanation').textContent = item.trapNote || 'این نکته برای مرور بعدی زمان‌بندی شد.';
      el('feedback-trap').hidden = true;
      el('feedback-mentor').textContent = 'مرور نکته ثبت شد؛ این کار به‌تنهایی به‌عنوان پاسخ درست یا افزایش تسلط شمرده نمی‌شود.';
      el('feedback-ripple').innerHTML = '';
      el('btn-next').onclick = function () { state.currentIndex += 1; renderCurrent(); };
    }).catch(function () {
      document.querySelectorAll('.option').forEach(function (b) { b.disabled = false; });
      el('answer-feedback').hidden = false;
      el('feedback-head').textContent = 'خطا در ثبت مرور';
      el('feedback-explanation').textContent = 'ارتباط برقرار نشد. دوباره تلاش کنید.';
    });
  }

  function submitAnswer(selected) {
    var item = state.queue[state.currentIndex];
    if (!item || item.card.cardType === 'trap_note' || !item.question || !item.attemptId) {
      el('feedback-mentor').textContent = 'این سؤال نشست معتبر ندارد؛ صف سؤال‌ها را دوباره بارگیری کنید.';
      return;
    }
    var questionId = item.question.id;
    document.querySelectorAll('.option').forEach(function (b) { b.disabled = true; });
    API.post('/api/answers', {
      attemptId: item.attemptId,
      questionId: questionId,
      selectedOption: selected,
      responseTimeMs: Math.min(3600000, Math.max(0, Date.now() - (item.startedAt || Date.now()))),
      studyMode: 'desk',
      assistance: [],
    }).then(function (data) {
      if (data.stats) updateStatsChips(data.stats);
      if (item.question && data.explanation) item.question.explanation = data.explanation;
      if (item.question && data.trapNote) item.question.trapNote = data.trapNote;
      showFeedback(item, data.report, selected, data.correctOption);
    }).catch(function () {
      document.querySelectorAll('.option').forEach(function (b) { b.disabled = false; });
      el('answer-feedback').hidden = false;
      el('feedback-head').textContent = 'خطا در ثبت پاسخ';
      el('feedback-explanation').textContent = 'پاسخ ذخیره نشد. اتصال را بررسی کنید و دوباره تلاش کنید.';
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
    renderDiagnosisControls(item, report);
    el('btn-next').onclick = function () {
      state.currentIndex += 1;
      renderCurrent();
    };
  }

  function renderDiagnosisControls(item, report) {
    var box = el('diagnosis-controls');
    if (!box) {
      box = document.createElement('div');
      box.id = 'diagnosis-controls';
      box.className = 'diagnosis-controls';
      el('btn-next').parentNode.insertBefore(box, el('btn-next'));
    }
    box.innerHTML = '';
    if (report.wasCorrect || !item || !item.card || !item.card.nodeId) return;

    var title = document.createElement('p');
    title.className = 'lesson-sub';
    title.textContent = 'برای انتخاب گام بعدی، نوع خطا را مشخص کنید؛ این انتخاب خوداظهاری است و از پاسخ غلط به‌تنهایی نتیجه‌گیری نمی‌کند.';
    box.appendChild(title);
    var options = [
      { value: 'slip', label: 'بی‌دقتی یا لغزش' },
      { value: 'conceptual', label: 'شکاف مفهومی' },
      { value: 'confusable', label: 'اشتباه بین دو مفهوم' },
      { value: 'computational', label: 'اشتباه محاسباتی' }
    ];
    options.forEach(function (option) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn ghost diagnosis-choice';
      button.textContent = option.label;
      button.addEventListener('click', function () {
        box.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
        API.post('/api/diagnosis', {
          skillId: item.card.nodeId,
          errorType: option.value
        }).then(function (data) {
          var message = document.createElement('p');
          message.className = 'diagnosis-result';
          message.textContent = data.nextStep || 'نوع خطا ثبت شد.';
          box.appendChild(message);
          if (data.assets && data.assets.length) {
            data.assets.forEach(function (asset) {
              var lesson = document.createElement('article');
              lesson.className = 'learning-asset';
              var heading = document.createElement('strong');
              heading.textContent = asset.title;
              lesson.appendChild(heading);
              var content = document.createElement('p');
              content.textContent = typeof asset.content.text === 'string'
                ? asset.content.text
                : typeof asset.content.body === 'string'
                  ? asset.content.body
                  : 'محتوای این بخش در قالب ساخت‌یافتهٔ تأییدشده آماده شده است.';
              lesson.appendChild(content);
              var start = document.createElement('button');
              start.type = 'button';
              start.className = 'btn small primary';
              start.textContent = 'شروع مطالعه';
              start.addEventListener('click', function () {
                API.post('/api/remediation', {
                  skillId: item.card.nodeId,
                  assetId: asset.id,
                  status: 'started'
                }).then(function () {
                  start.textContent = 'مطالعه شروع شد';
                  start.disabled = true;
                  var complete = document.createElement('button');
                  complete.type = 'button';
                  complete.className = 'btn small ghost';
                  complete.textContent = 'مطالعه تمام شد';
                  complete.addEventListener('click', function () {
                    API.post('/api/remediation', {
                      skillId: item.card.nodeId,
                      assetId: asset.id,
                      status: 'completed'
                    }).then(function () {
                      complete.textContent = 'ثبت شد؛ سؤال تازه لازم است';
                      complete.disabled = true;
                    });
                  });
                  lesson.appendChild(complete);
                });
              });
              lesson.appendChild(start);
              box.appendChild(lesson);
            });
          }
        }).catch(function () {
          var error = document.createElement('p');
          error.className = 'diagnosis-result';
          error.textContent = 'ثبت نوع خطا انجام نشد؛ اتصال را بررسی کنید.';
          box.appendChild(error);
        });
      });
      box.appendChild(button);
    });
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
    if (state.home && state.home.user && Number.isInteger(state.home.user.dailyCapacity)) {
      el('input-daily-minutes').value = String(state.home.user.dailyCapacity);
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

  el('btn-save-daily').addEventListener('click', function () {
    var minutes = Number(el('input-daily-minutes').value);
    if (!Number.isInteger(minutes) || minutes < 10 || minutes > 480) {
      el('settings-saved').hidden = false;
      el('settings-saved').textContent = 'زمان باید بین ۱۰ تا ۴۸۰ دقیقه باشد.';
      return;
    }
    API.put('/api/settings', { dailyMinutes: minutes }).then(function () {
      el('settings-saved').textContent = 'زمان مطالعه ذخیره شد.';
      el('settings-saved').hidden = false;
      loadHome();
      setTimeout(function () {
        el('settings-saved').hidden = true;
        el('settings-saved').textContent = 'ذخیره شد.';
      }, 2000);
    }).catch(function () {
      el('settings-saved').textContent = 'ذخیره انجام نشد؛ دوباره تلاش کنید.';
      el('settings-saved').hidden = false;
    });
  });

  el('btn-logout').addEventListener('click', function () {
    localStorage.removeItem('session_token');
    showView('view-login');
  });

  el('btn-start-verification').addEventListener('click', function () {
    var button = el('btn-start-verification');
    var note = el('verification-note');
    button.disabled = true;
    API.get('/api/verification').then(function (data) {
      if (!data.available) {
        note.textContent = data.message || 'سؤال دیده‌نشدهٔ آماده‌ای وجود ندارد.';
        note.hidden = false;
        button.disabled = false;
        return;
      }
      button.disabled = false;
      state.queue = [{
        card: { id: 'verification:' + data.question.id, nodeId: data.skillId, cardType: 'question', questionId: data.question.id, timesSeen: 0 },
        question: data.question,
        attemptId: data.attemptId,
        course: data.course || 'اثبات یادگیری',
        chapter: data.chapter || '',
        isVerification: true
      }];
      state.currentIndex = 0;
      state.nightMode = false;
      note.textContent = data.note || '';
      note.hidden = false;
      renderCurrent();
    }).catch(function () {
      note.textContent = 'دریافت سؤال تازه انجام نشد؛ اتصال را بررسی کنید.';
      note.hidden = false;
      button.disabled = false;
    });
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
      if (!ok) showView('view-login');
    });
  }
})();
