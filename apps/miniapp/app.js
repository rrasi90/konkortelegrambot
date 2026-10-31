/* آموزش کنکور — منطق مینی‌اپ یادگیری تطبیقی کنکور دکتری مدیریت */
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
    selectedTracks: new Set(),
    telegram: null,
    nightMode: false,
    home: null,
    lastAttemptId: null,
    startTime: null,
  };

  /* ---------- مدیریت نمایش و صفحات ---------- */
  function showView(id) {
    ['view-login', 'view-tracks', 'view-app'].forEach(function (v) {
      var viewEl = el(v);
      if (viewEl) viewEl.hidden = v !== id;
    });
  }

  var TABS = ['home', 'today', 'lessons', 'map', 'settings'];
  function showTab(tab) {
    if (tab !== 'today') state.nightMode = false;
    TABS.forEach(function (t) {
      var panel = el('tab-' + t);
      if (panel) panel.hidden = t !== tab;
      var btn = document.querySelector('.nav-btn[data-tab="' + t + '"]');
      if (btn) btn.classList.toggle('active', t === tab);
    });
    if (tab === 'home') loadHome();
    if (tab === 'today') loadQueue();
    if (tab === 'lessons') loadLessons();
    if (tab === 'map') loadMap();
    if (tab === 'settings') renderSettings();
  }

  /* ---------- سرصفحه: خوش‌آمدگویی و آمار ---------- */
  function renderHeader() {
    var h = state.home;
    if (!h) return;
    var greetingEl = el('header-greeting');
    if (greetingEl) {
      greetingEl.hidden = false;
      greetingEl.textContent = greetingFor() + (h.user.displayName || 'داوطلب گرامی');
    }
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

  /* ---------- شناسایی و ورود خودکار امن (بدون نیاز به آیدی دستی) ---------- */
  function getOrCreateDeviceToken() {
    var key = 'ael_device_token';
    var token = localStorage.getItem(key);
    if (!token) {
      token = 'dev_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem(key, token);
    }
    return token;
  }

  function autoAuthenticate() {
    var statusText = el('auth-status-text');
    if (statusText) statusText.textContent = 'در حال شناسایی و بارگذاری پروفایل اختصاصی...';

    // ۱. اگر در داخل تلگرام باز شده است: استفاده از دادهٔ معتبر و امضاشدهٔ تلگرام (initData)
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) {
      state.telegram = window.Telegram.WebApp;
      state.telegram.ready();
      if (state.telegram.expand) state.telegram.expand();
      return API.post('/api/auth/telegram', { initData: state.telegram.initData })
        .then(function (data) { onAuthed(data); })
        .catch(function (err) {
          console.warn('Telegram initData fallback to deviceToken:', err);
          return loginWithDevice();
        });
    }

    // ۲. اگر در وب یا مرورگر باز شده است: ورود خودکار با توکن اختصاصی و دائمی دستگاه داوطلب
    return loginWithDevice();
  }

  function loginWithDevice() {
    var deviceToken = getOrCreateDeviceToken();
    return API.post('/api/auth/telegram', { deviceToken: deviceToken, displayName: 'داوطلب دکتری مدیریت' })
      .then(function (data) {
        onAuthed(data);
      })
      .catch(function (err) {
        var errEl = el('login-error');
        if (errEl) {
          errEl.textContent = 'خطا در اتصال به سرور: ' + (err.message || 'لطفاً دوباره تلاش کنید');
          errEl.hidden = false;
        }
      });
  }

  function onAuthed(data) {
    localStorage.setItem('session_token', data.token);
    state.tracks = (data.user && data.user.activeTracks) || ['common'];
    // اگر داوطلب هنوز گرایشی انتخاب نکرده (یا فقط common دارد)، صفحهٔ انتخاب چندگانه گرایش نمایش داده می‌شود
    if (state.tracks.length <= 1) {
      initTracksSelection();
      showView('view-tracks');
    } else {
      enterApp();
    }
  }

  function enterApp() {
    showView('view-app');
    showTab('home');
  }

  /* ---------- انتخاب چندگانهٔ گرایش‌ها ---------- */
  function initTracksSelection() {
    state.selectedTracks = new Set(
      (state.tracks || []).filter(function (t) { return t !== 'common'; })
    );

    document.querySelectorAll('.track-card').forEach(function (card) {
      var track = card.dataset.track;
      card.classList.toggle('selected', state.selectedTracks.has(track));
      card.onclick = function () {
        if (state.selectedTracks.has(track)) {
          state.selectedTracks.delete(track);
          card.classList.remove('selected');
        } else {
          state.selectedTracks.add(track);
          card.classList.add('selected');
        }
        var btnSave = el('btn-tracks-save');
        if (btnSave) btnSave.disabled = state.selectedTracks.size === 0;
      };
    });

    var btnSave = el('btn-tracks-save');
    if (btnSave) {
      btnSave.disabled = state.selectedTracks.size === 0;
      btnSave.onclick = function () {
        if (state.selectedTracks.size === 0) return;
        var chosenTracks = Array.from(state.selectedTracks);
        btnSave.disabled = true;
        btnSave.textContent = 'در حال ذخیره...';
        API.put('/api/tracks', { tracks: chosenTracks }).then(function () {
          state.tracks = ['common'].concat(chosenTracks);
          btnSave.textContent = 'تأیید و شروع یادگیری';
          enterApp();
        }).catch(function (err) {
          btnSave.disabled = false;
          btnSave.textContent = 'تأیید و شروع یادگیری';
          alert('خطا در ذخیره گرایش‌ها: ' + err.message);
        });
      };
    }
  }

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
    }).catch(function (err) {
      var container = el('home-container');
      if (container) {
        container.innerHTML = '<div class="dash-card"><p class="error">خطا در بارگذاری داشبورد: ' + escapeHtml(err.message) + '</p></div>';
      }
    });
  }

  var TRACK_NAMES = {
    business: 'مدیریت بازرگانی',
    industrial: 'مدیریت صنعتی',
    technology: 'مدیریت تکنولوژی و نوآوری',
    strategy: 'مدیریت استراتژیک و آینده‌پژوهی',
  };

  function renderHome(h) {
    var container = el('home-container');
    if (!container) return;

    var activeTrackTitles = (h.user.activeTracks || [])
      .filter(function (t) { return t !== 'common'; })
      .map(function (t) { return TRACK_NAMES[t] || t; });
    var trackTitle = activeTrackTitles.length > 0 ? activeTrackTitles.join(' + ') : 'هستهٔ مشترک';

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
      '<div class="mascot-text"><strong>همراه هوشمند شما</strong>' +
      '<p>' + escapeHtml(h.mentorMessage) + '</p></div></section>';

    // کارت هدف: شمارش معکوس + پیشرفت کل مسیر (شروع از ۰٪ برای داوطلب تازه)
    var overallProgress = typeof h.progress.overall === 'number' ? h.progress.overall : 0;
    html += '<section class="dash-card goal-card">';
    if (h.stats.daysLeft !== null && h.stats.daysLeft >= 0) {
      html +=
        '<div class="goal-countdown"><span class="count-num">' + h.stats.daysLeft + '</span>' +
        '<span class="count-label">روز تا آزمون کنکور</span></div>';
    }
    html +=
      '<div class="goal-title">گرایش‌های فعال: ' + escapeHtml(trackTitle) + '</div>' +
      '<div class="labels"><span>پیشرفت تسلط سرفصل‌ها</span><span>' + overallProgress + '٪</span></div>' +
      '<div class="bar"><div class="fill" style="width:' + overallProgress + '%"></div></div>' +
      '</section>';

    // کارت کوییز امروز
    html +=
      '<section class="dash-card lesson-card">' +
      '<div class="lesson-num">برنامهٔ امروز</div>' +
      '<div class="lesson-title">' + (h.today.answered > 0 ? (h.today.answered + ' پاسخ ثبت‌شده امروز') : 'آغاز جلسه مطالعه') + '</div>' +
      '<p class="lesson-sub">' + (h.reviewDue > 0 ? (h.reviewDue + ' تست در نوبت مرور فاصله دار') : 'آماده برای تست‌های هدفمند') + '</p>' +
      '<button id="btn-start-today" class="btn primary full">شروع تمرین امروز</button>' +
      '</section>';

    // کارت کوییز شبانه (سؤالات غلط امروز)
    if (h.nightQuiz && h.nightQuiz.available) {
      var wrongCount = h.nightQuiz.wrongCount || h.nightQuiz.wrongAnswersCount || 0;
      html +=
        '<section class="dash-card night-card">' +
        '<div class="night-badge">🌙 کوییز شبانه</div>' +
        '<div class="night-title">تثبیت پاسخ‌های غلط امروز (' + wrongCount + ' سؤال)</div>' +
        '<p class="night-sub">مرور دوباره قبل از خواب باعث تثبیت عصبی مفاهیم در حافظه بلندمدت می‌شود.</p>' +
        '<button id="btn-start-night" class="btn secondary full">شروع کوییز شبانه</button>' +
        '</section>';
    }

    container.innerHTML = html;

    var btnToday = el('btn-start-today');
    if (btnToday) btnToday.onclick = function () { showTab('today'); };

    var btnNight = el('btn-start-night');
    if (btnNight) {
      btnNight.onclick = function () {
        state.nightMode = true;
        showTab('today');
      };
    }
  }

  /* ---------- تب امروز (کوییز تطبیقی) ---------- */
  function loadQueue() {
    var commuteMode = localStorage.getItem('study_mode') === 'commute';
    var path = state.nightMode ? '/api/night-quiz' : ('/api/queue' + (commuteMode ? '?mode=commute' : ''));
    API.get(path).then(function (data) {
      state.queue = data.items || [];
      state.currentIndex = 0;
      renderCurrent();
    }).catch(function (err) {
      var emptyEl = el('queue-empty');
      var cardEl = el('quiz-card');
      if (cardEl) cardEl.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.innerHTML = '<p class="error">خطا در دریافت صف تمرین: ' + escapeHtml(err.message) + '</p>';
      }
    });
  }

  function renderCurrent() {
    var item = state.queue[state.currentIndex];
    var emptyEl = el('queue-empty');
    var cardEl = el('quiz-card');

    if (!item) {
      if (cardEl) cardEl.hidden = true;
      if (emptyEl) {
        emptyEl.hidden = false;
        emptyEl.innerHTML = state.nightMode
          ? '<p>🎉 کوییز شبانه تمام شد. فردا با حافظه‌ای تثبیت‌شده برگرد!</p>' +
            '<button id="btn-night-done" class="btn primary" style="margin-top:12px;">بازگشت به خانه</button>'
          : '<p>🎉 تمام سؤالات و کارت‌های امروز با موفقیت کامل شد. خسته نباشید!</p>' +
            '<button id="btn-queue-done" class="btn ghost" style="margin-top:12px;">تازه‌سازی برنامه</button>';
        var doneBtn = el(state.nightMode ? 'btn-night-done' : 'btn-queue-done');
        if (doneBtn) {
          doneBtn.onclick = function () {
            state.nightMode = false;
            showTab('home');
          };
        }
      }
      return;
    }

    if (emptyEl) emptyEl.hidden = true;
    if (cardEl) cardEl.hidden = false;

    var question = item.question;
    var card = item.card;
    state.lastAttemptId = item.attemptId || null;
    state.startTime = Date.now();

    var qText = question ? question.text : (card.trapNote || 'مرور این مفهوم در برنامه است.');
    el('q-text').textContent = qText;

    el('q-course').textContent = item.courseTitle || item.course || (card.cardType === 'comparison_card' ? 'مقایسهٔ مفاهیم' : 'کنکور دکتری');
    el('q-chapter').textContent = item.chapterTitle || item.chapter || (card.isRepair ? 'کارت ترمیمی' : '');

    var vChip = el('q-verification');
    if (vChip) {
      vChip.hidden = !(question && question.isVerified);
      vChip.textContent = 'سؤال تستی آزمون';
    }

    var proofLabel = el('q-proof-label');
    if (proofLabel) {
      if (item.attemptType === 'proof') {
        proofLabel.hidden = false;
        proofLabel.textContent = '🎯 سؤال اثبات تسلط (۱۴۰۴)';
      } else {
        proofLabel.hidden = true;
      }
    }

    var typeChip = el('q-card-type');
    if (typeChip) {
      if (card.cardType === 'trap_note') {
        typeChip.hidden = false;
        typeChip.textContent = '⚠️ تلهٔ تستی طراح';
      } else if (card.cardType === 'comparison_card') {
        typeChip.hidden = false;
        typeChip.textContent = '⚖️ مقایسهٔ مفاهیم مشابه';
      } else if (state.nightMode) {
        typeChip.hidden = false;
        typeChip.textContent = '🌙 مرور شبانه';
      } else {
        typeChip.hidden = true;
      }
    }

    // گزینه‌ها
    var optsContainer = el('q-options');
    optsContainer.innerHTML = '';
    var options = (question && question.options) || ['مفهوم را مرور کردم و به حافظه سپردم'];

    options.forEach(function (optText, idx) {
      var btn = document.createElement('button');
      btn.className = 'option-btn';
      btn.innerHTML = '<span class="opt-num">' + (idx + 1) + '</span><span class="opt-text">' + escapeHtml(optText) + '</span>';
      btn.onclick = function () {
        submitAnswer(item, idx);
      };
      optsContainer.appendChild(btn);
    });

    // پاک‌سازی بازخورد سؤال قبلی
    var feedback = el('answer-feedback');
    if (feedback) feedback.hidden = true;
    ['feedback-comparison', 'feedback-self-report', 'feedback-proof-ready'].forEach(function (id) {
      var node = el(id);
      if (node) { node.hidden = true; node.innerHTML = ''; }
    });
  }

  function submitAnswer(item, selectedIdx) {
    var responseTimeMs = Date.now() - (state.startTime || Date.now());
    var body = {
      questionId: item.question ? item.question.id : item.card.questionId,
      selectedOption: selectedIdx,
      attemptId: item.attemptId,
      attemptType: item.attemptType || 'practice',
      responseTimeMs: responseTimeMs,
    };

    // غیرفعال کردن گزینه‌ها حین ارسال
    var optionBtns = document.querySelectorAll('.option-btn');
    optionBtns.forEach(function (b) { b.disabled = true; });

    API.post('/api/answers', body).then(function (res) {
      showFeedback(item, res, selectedIdx);
      if (res.stats) updateStatsChips(res.stats);
    }).catch(function (err) {
      optionBtns.forEach(function (b) { b.disabled = false; });
      alert('خطا در ثبت پاسخ: ' + err.message);
    });
  }

  function showFeedback(item, res, selectedIdx) {
    var feedbackBox = el('answer-feedback');
    feedbackBox.hidden = false;

    var report = res.report || {};
    var wasCorrect = typeof res.wasCorrect === 'boolean'
      ? res.wasCorrect
      : report.wasCorrect === true;
    var correctOption = res.correctOption;
    var lesson = res.lesson;

    // استایل گزینه‌ها
    var optionBtns = document.querySelectorAll('.option-btn');
    if (optionBtns[correctOption]) optionBtns[correctOption].classList.add('correct');
    if (!wasCorrect && optionBtns[selectedIdx]) optionBtns[selectedIdx].classList.add('wrong');

    var head = el('feedback-head');
    head.className = 'feedback-head ' + (wasCorrect ? 'ok' : 'bad');
    head.textContent = wasCorrect ? '✓ پاسخ کاملاً صحیح بود' : '✕ پاسخ اشتباه است';

    var expEl = el('feedback-explanation');
    expEl.textContent = res.explanation || (item.question ? item.question.explanation : '') || '';

    // تلهٔ طراح
    var trapEl = el('feedback-trap');
    var trapText = res.trapNote || (item.question && item.question.trapNote);
    if (trapText) {
      trapEl.hidden = false;
      trapEl.textContent = '💡 دام طراح کنکور: ' + trapText;
    } else {
      trapEl.hidden = true;
    }

    // پیام منتور
    var mentorEl = el('feedback-mentor');
    if (mentorEl) mentorEl.textContent = report.mentorMessage || '';

    // کارت مقایسهٔ مفاهیم متشابه (در صورت تولید توسط موتور)
    var cmpEl = el('feedback-comparison');
    if (cmpEl) {
      var titles = (res.comparison && res.comparison.titles) || [];
      if (titles.length > 0) {
        cmpEl.hidden = false;
        cmpEl.innerHTML =
          '<strong>⚖️ جدول مقایسهٔ مفاهیم قابل‌خلط:</strong>' +
          '<div style="margin-top:6px;line-height:1.9;">' +
          titles.map(function (t) { return '• ' + escapeHtml(t); }).join('<br>') +
          '</div>';
      } else {
        cmpEl.hidden = true;
      }
    }

    // آمادگی آزمون اثبات تسلط
    var proofEl = el('feedback-proof-ready');
    if (proofEl) {
      if (res.proofReady && res.proofReady.skillId) {
        proofEl.hidden = false;
        proofEl.textContent = '🎯 به آستانهٔ تسلط رسیدی؛ یک سؤال دیده‌نشده برای اثبات در برنامه ثبت شد.';
      } else {
        proofEl.hidden = true;
      }
    }

    // خوداظهاری نوع خطا (فقط پس از پاسخ غلط)
    var selfEl = el('feedback-self-report');
    if (selfEl) {
      if (!wasCorrect && item.attemptId) {
        selfEl.hidden = false;
        selfEl.innerHTML =
          '<strong>این خطا از چه نوعی بود؟</strong>' +
          '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">' +
          '<button type="button" class="btn ghost small" data-report="slip">بی‌دقتی بود</button>' +
          '<button type="button" class="btn ghost small" data-report="didnt_know">مفهوم را نمی‌دانستم</button>' +
          '</div>';
        selfEl.querySelectorAll('button[data-report]').forEach(function (btn) {
          btn.onclick = function () {
            var kind = btn.getAttribute('data-report');
            btn.disabled = true;
            API.post('/api/self-report', {
              attemptId: item.attemptId,
              questionId: item.question ? item.question.id : item.card.questionId,
              selfReport: kind,
            }).then(function (out) {
              selfEl.innerHTML = '<p class="hint">' + escapeHtml(out.note || 'ثبت شد.') + '</p>';
            }).catch(function (err) {
              btn.disabled = false;
              selfEl.innerHTML = '<p class="error">' + escapeHtml(err.message) + '</p>';
            });
          };
        });
      } else {
        selfEl.hidden = true;
      }
    }

    // نمایش موج تسلط
    renderRipple(report);

    // آموزش کامل درس زیر هر سؤال (چه کاربر درست پاسخ دهد چه غلط)
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
    if (!box) return;
    var deltas = (report.masteryDeltas || []).filter(function (d) { return d.before !== d.after; });
    if (deltas.length === 0) {
      box.innerHTML = '';
      return;
    }
    var html = '<p class="ripple-title">اثر این پاسخ بر نمودار تسلط سرفصل‌ها:</p>';
    deltas.forEach(function (d) {
      var pct = Math.round(d.after);
      var cls = pct < 40 ? 'bad' : pct < 60 ? 'warn' : pct < 85 ? '' : 'ok';
      html +=
        '<div class="ripple-row ' + cls + '">' +
        '<span>' + escapeHtml(d.topic || d.nodeId) + '</span>' +
        '<span>' + Math.round(d.before) + '٪ ← <strong>' + pct + '٪</strong></span>' +
        '</div>';
    });
    box.innerHTML = html;
  }

  /* ---------- تب آموزش درس (۸ درس دکتری مدیریت) ---------- */
  var cachedLessons = null;

  function loadLessons() {
    var container = el('lessons-container');
    if (!container) return;
    if (cachedLessons) {
      renderLessonsList(cachedLessons);
      return;
    }
    container.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ink-soft);font-size:13px;">در حال دریافت آموزش‌های سرفصل‌های دکتری...</div>';
    API.get('/api/lessons').then(function (data) {
      cachedLessons = data && data.courses ? data.courses : [];
      renderLessonsList(cachedLessons);
      initLessonsSearch();
    }).catch(function (err) {
      container.innerHTML = '<div class="error" style="text-align:center;padding:16px;">خطا در بارگذاری دروس: ' + escapeHtml(err.message) + '</div>';
    });
  }

  function initLessonsSearch() {
    var searchInput = el('lesson-search-input');
    if (!searchInput || searchInput._bound) return;
    searchInput._bound = true;
    searchInput.addEventListener('input', function () {
      var query = (searchInput.value || '').trim().toLowerCase();
      renderLessonsList(cachedLessons, query);
    });
  }

  function renderLessonsList(courses, filterQuery) {
    var container = el('lessons-container');
    if (!container) return;
    if (!courses || courses.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>هیچ درسی بارگذاری نشد.</p></div>';
      return;
    }

    var html = '';
    var totalMatches = 0;

    courses.forEach(function (course, cIdx) {
      var filteredTopics = (course.topics || []).filter(function (t) {
        if (!filterQuery) return true;
        var q = filterQuery;
        var inTitle = (t.topic || '').toLowerCase().includes(q);
        var inCourse = (t.course || '').toLowerCase().includes(q);
        var inChapter = (t.chapter || '').toLowerCase().includes(q);
        var inSummary = (t.summary || '').toLowerCase().includes(q);
        var inTerms = (t.keyTerms || []).some(function (k) { return k.toLowerCase().includes(q); });
        return inTitle || inCourse || inChapter || inSummary || inTerms;
      });

      if (filterQuery && filteredTopics.length === 0) return;
      totalMatches += filteredTopics.length;

      var isOpen = (!filterQuery && cIdx === 0) || (filterQuery && filteredTopics.length > 0);

      html += '<div class="course-accordion' + (isOpen ? ' open' : '') + '" data-course-id="' + escapeHtml(course.courseId) + '">';
      html += '<div class="course-accordion-header">';
      html += '<div><strong>' + escapeHtml(course.courseTitle) + '</strong> <span style="font-size:11.5px;color:var(--ink-soft);font-weight:400;margin-right:6px;">(' + filteredTopics.length + ' مبحث کلیدی)</span></div>';
      html += '<button class="btn small" onclick="renderFullBook(\'' + escapeHtml(course.courseId) + '\')" style="margin-right:8px;">📖 مطالعه کامل</button>';
      html += '<span class="accordion-arrow" style="font-size:12px;color:var(--ink-soft);">' + (isOpen ? '▲' : '▼') + '</span>';
      html += '</div>';

      html += '<div class="course-topics-list">';
      if (course.description && !filterQuery) {
        html += '<p style="font-size:12px;color:var(--ink-soft);margin:4px 0 10px;line-height:1.6;">' + escapeHtml(course.description) + '</p>';
      }

      filteredTopics.forEach(function (topic) {
        html += '<div class="topic-card">';
        html += '<div class="topic-title">' + escapeHtml(topic.topic) + '</div>';
        if (topic.chapter) {
          html += '<div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:6px;">فصل: ' + escapeHtml(topic.chapter) + '</div>';
        }
        if (topic.konkoorWeight) {
          html += '<span class="topic-weight">🎯 ' + escapeHtml(topic.konkoorWeight) + '</span>';
        }
        if (topic.frequency) {
          html += '<span class="topic-weight" style="background:#e0f2fe;color:#0369a1;margin-right:6px;">📊 ' + escapeHtml(topic.frequency) + '</span>';
        }
        if (topic.summary) {
          html += '<div class="topic-summary">' + escapeHtml(topic.summary) + '</div>';
        }
        if (topic.konkoorTips && topic.konkoorTips.length > 0) {
          html += '<div class="topic-tips"><strong>💡 نکات طلایی و تله‌های کنکور دکتری:</strong><ul style="margin:6px 0 0;padding-right:16px;">';
          topic.konkoorTips.forEach(function (tip) {
            html += '<li>' + escapeHtml(tip) + '</li>';
          });
          html += '</ul></div>';
        }
        if (topic.keyTerms && topic.keyTerms.length > 0) {
          html += '<div class="topic-terms"><span style="font-size:11px;color:var(--ink-soft);margin-left:4px;">واژگان کلیدی:</span>';
          topic.keyTerms.forEach(function (term) {
            html += '<span class="lesson-term-badge">' + escapeHtml(term) + '</span>';
          });
          html += '</div>';
        }
        html += '</div>';
      });

      html += '</div></div>';
    });

    if (filterQuery && totalMatches === 0) {
      container.innerHTML = '<div class="empty-state"><p>هیچ مبحثی مطابق «' + escapeHtml(filterQuery) + '» پیدا نشد.</p></div>';
      return;
    }

    container.innerHTML = html;

    // متصل کردن رویداد کلیک باز/بسته شدن آکاردئون
    container.querySelectorAll('.course-accordion-header').forEach(function (hdr) {
      hdr.addEventListener('click', function () {
        var card = hdr.closest('.course-accordion');
        var wasOpen = card.classList.contains('open');
        card.classList.toggle('open', !wasOpen);
        var arrow = card.querySelector('.accordion-arrow');
        if (arrow) arrow.textContent = !wasOpen ? '▲' : '▼';
      });
    });
  }

  /* ---------- مطالعه کامل یک کتاب ---------- */
  window.renderFullBook = function (courseId) {
    var container = el('lessons-container');
    if (!container) return;
    var course = cachedLessons ? cachedLessons.find(function(c){ return c.courseId === courseId; }) : null;
    if (!course) { container.innerHTML = '<div class="empty-state"><p>کتاب یافت نشد.</p></div>'; return; }
    var html = '<div style="padding:8px 0;"><button onclick="loadLessons()" class="btn ghost small">← بازگشت به لیست کتاب‌ها</button></div>';
    html += '<h2 style="font-size:18px;font-weight:800;color:var(--ink);margin:8px 0 14px;border-right:4px solid var(--primary);padding-right:10px;">📘 ' + escapeHtml(course.courseTitle) + '</h2>';
    if (course.description) html += '<p style="font-size:13px;color:var(--ink-soft);line-height:1.7;margin-bottom:14px;">' + escapeHtml(course.description) + '</p>';
    (course.topics || []).forEach(function(t) {
      html += '<div class="topic-card" style="margin-bottom:14px;border-right:3px solid var(--primary);">';
      html += '<div class="topic-title" style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px;">' + escapeHtml(t.topic) + '</div>';
      if (t.chapter) html += '<div style="font-size:11.5px;color:var(--ink-soft);margin-bottom:4px;">فصل: ' + escapeHtml(t.chapter) + '</div>';
      if (t.summary) html += '<div class="topic-summary">' + escapeHtml(t.summary) + '</div>';
      if (t.konkoorTips && t.konkoorTips.length) {
        html += '<div class="topic-tips"><strong>💡 نکات طلایی:</strong><ul style="margin:4px 0 0;padding-right:18px;">' + t.konkoorTips.map(function(tip){ return '<li>'+escapeHtml(tip)+'</li>'; }).join('') + '</ul></div>';
      }
      if (t.keyTerms && t.keyTerms.length) {
        html += '<div class="topic-terms">' + t.keyTerms.map(function(term){ return '<span class="lesson-term-badge">'+escapeHtml(term)+'</span>'; }).join('') + '</div>';
      }
      html += '</div>';
    });
    container.innerHTML = html;
    window.scrollTo(0,0);
  };

  /* ---------- تب مسیر (Knowledge Map) ---------- */
  function loadMap() {
    var container = el('map-container');
    if (container) {
      container.innerHTML = '<div style="text-align:center;padding:28px;color:var(--ink-soft);font-size:13px;">در حال ساخت نقشهٔ تسلط...</div>';
    }
    API.get('/api/map').then(function (data) {
      if (!container) return;
      var courses = data.courses || [];
      if (courses.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>هنوز گره‌ای برای گرایش‌های فعال شما ثبت نشده است.</p></div>';
        return;
      }
      var html = '';
      courses.forEach(function (course) {
        html += '<section class="map-course"><h3 class="map-course-title">' + escapeHtml(course.course) + '</h3>';
        (course.chapters || []).forEach(function (chapter) {
          html += '<div class="map-chapter"><div class="map-chapter-title">' + escapeHtml(chapter.chapter) + '</div><div class="map-grid">';
          (chapter.nodes || []).forEach(function (n) {
            var isAssessed = typeof n.mastery === 'number';
            var m = isAssessed ? Math.round(n.mastery) : null;
            var cls = !isAssessed ? 'unseen' : (m < 40 ? 'bad' : m < 60 ? 'warn' : m < 85 ? '' : 'ok');
            html +=
              '<div class="map-node ' + cls + '">' +
              '<span class="node-topic">' + escapeHtml(n.topic) + '</span>' +
              '<div class="node-bar"><div class="fill" style="width:' + (isAssessed ? m : 0) + '%"></div></div>' +
              '<span class="node-pct">' + (isAssessed ? m + '٪' : 'سنجیده‌نشده') + '</span>' +
              '</div>';
          });
          html += '</div></div>';
        });
        html += '</section>';
      });
      container.innerHTML = html;
    }).catch(function (err) {
      if (container) {
        container.innerHTML = '<div class="error" style="text-align:center;padding:16px;">خطا در دریافت نقشهٔ تسلط: ' + escapeHtml(err.message) + '</div>';
      }
    });
  }

  /* ---------- تب تنظیمات (من) ---------- */
  function renderSettings() {
    document.querySelectorAll('.track-toggle .toggle').forEach(function (btn) {
      var t = btn.dataset.track;
      btn.classList.toggle('on', state.tracks.includes(t));
      btn.onclick = function () {
        var idx = state.tracks.indexOf(t);
        if (idx === -1) {
          state.tracks.push(t);
        } else {
          state.tracks.splice(idx, 1);
        }
        var activeOnly = state.tracks.filter(function (x) { return x !== 'common'; });
        btn.disabled = true;
        API.put('/api/tracks', { tracks: activeOnly }).then(function (res) {
          state.tracks = (res && res.tracks) || ['common'].concat(activeOnly);
          btn.disabled = false;
          renderSettings();
        }).catch(function (err) {
          btn.disabled = false;
          alert('خطا در ذخیرهٔ گرایش‌ها: ' + err.message);
        });
      };
    });

    var examInput = el('input-exam-date');
    if (examInput && state.home && state.home.stats && state.home.stats.examDate) {
      examInput.value = state.home.stats.examDate;
    }

    renderStudyMode();
  }

  function renderStudyMode() {
    var mode = localStorage.getItem('study_mode') === 'commute' ? 'commute' : 'desk';
    var deskBtn = el('mode-desk');
    var commuteBtn = el('mode-commute');
    if (deskBtn) deskBtn.classList.toggle('on', mode === 'desk');
    if (commuteBtn) commuteBtn.classList.toggle('on', mode === 'commute');
  }

  var modeDesk = el('mode-desk');
  if (modeDesk) {
    modeDesk.addEventListener('click', function () {
      localStorage.setItem('study_mode', 'desk');
      renderStudyMode();
    });
  }

  var modeCommute = el('mode-commute');
  if (modeCommute) {
    modeCommute.addEventListener('click', function () {
      localStorage.setItem('study_mode', 'commute');
      renderStudyMode();
    });
  }

  var btnSaveExam = el('btn-save-exam');  if (btnSaveExam) {
    btnSaveExam.addEventListener('click', function () {
      var value = el('input-exam-date').value || null;
      btnSaveExam.disabled = true;
      API.put('/api/settings', { examDate: value }).then(function () {
        btnSaveExam.disabled = false;
        var savedMsg = el('settings-saved');
        if (savedMsg) {
          savedMsg.hidden = false;
          setTimeout(function () { savedMsg.hidden = true; }, 2000);
        }
        loadHome();
      }).catch(function (err) {
        btnSaveExam.disabled = false;
        alert('خطا در ذخیرهٔ تاریخ کنکور: ' + err.message);
      });
    });
  }

  var btnLogout = el('btn-logout');
  function freezeStreak() {
    var btn = el('btn-freeze-streak');
    if (!btn) return;
    btn.disabled = true;
    API.post('/api/streak/freeze', {}).then(function (res) {
      btn.disabled = false;
      var info = el('freeze-info');
      if (info) info.textContent = (res && res.ok ? 'قفل شد (ماه: ' + (res.month || '') + ')' : '') + ' — ' + (state.home && state.home.stats ? state.home.stats.streakDays + ' روز' : '');
      loadHome();
    }).catch(function (err) {
      btn.disabled = false;
      alert('خطا در قفل زنجیره: ' + err.message);
    });
  }
  if (btnLogout) {
    btnLogout.addEventListener('click', function () {
      localStorage.removeItem('session_token');
      showView('view-login');
      autoAuthenticate();
    });
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&#34;', "'": '&#39;' }[c];
    });
  }

  /* ---------- راه‌اندازی اولیه و ورود خودکار ---------- */
  if (localStorage.getItem('session_token')) {
    API.get('/api/me').then(function (data) {
      state.tracks = (data.user && data.user.activeTracks) || ['common'];
      if (state.tracks.length <= 1) {
        initTracksSelection();
        showView('view-tracks');
      } else {
        enterApp();
      }
    }).catch(function () {
      autoAuthenticate();
    });
  } else {
    autoAuthenticate();
  }
})();
