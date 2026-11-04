/* Shared learner interface: the Mini App uses a Worker adapter; the file demo uses a local adapter. */
(function () {
  'use strict';

  const day = 86_400_000;
  const fa = new Intl.NumberFormat('fa-IR');
  const digits = value => fa.format(value);
  const labels = {
    practice: 'تمرین آموزشی', diagnostic: 'سنجش شروع', timed: 'آزمون زمان‌دار',
    correct: 'درست', incorrect: 'نادرست', skipped: 'نزده', pending: 'در انتظار ارزیابی',
  };

  function element(tag, text, cls) {
    const node = document.createElement(tag);
    if (text != null) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  }

  function mathParagraph(text) {
    const paragraph = element('p');
    const arithmetic = /[−-]?[0-9۰-۹٠-٩][0-9۰-۹٠-٩٫.,٪%²³]*(?:\s*[+×÷=−*]\s*[−-]?[0-9۰-۹٠-٩][0-9۰-۹٠-٩٫.,٪%²³]*)+/g;
    let offset = 0;
    for (const match of text.matchAll(arithmetic)) {
      paragraph.append(text.slice(offset, match.index));
      const expression = element('bdi', match[0]);
      expression.dir = 'ltr';
      paragraph.append(expression);
      offset = match.index + match[0].length;
    }
    paragraph.append(text.slice(offset));
    return paragraph;
  }

  function button(text, action, handler, style = '') {
    const node = element('button', text, 'learn-button ' + style);
    node.type = 'button';
    node.dataset.action = action;
    node.addEventListener('click', handler);
    return node;
  }

  function details(title, child) {
    const node = element('details', null, 'learn-details');
    node.append(element('summary', title), child);
    return node;
  }

  function initialState() {
    return { studied: [], reviews: {}, active: null, issues: [] };
  }

  function mount(root, api, options = {}) {
    const offline = options.offline === true;
    let scope = options.scope || 'local';
    let data;
    let course;
    let screen = 'hub';
    let selectedTopic;
    let selectedBlock = null;
    let selectedTopics = [];
    let builderCount = '6';
    let builderMode = 'practice';
    let builderKind = '';
    let quotaEnabled = false;
    let quotaValues = {};
    let lessonReturn = 'course';
    let busy = false;
    let warning = '';
    let timer;
    let pending;
    let storageUnavailable = false;
    let generation = 0;
    let state = read();

    function storageKey() { return 'ael.learning.v1.' + scope; }
    function read() {
      try {
        const raw = JSON.parse(localStorage.getItem(storageKey()) || 'null');
        if (raw && Array.isArray(raw.studied) && Array.isArray(raw.issues) &&
            raw.reviews && typeof raw.reviews === 'object' && !Array.isArray(raw.reviews)) {
          if (raw.active && (!Array.isArray(raw.active.questions) || !raw.active.challenge ||
              !raw.active.answers || !raw.active.results || !Array.isArray(raw.active.marked))) raw.active = null;
          return raw;
        }
      } catch { storageUnavailable = true; }
      return initialState();
    }

    function save() {
      try { localStorage.setItem(storageKey(), JSON.stringify(state)); }
      catch { storageUnavailable = true; }
    }

    function heading(title, subtitle) {
      const header = element('header', null, 'learn-heading');
      header.append(element('p', offline ? 'آزمایش آفلاین AEL' : 'مسیر یادگیری AEL', 'learn-eyebrow'), element('h2', title));
      if (subtitle) header.append(element('p', subtitle, 'learn-muted'));
      root.append(header);
    }

    function go(next) {
      warning = '';
      if (next !== 'lesson') selectedBlock = null;
      screen = next;
      render();
      const block = next === 'lesson' && selectedBlock && [...root.querySelectorAll('[data-learning-block]')]
        .find(node => node.dataset.learningBlock === selectedBlock);
      (block || root.querySelector('h2'))?.focus();
      block?.scrollIntoView({ block: 'center' });
    }

    function card(parent = root) {
      const box = element('section', null, 'learn-card');
      parent.append(box);
      return box;
    }

    function mainButton(title, action, handler) { return button(title, action, handler, 'learn-primary'); }
    function routeButton() { return button('بازگشت به مسیر', 'course', () => go(course ? 'course' : 'hub')); }
    function active() { return state.active; }
    function topicFor(id) { return course?.topics.find(topic => topic.id === id); }
    function incorrectQuestionIds(topicId) {
      return Object.keys(state.reviews).filter(id => {
        const review = state.reviews[id];
        if (!review || review.courseId !== course.id || review.status !== 'incorrect') return false;
        const topic = review.topicId || data.questionIndex?.entries.find(item =>
          item.id === id && item.sourceType === 'authored' && item.courseId === course.id)?.topicId;
        return topic === topicId;
      });
    }
    function normalizeSearch(value) {
      return value.toLocaleLowerCase('fa').replace(/ي/g, 'ی').replace(/ك/g, 'ک')
        .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
        .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
        .replace(/[\u200c\s]+/g, ' ').trim();
    }
    function hasReviewed(id) { return state.reviews[id]?.attempts > 0; }

    function findNextTopic() {
      return course.topics.find(topic => !state.studied.includes(topic.id) &&
        topic.prerequisites.every(id => state.studied.includes(id))) || course.topics[0];
    }

    function sources(ids) {
      const list = element('ul', null, 'learn-source-list');
      for (const id of ids || []) {
        const source = course?.sources.find(item => item.id === id);
        if (!source) continue;
        const item = element('li');
        item.append(element('span', source.title + ' · ' + source.locator));
        if (!offline) {
          const url = new URL(source.url);
          if (url.protocol === 'https:') {
            const link = element('a', 'باز کردن منبع');
            link.href = url.href;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            item.append(link);
          }
        } else {
          const address = element('span', source.url, 'learn-address');
          address.dir = 'ltr';
          item.append(address);
        }
        list.append(item);
      }
      if (!list.children.length) list.append(element('li', 'ارجاع تکمیلی برای این مورد ثبت نشده است.'));
      return list;
    }

    function renderHub() {
      heading('از یک درس کوتاه شروع کن', 'یک مبحث، یک مثال و چند تست. مسیر را هر زمان می‌توانی ادامه بدهی.');
      if (offline) root.append(element('p', 'نسخهٔ شخصی با تمرین تألیفی. کارکرد و گزارش ایراد روی همین دستگاه ذخیره می‌شود.', 'learn-note'));
      for (const item of data.courses) {
        const box = card();
        box.append(element('h3', item.title), element('p', item.description, 'learn-muted'),
          mainButton('باز کردن مسیر', 'open-course', () => { course = item; go('course'); }));
      }
      root.append(button('الگوهای سؤال در ده دوره', 'recurrence', () => go('recurrence')));
      if (data.questionIndex) root.append(button('شناسنامهٔ سؤال‌های موجود', 'question-index', () => go('questionIndex')));
      root.append(button('گزارش ایرادهای ثبت‌شده', 'issues', () => go('issues')));
      if (offline) root.append(button('پشتیبان‌گیری و بازیابی', 'backup', () => go('backup')));
    }

    function renderCourse() {
      heading(course.title, course.scopeNote);
      const next = findNextTopic();
      const route = card();
      const completed = course.topics.filter(topic => state.studied.includes(topic.id)).length;
      route.append(element('p', digits(completed) + ' از ' + digits(course.topics.length) + ' درس مطالعه شده', 'learn-eyebrow'),
        element('h3', completed === course.topics.length ? 'یک مرور کوتاه' : 'گام پیشنهادی'),
        element('p', next.title + ' · حدود ' + digits(next.minutes) + ' دقیقه'),
        mainButton('رفتن به درس', 'next-lesson', () => { selectedTopic = next; lessonReturn = 'course'; go('lesson'); }));
      const actions = element('div', null, 'learn-actions');
      const diagnosticCount = Math.min(course.topics.length, 12);
      const timedCount = Math.min(course.questionCount, 6);
      actions.append(button('سنجش شروع · ' + digits(diagnosticCount) + ' تست', 'diagnostic', () => begin('diagnostic', undefined, undefined, diagnosticCount)),
        button('آزمون زمان‌دار · ' + digits(timedCount) + ' تست', 'timed', () => begin('timed', undefined, undefined, timedCount)),
        button('ساخت آزمون دلخواه', 'custom-exam', () => {
          selectedTopics = course.topics.map(topic => topic.id);
          builderCount = '6'; builderMode = 'practice'; builderKind = ''; quotaEnabled = false; quotaValues = {};
          go('builder');
        }),
        button('مرور اشتباه‌ها و نشان‌ها', 'review', () => go('review')));
      if (active()?.challenge.courseId === course.id && active().challenge.version === course.version && !active().summary) {
        actions.prepend(mainButton('ادامهٔ جلسهٔ قبلی', 'resume', () => go('quiz')));
      }
      root.append(actions);
      const topicList = card();
      topicList.append(element('h3', 'درس‌های کوتاه'));
      const searchLabel = element('label', 'جست‌وجو در درس‌ها ');
      const search = element('input');
      search.type = 'search';
      search.placeholder = 'نام مبحث یا مفهوم';
      searchLabel.append(search);
      const sourceLabel = element('label', 'انتخاب مرجع و بخش ');
      const sourceFilter = element('select');
      sourceFilter.dataset.action = 'filter-learning-source';
      const allSources = element('option', 'همهٔ مراجع');
      allSources.value = '';
      sourceFilter.append(allSources);
      for (const source of course.sources) {
        if (!course.topics.some(topic => (topic.sourceIds || []).includes(source.id))) continue;
        const option = element('option', source.title + ' · ' + source.locator);
        option.value = source.id;
        sourceFilter.append(option);
      }
      sourceLabel.append(sourceFilter);
      const matches = element('div');
      const empty = element('p', 'مبحثی با این جست‌وجو و مرجع پیدا نشد.', 'learn-muted');
      empty.hidden = true;
      topicList.append(searchLabel, sourceLabel, matches, empty);
      for (const topic of course.topics) {
        const wrongCount = incorrectQuestionIds(topic.id).length;
        const title = topic.title + (state.studied.includes(topic.id) ? ' · مطالعه شد' : '') +
          (wrongCount ? ' · ' + digits(wrongCount) + ' پاسخ نادرست برای مرور' : '');
        const item = button(title, 'topic-' + topic.id, () => { selectedTopic = topic; lessonReturn = 'course'; go('lesson'); }, 'learn-topic');
        const topicSources = course.sources.filter(source => (topic.sourceIds || []).includes(source.id));
        item.dataset.search = normalizeSearch([topic.title, topic.objective, ...topic.concepts,
          ...topicSources.flatMap(source => [source.title, source.locator])].join(' '));
        item.dataset.sourceIds = JSON.stringify(topic.sourceIds || []);
        matches.append(item);
      }
      function filterTopics() {
        const query = normalizeSearch(search.value);
        let visible = 0;
        for (const item of matches.children) {
          item.hidden = !item.dataset.search.includes(query) ||
            (sourceFilter.value !== '' && !JSON.parse(item.dataset.sourceIds).includes(sourceFilter.value));
          if (!item.hidden) visible++;
        }
        empty.hidden = visible !== 0;
      }
      search.addEventListener('input', filterTopics);
      sourceFilter.addEventListener('change', filterTopics);
      root.append(button('بازگشت به درس‌ها', 'hub', () => go('hub')));
    }

    function renderLesson() {
      const topic = selectedTopic;
      heading(topic.title, topic.objective);
      const box = card();
      const missing = topic.prerequisites.map(topicFor).find(t => t && !state.studied.includes(t.id));
      if (missing) box.append(button('پیش‌نیاز پیشنهادی: ' + missing.title, 'prerequisite', () => { selectedTopic = missing; selectedBlock = null; go('lesson'); }));
      box.append(element('h3', 'سه نکته برای حل'));
      const list = element('ol');
      topic.concepts.forEach((concept, index) => {
        const item = element('li', concept);
        item.tabIndex = -1;
        item.dataset.learningBlock = 'concept:' + index;
        list.append(item);
      });
      const formula = element('p', topic.formula, 'learn-formula');
      formula.dir = 'ltr';
      formula.tabIndex = -1;
      formula.dataset.learningBlock = 'formula';
      const example = mathParagraph(topic.workedExample);
      example.tabIndex = -1;
      example.dataset.learningBlock = 'workedExample';
      const commonError = element('p', 'دام رایج: ' + topic.commonError, 'learn-note');
      commonError.tabIndex = -1;
      commonError.dataset.learningBlock = 'commonError';
      box.append(list, formula, element('h3', 'مثال حل‌شده'), example,
        commonError, details('ارجاع درس', sources(topic.sourceIds)));
      const count = Math.min(topic.questionCount, 3);
      box.append(mainButton('تمرین این درس · ' + digits(count) + ' تست', 'practice', () => {
        if (!state.studied.includes(topic.id)) state.studied.push(topic.id);
        save();
        begin('practice', topic.id, undefined, count);
      }));
      const incorrectIds = incorrectQuestionIds(topic.id);
      if (incorrectIds.length) box.append(button('مرور پاسخ‌های نادرست این درس · ' + digits(incorrectIds.length),
        'practice-topic-errors', () => begin('practice', topic.id, incorrectIds, Math.min(incorrectIds.length, 12))));
      box.append(button(state.studied.includes(topic.id) ? 'مطالعه‌شده' : 'ثبت مطالعهٔ این درس', 'mark-studied', () => {
        if (!state.studied.includes(topic.id)) state.studied.push(topic.id);
        save();
        render();
      }));
      if (lessonReturn === 'quiz' || lessonReturn === 'summary') {
        box.append(button('بازگشت به پاسخ سؤال', 'return-result', () => go(lessonReturn)));
      }
      root.append(routeButton());
    }

    function renderBuilder() {
      heading('ساخت آزمون دلخواه', 'مباحث و تعداد سؤال را انتخاب کن.');
      const box = card();
      const list = element('fieldset');
      list.append(element('legend', 'مباحث'));
      const availability = element('p', '', 'learn-muted');
      availability.setAttribute('aria-live', 'polite');
      const quotaFields = new Map();
      function updateAvailability() {
        const selected = course.topics.filter(topic => selectedTopics.includes(topic.id));
        const capacity = topic => kind.value === 'essay' ? topic.essayCount : kind.value === 'mcq'
          ? (topic.mcqCount ?? topic.questionCount - topic.essayCount) : topic.questionCount;
        const total = selected.reduce((sum, topic) => sum + capacity(topic), 0);
        availability.textContent = course.hasVariantGroups
          ? 'حداکثر ' + digits(total) + ' سؤال در مباحث انتخابی؛ موارد مشابه مشترک هنگام ساخت حذف می‌شوند.'
          : digits(total) + ' سؤال در مباحث انتخابی موجود است.';
        for (const [id, field] of quotaFields) field.hidden = !quotaEnabled || !selectedTopics.includes(id);
        count.disabled = quotaEnabled;
        if (quotaEnabled) {
          const requested = selected.reduce((sum, topic) => sum + (Number(normalizeSearch(quotaValues[topic.id])) || 0), 0);
          count.value = String(requested);
          availability.textContent += ' سهمیه: ' + selected.map(topic => topic.title + '، موجود ' + digits(capacity(topic))).join(' · ');
        } else count.value = builderCount;
      }
      for (const topic of course.topics) {
        const label = element('label');
        const check = element('input');
        check.type = 'checkbox';
        check.checked = selectedTopics.includes(topic.id);
        check.addEventListener('change', () => {
          selectedTopics = check.checked ? [...selectedTopics, topic.id] : selectedTopics.filter(id => id !== topic.id);
          updateAvailability();
        });
        label.append(check, document.createTextNode(' ' + topic.title + ' · ' + digits(topic.questionCount) + ' سؤال'));
        const quotaLabel = element('label', ' تعداد از این مبحث ');
        const quota = element('input');
        quota.type = 'text'; quota.inputMode = 'numeric'; quota.maxLength = 2;
        quota.dataset.action = 'quota-' + topic.id;
        quota.value = quotaValues[topic.id] ?? '1';
        quotaValues[topic.id] = quota.value;
        quota.addEventListener('input', () => { quotaValues[topic.id] = quota.value; updateAvailability(); });
        quotaLabel.append(quota);
        quotaFields.set(topic.id, quotaLabel);
        list.append(label, quotaLabel, element('br'));
      }
      const countLabel = element('label', 'تعداد سؤال، از ۱ تا ۱۲ ');
      const count = element('input');
      count.type = 'number'; count.min = '1'; count.max = '12'; count.value = builderCount;
      count.addEventListener('input', () => { builderCount = count.value; });
      countLabel.append(count);
      const modeLabel = element('label', ' نوع آزمون ');
      const mode = element('select');
      for (const [value, title] of [['practice', 'تمرین با پاسخ فوری'], ['diagnostic', 'سنجش'], ['timed', 'زمان‌دار']]) {
        const option = element('option', title); option.value = value; mode.append(option);
      }
      mode.value = builderMode;
      mode.addEventListener('change', () => { builderMode = mode.value; });
      modeLabel.append(mode);
      const kindLabel = element('label', ' نوع سؤال ');
      const kind = element('select');
      kind.dataset.action = 'question-kind';
      for (const [value, title] of [['', 'همهٔ انواع'], ['mcq', 'چهارگزینه‌ای'], ['essay', 'تشریحی']]) {
        const option = element('option', title); option.value = value; kind.append(option);
      }
      kind.value = builderKind;
      kind.addEventListener('change', () => { builderKind = kind.value; updateAvailability(); });
      kindLabel.append(kind);
      const quotaChoice = element('label', ' تعیین تعداد برای هر مبحث ');
      const quotaToggle = element('input'); quotaToggle.type = 'checkbox';
      quotaToggle.dataset.action = 'quota-toggle'; quotaToggle.checked = quotaEnabled;
      quotaToggle.addEventListener('change', () => { quotaEnabled = quotaToggle.checked; updateAvailability(); });
      quotaChoice.prepend(quotaToggle);
      updateAvailability();
      box.append(quotaChoice, list, availability, countLabel, modeLabel, kindLabel,
        mainButton('شروع آزمون', 'start-custom', () => {
          if (!selectedTopics.length) { warning = 'دست‌کم یک مبحث انتخاب کن.'; render(); return; }
          builderCount = quotaEnabled ? builderCount : count.value; builderMode = mode.value; builderKind = kind.value;
          const topicQuotas = quotaEnabled ? selectedTopics.map(id => ({ topicId: id, count: Number(normalizeSearch(quotaValues[id])) })) : undefined;
          begin(mode.value, undefined, undefined, Number(count.value), selectedTopics, kind.value || undefined, topicQuotas);
        }));
      root.append(routeButton());
    }

    function begin(mode, topicId, reviewIds, count, topicIds, kind, topicQuotas) {
      const current = active();
      if (current && !current.summary && current.questions.length &&
          !window.confirm('جلسهٔ قبلی هنوز باز است. جلسهٔ تازه جای آن را بگیرد؟')) return;
      run(async isCurrent => {
        const session = await api.start({ courseId: course.id, mode, topicId, reviewIds, count,
          ...(topicIds ? { topicIds, requireCount: true } : {}), ...(kind ? { kind } : {}),
          ...(topicQuotas ? { topicQuotas } : {}) });
        if (!isCurrent()) return;
        state.active = { ...session,
          deviceDeadline: session.challenge.deadline === null ? null : Date.now() + session.challenge.deadline - session.challenge.startedAt,
          index: 0, answers: {}, results: {}, marked: [], summary: null,
          questionShownAt: Date.now(), spentMs: {} };
        screen = 'quiz';
        save();
      });
    }

    function run(task) {
      if (busy) return;
      busy = true;
      warning = '';
      const requestGeneration = generation;
      render();
      const isCurrent = () => requestGeneration === generation;
      Promise.resolve().then(() => task(isCurrent)).catch(error => {
        if (requestGeneration === generation) warning = error.message || 'عملیات انجام نشد.';
      }).finally(() => {
        if (!isCurrent()) return;
        busy = false;
        render();
        root.querySelector('[role="alert"]')?.focus();
        if (!warning && screen === 'quiz') root.querySelector('.learn-feedback h3')?.focus();
      });
    }

    function rememberResult(result) {
      if (result.status === 'pending') return;
      const previous = state.reviews[result.id] || {};
      const streak = result.status === 'correct' ? (previous.streak || 0) + 1 : 0;
      state.reviews[result.id] = { ...previous, courseId: course.id, topicId: result.topicId, status: result.status, streak,
        attempts: (previous.attempts || 0) + 1,
        due: Date.now() + day * (streak >= 2 ? 7 : streak ? 3 : 1) };
    }

    function setBookmark(id) {
      const previous = state.reviews[id] || {};
      state.reviews[id] = { ...previous, courseId: course.id, bookmarked: !previous.bookmarked };
      save();
      render();
      root.querySelector('[data-action="bookmark"]')?.focus();
    }

    function recordTime(s, q) {
      s.spentMs[q.id] = (s.spentMs[q.id] || 0) + Math.max(0, Date.now() - s.questionShownAt);
    }

    function move(index) {
      const s = active();
      recordTime(s, s.questions[s.index]);
      s.index = index;
      s.questionShownAt = Date.now();
      save();
      render();
      root.querySelector('.learn-question-title')?.focus();
    }

    function finish() {
      const s = active();
      if (!s || s.summary || busy) return;
      recordTime(s, s.questions[s.index]);
      s.questionShownAt = Date.now();
      run(async isCurrent => {
        const summary = s.challenge.mode === 'practice'
          ? summarize(s.questions.map(q => s.results[q.id]).filter(Boolean))
          : await api.finish({ token: s.token, answers: s.answers });
        if (!isCurrent()) return;
        if (s.challenge.mode !== 'practice') summary.results.forEach(rememberResult);
        s.summary = summary;
        screen = 'summary';
        save();
      });
    }

    function summarize(results) {
      return { results, total: results.length, correct: results.filter(r => r.status === 'correct').length,
        incorrect: results.filter(r => r.status === 'incorrect').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        pending: results.filter(r => r.status === 'pending').length };
    }

    function renderTimer(s, element) {
      if (!s.challenge.deadline) return;
      const paint = () => {
        const remaining = Math.max(0, Math.ceil(((s.deviceDeadline ?? s.challenge.deadline) - Date.now()) / 1000));
        element.textContent = 'زمان باقی‌مانده: ' + digits(Math.floor(remaining / 60)) + ' دقیقه و ' + digits(remaining % 60) + ' ثانیه';
        if (remaining === 0 && !s.timedOut) {
          s.timedOut = true;
          save();
          queueMicrotask(finish);
        }
      };
      paint();
      timer = setInterval(paint, 500);
    }

    function feedback(result, parent) {
      const box = element('section', null, 'learn-feedback');
      const resultHeading = element('h3', labels[result.status], 'learn-result-' + result.status);
      resultHeading.tabIndex = -1;
      const time = active()?.spentMs?.[result.id];
      box.append(resultHeading);
      if (result.kind === 'essay') {
        box.append(element('p', 'پاسخ تو: ' + (result.selected === null ? 'نزده' : result.selected)),
          element('p', 'پاسخ نمونه برای خودارزیابی'), mathParagraph(result.explanation));
        const rubric = element('ul');
        (result.rubric || []).forEach(item => rubric.append(element('li', item)));
        box.append(details('معیارهای بررسی پاسخ', rubric));
        if (result.status === 'pending') {
          const assessment = active()?.selfAssessments?.[result.id];
          if (assessment) box.append(element('p', 'ارزیابی شخصی: ' + (assessment === 'complete' ? 'پاسخم کامل است' : 'نیاز به مرور دارم')));
          for (const [value, title] of [['complete', 'پاسخم کامل است'], ['review', 'نیاز به مرور دارم']]) {
            box.append(button(title, 'self-assess-' + value, () => {
              const session = active();
              session.selfAssessments ||= {};
              session.selfAssessments[result.id] = value;
              save();
              render();
            }));
          }
          box.append(element('p', 'این نظر شخصی است و نمرهٔ تصحیح‌شده محسوب نمی‌شود.', 'learn-muted'));
        }
      } else {
        box.append(element('p', 'پاسخ تو: ' + (result.selected === null ? 'نزده' : result.choices[result.selected])),
          element('p', 'پاسخ درست: ' + result.choices[result.answerIndex]), mathParagraph(result.explanation));
      }
      if (typeof time === 'number') box.append(element('p', 'زمان روی سؤال: ' + digits(Math.round(time / 1000)) + ' ثانیه', 'learn-muted'));
      const list = element('ol');
      result.optionReasons.forEach((reason, i) => {
        list.append(element('li', result.choices[i] + ' · ' + reason));
      });
      const reference = element('div');
      reference.append(element('p', 'شناسه: ' + result.id + ' · نسخهٔ بسته: ' + course.version),
        element('p', 'تمرین تألیفی · ' + (result.review === 'reviewed' ? 'بازبینی‌شده' : 'در انتظار بازبینی متخصص درس')),
        sources(result.sourceIds));
      if (result.kind !== 'essay') box.append(details('تحلیل تک‌تک گزینه‌ها', list));
      box.append(details('ارجاع و وضعیت سؤال', reference),
        button(state.reviews[result.id]?.bookmarked ? 'برداشتن نشان' : 'نشان‌کردن سؤال', 'bookmark', () => setBookmark(result.id)),
        button('گزارش ایراد این سؤال', 'issue-' + result.id, () => renderIssueForm(box, result.id)));
      const relatedTopic = topicFor(result.topicId);
      if (result.status === 'incorrect' && relatedTopic) {
        box.append(button((result.readingBlock ? 'مطالعهٔ بخش مرتبط: ' : 'مطالعهٔ مبحث مرتبط: ') + relatedTopic.title, 'read-related', () => {
          selectedTopic = relatedTopic;
          selectedBlock = result.readingBlock?.type === 'concept'
            ? 'concept:' + result.readingBlock.index : result.readingBlock?.type || null;
          lessonReturn = screen;
          go('lesson');
        }));
      }
      parent.append(box);
    }

    function renderQuiz() {
      const s = active();
      if (!s || !s.questions[s.index]) { go('course'); return; }
      const q = s.questions[s.index];
      const result = s.results[q.id];
      const practice = s.challenge.mode === 'practice';
      const expired = s.challenge.deadline !== null && Date.now() >= (s.deviceDeadline ?? s.challenge.deadline);
      heading(labels[s.challenge.mode], 'سؤال ' + digits(s.index + 1) + ' از ' + digits(s.questions.length));
      const box = card();
      if (s.challenge.deadline) {
        const clock = element('p', null, 'learn-clock');
        clock.setAttribute('role', 'timer');
        box.append(clock);
        renderTimer(s, clock);
      }
      box.append(element('p', [topicFor(q.topicId)?.title, q.difficulty === 'basic' ? 'پایه' : 'کاربردی', 'تألیفی'].filter(Boolean).join(' · '), 'learn-eyebrow'));
      const prompt = element('h3', q.prompt, 'learn-question-title');
      prompt.tabIndex = -1;
      box.append(prompt);
      const optionGroup = element('div', null, 'learn-options');
      optionGroup.setAttribute('role', 'group');
      optionGroup.setAttribute('aria-label', 'گزینه‌های پاسخ');
      q.choices.forEach((choice, index) => {
        const option = button(digits(index + 1) + '. ' + choice, 'pick-' + index, () => {
          s.answers[q.id] = index;
          save();
          render();
          root.querySelector('[data-action="pick-' + index + '"]')?.focus();
        }, 'learn-option');
        option.setAttribute('aria-pressed', String(s.answers[q.id] === index));
        option.disabled = !!result || expired;
        optionGroup.append(option);
      });
      let essayInput;
      if (q.kind === 'essay') {
        const label = element('label', 'پاسخ تشریحی');
        essayInput = element('textarea');
        essayInput.dataset.action = 'essay-answer';
        essayInput.maxLength = 5000;
        essayInput.disabled = !!result || expired;
        essayInput.value = typeof s.answers[q.id] === 'string' ? s.answers[q.id] : '';
        essayInput.addEventListener('input', () => {
          const value = essayInput.value;
          if (value.trim()) s.answers[q.id] = value;
          else delete s.answers[q.id];
          const submit = root.querySelector('[data-action="submit-answer"]');
          if (submit) submit.disabled = !value.trim();
          save();
        });
        label.append(essayInput);
        optionGroup.append(label);
      }
      box.append(optionGroup);
      if (practice) {
        if (result) {
          feedback(result, box);
          box.append(mainButton(s.index + 1 < s.questions.length ? 'سؤال بعد' : 'دیدن کارنامه', 'next-question', () =>
            s.index + 1 < s.questions.length ? move(s.index + 1) : finish()));
        } else {
          const send = selected => run(async isCurrent => {
            const answer = await api.answer({ token: s.token, questionId: q.id, selected });
            if (!isCurrent()) return;
            recordTime(s, q);
            s.questionShownAt = Date.now();
            s.answers[q.id] = selected;
            s.results[q.id] = answer;
            rememberResult(answer);
            save();
          });
          const submit = mainButton('ثبت پاسخ', 'submit-answer', () => send(s.answers[q.id]));
          submit.disabled = q.kind === 'essay' ? !(typeof s.answers[q.id] === 'string' && s.answers[q.id].trim()) : !Number.isInteger(s.answers[q.id]);
          box.append(submit, button('رد کردن سؤال', 'skip', () => send(null)));
        }
      } else {
        const marked = s.marked.includes(q.id);
        const mark = button(marked ? 'برداشتن علامت بازبینی' : 'علامت برای بازبینی', 'mark', () => {
          s.marked = marked ? s.marked.filter(id => id !== q.id) : [...s.marked, q.id];
          save();
          render();
          root.querySelector('[data-action="mark"]')?.focus();
        });
        mark.disabled = expired;
        box.append(mark);
        const nav = element('div', null, 'learn-question-grid');
        nav.setAttribute('aria-label', 'انتخاب شمارهٔ سؤال');
        s.questions.forEach((question, index) => {
          const selected = Object.hasOwn(s.answers, question.id) && s.answers[question.id] !== null;
          const flagged = s.marked.includes(question.id);
          const b = button(digits(index + 1) + (flagged ? ' ⚑' : ''), 'jump-' + index, () => move(index), selected ? 'learn-answered' : '');
          b.setAttribute('aria-label', 'سؤال ' + digits(index + 1) + (selected ? '، پاسخ داده شده' : '، بدون پاسخ') + (flagged ? '، علامت‌دار' : ''));
          if (index === s.index) b.setAttribute('aria-current', 'step');
          nav.append(b);
        });
        const next = button('سؤال بعد', 'next-question', () => move(s.index + 1));
        next.disabled = s.index + 1 >= s.questions.length;
        box.append(nav, next, mainButton('ثبت نهایی آزمون', 'finish', () => {
          if (window.confirm('آزمون ثبت شود؟ بعد از ثبت نهایی پاسخ‌نامه نمایش داده می‌شود.')) finish();
        }));
      }
      root.append(routeButton());
    }

    function renderSummary() {
      const summary = active()?.summary;
      if (!summary) { go('course'); return; }
      heading('کارنامهٔ تمرینی', 'نتیجهٔ همین جلسه برای انتخاب گام بعدی.');
      const counts = card();
      counts.append(element('p', [digits(summary.correct) + ' درست', digits(summary.incorrect) + ' نادرست',
        digits(summary.skipped) + ' نزده', digits(summary.pending || 0) + ' در انتظار ارزیابی'].join(' · '), 'learn-score'));
      const topicResults = new Map();
      for (const result of summary.results) {
        const totals = topicResults.get(result.topicId) || { correct: 0, incorrect: 0, skipped: 0, pending: 0 };
        totals[result.status]++;
        topicResults.set(result.topicId, totals);
      }
      const breakdown = card();
      breakdown.append(element('h3', 'نتیجهٔ هر مبحث'));
      for (const [topicId, totals] of topicResults) {
        const topic = topicFor(topicId);
        if (!topic) continue;
        breakdown.append(element('p', topic.title + ' · ' + digits(totals.correct) + ' درست · ' +
          digits(totals.incorrect) + ' نادرست · ' + digits(totals.skipped) + ' نزده · ' + digits(totals.pending) + ' در انتظار ارزیابی'));
        if (totals.incorrect) breakdown.append(button('مطالعهٔ ' + topic.title, 'summary-topic-' + topicId, () => {
          selectedTopic = topic;
          lessonReturn = 'summary';
          go('lesson');
        }));
      }
      const next = summary.results.find(result => result.status === 'incorrect' || result.status === 'skipped');
      const topic = topicFor(next?.topicId);
      if (topic) counts.append(mainButton('مرور پیشنهادی: ' + topic.title, 'review-topic', () => {
        selectedTopic = topic;
        lessonReturn = 'summary';
        go('lesson');
      }));
      const list = card();
      list.append(element('h3', 'بازبینی پاسخ‌ها'));
      summary.results.forEach(result => {
        const content = element('div');
        feedback(result, content);
        const item = details(labels[result.status] + ' · ' + result.prompt, content);
        item.dataset.question = result.id;
        list.append(item);
      });
      root.append(routeButton());
    }

    function renderReview() {
      heading('مرور و دفتر اشتباه‌ها', 'اول از حافظه جواب بده، بعد دوباره توضیح را بخوان.');
      const ids = Object.keys(state.reviews).filter(id => state.reviews[id].courseId === course.id &&
        (state.reviews[id].bookmarked || (hasReviewed(id) && state.reviews[id].status !== 'correct')));
      const due = Object.keys(state.reviews).filter(id => state.reviews[id].courseId === course.id &&
        hasReviewed(id) && (state.reviews[id].due || Infinity) <= Date.now());
      const box = card();
      box.append(element('p', ids.length || due.length
        ? digits(ids.length) + ' مورد ذخیره شده · ' + digits(due.length) + ' مورد آمادهٔ مرور'
        : 'پس از نخستین تمرین، غلط‌ها و سؤال‌های نشان‌دار اینجا دیده می‌شوند.'));
      if (due.length) box.append(mainButton('شروع مرور آماده', 'due-review', () => begin('practice', undefined, due, 6)));
      if (ids.length) box.append(button('تمرین از همهٔ موارد', 'review-all', () => begin('practice', undefined, ids, 6)));
      root.append(routeButton());
    }

    function renderRecurrence() {
      const report = data.recurrence;
      heading('الگوهای سؤال در ده دوره', 'نمونه‌های ردیابی‌شده، در انتظار تطبیق با تصویر و کلید رسمی.');
      const intro = card();
      intro.append(element('p', 'بازهٔ ' + digits(report.window.from) + ' تا ' + digits(report.window.through) + ' · شواهد بانک موجود'));
      for (const row of report.coverage) {
        intro.append(element('p', row.examLevel + ' · ' + digits(row.traceableRows) + ' سؤال دارای شناسهٔ دفترچه و شماره', 'learn-muted'));
      }
      for (const pattern of report.patterns) {
        const box = card();
        box.append(element('h3', pattern.title), element('p', pattern.examLevel + ' · ' + digits(pattern.years.length) + ' سال متمایز'),
          element('p', pattern.summary), element('p', pattern.practicePrompt, 'learn-note'));
        const list = element('ul');
        pattern.occurrences.forEach(q => list.append(element('li', 'سال ' + digits(q.year) + ' · دفترچه ' + q.booklet + ' · سؤال ' + digits(q.number))));
        box.append(details('رد شواهد', list));
      }
      root.append(button('بازگشت به درس‌ها', 'hub', () => go('hub')));
    }

    function renderQuestionIndex() {
      heading('شناسنامهٔ سؤال‌های موجود', 'سؤال‌های تألیفی و رکوردهای ردیابی‌شده با وضعیت بازبینی جداگانه.');
      const box = card();
      const label = element('label', 'جست‌وجو با سال، مقطع، دفترچه یا شناسهٔ مبحث ');
      const search = element('input');
      search.type = 'search';
      label.append(search);
      const count = element('p', '', 'learn-muted');
      count.setAttribute('aria-live', 'polite');
      const list = element('ul');
      let limit = 30;
      const more = button('نمایش موارد بیشتر', 'index-more', () => { limit += 30; update(); });
      function update() {
        const query = normalizeSearch(search.value);
        const found = data.questionIndex.entries.filter(item => normalizeSearch(
          [item.id, item.level, item.year, item.booklet, item.number, item.courseId, item.sectionId, item.topicId,
            item.sourceType === 'authored' ? 'تألیفی' : 'کنکور ردیابی شده',
            item.courseTitle, item.chapterTitle, item.topicTitle]
            .filter(value => value != null).join(' ')).includes(query));
        count.textContent = digits(found.length) + ' شناسنامه پیدا شد. ' + digits(Math.min(limit, found.length)) + ' مورد نمایش داده می‌شود.';
        list.replaceChildren();
        for (const item of found.slice(0, limit)) {
          const parts = item.sourceType === 'authored'
            ? ['تألیفی', item.courseTitle || 'درس نامشخص', item.topicTitle || 'مبحث نامشخص']
            : [item.level || 'مقطع نامشخص', item.year ? digits(item.year) : 'سال نامشخص',
            item.booklet ? 'دفترچه ' + item.booklet : 'دفترچه نامشخص',
            item.number ? 'سؤال ' + digits(item.number) : 'شماره نامشخص', item.topicId || 'مبحث نامشخص'];
          const row = element('li');
          row.append(element('p', parts.join(' · ')));
          const detail = element('div');
          detail.append(element('p', 'شناسهٔ سؤال: ' + item.id),
            element('p', 'شناسهٔ درس: ' + (item.courseId || 'ثبت نشده')),
            element('p', 'شناسهٔ بخش: ' + (item.sectionId || 'ثبت نشده')),
            element('p', 'درس ثبت‌شده: ' + (item.courseTitle || 'نامشخص')),
            element('p', 'فصل ثبت‌شده: ' + (item.chapterTitle || 'نامشخص')),
            element('p', 'مبحث ثبت‌شده: ' + (item.topicTitle || 'نامشخص')),
            element('p', 'نگاشت درس و مبحث نیازمند بازبینی است.'),
            element('p', item.sourceType === 'authored' ? 'منشأ سؤال: تألیفی' : 'کلید و منبع: در انتظار تطبیق با سند'),
            element('p', 'وضعیت حقوق: ' + (item.rights === 'pending_review' ? 'در انتظار بررسی' : item.rights === 'original_ael' ? 'تألیفی AEL' : item.rights)),
            element('p', 'وضعیت بازبینی: ' + (item.review === 'not_reviewed' || item.review === 'pending_sme' ? 'در انتظار بازبینی' : item.review)));
          if (item.auditStatus === 'conflict') detail.append(element('p', 'تعارض با تصویر موجود پیدا شده است؛ نیازمند بررسی منبع و کلید.', 'learn-warning'));
          if (item.auditStatus === 'image_match_pending_key') detail.append(element('p', 'صورت و گزینه‌ها با تصویر موجود تطبیق داده شده‌اند. کلید و اصالت فایل بررسی نشده‌اند.', 'learn-muted'));
          for (const source of item.learningReferences || []) {
            detail.append(element('p', 'مرجع آموزشی: ' + source.title + ' · ' + source.locator));
          }
          row.append(details('جزئیات شناسنامه', detail));
          list.append(row);
        }
        more.hidden = found.length <= limit;
      }
      search.addEventListener('input', () => { limit = 30; update(); });
      box.append(label, count, list, more);
      update();
      root.append(button('بازگشت به درس‌ها', 'hub', () => go('hub')));
    }

    function renderIssueForm(parent, questionId) {
      if (parent.querySelector('form')) return;
      const form = element('form', null, 'learn-issue');
      const label = element('label', 'شرح ایراد (حداکثر ۵۰۰ نویسه)');
      const field = element('textarea');
      field.maxLength = 500;
      field.required = true;
      label.append(field);
      const submit = element('button', 'ذخیرهٔ گزارش روی دستگاه', 'learn-button');
      submit.type = 'submit';
      form.append(label, submit);
      form.addEventListener('submit', event => {
        event.preventDefault();
        const note = field.value.trim();
        if (!note) return;
        state.issues.push({ questionId, note, at: new Date().toISOString() });
        save();
        form.replaceChildren(element('p', 'گزارش روی دستگاه ثبت شد.'));
        if (offline) form.append(button('رفتن به خروجی گزارش', 'issues', () => go('issues')));
      });
      parent.append(form);
      field.focus();
    }

    function renderIssues() {
      heading('گزارش ایرادها', 'فایل خروجی را می‌توانی برای بررسی بفرستی.');
      const box = card();
      box.append(element('p', digits(state.issues.length) + ' گزارش ثبت شده'));
      if (state.issues.length) {
        box.append(mainButton('دانلود گزارش JSON', 'export', () => {
          const url = URL.createObjectURL(new Blob([JSON.stringify(state.issues, null, 2)], { type: 'application/json' }));
          const a = element('a');
          a.href = url;
          a.download = 'ael-offline-feedback.json';
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }));
      }
      root.append(button('بازگشت به درس‌ها', 'hub', () => go('hub')));
    }

    function renderBackup() {
      heading('پشتیبان‌گیری و بازیابی', 'فایل را روی دستگاه نگه دار تا مطالعه، مرورها و جلسهٔ جاری را بازیابی کنی.');
      const box = card();
      box.append(mainButton('دانلود فایل پشتیبان', 'backup-export', () => {
        const session = active();
        if (session && !session.summary && session.questions[session.index]) {
          recordTime(session, session.questions[session.index]);
          session.questionShownAt = Date.now();
          save();
        }
        const content = JSON.stringify({ format: 'ael-offline-backup', version: 1, state });
        const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
        const link = element('a');
        link.href = url;
        link.download = 'ael-learning-backup.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }));
      const label = element('label', 'انتخاب فایل پشتیبان ');
      const file = element('input');
      file.type = 'file';
      file.accept = '.json,application/json';
      label.append(file);
      box.append(label, button('بازیابی از فایل', 'backup-import', () => {
        const selected = file.files?.[0];
        if (!selected || selected.size > 1_000_000) {
          warning = 'یک فایل پشتیبان کوچک‌تر از یک مگابایت انتخاب کن.';
          render();
          return;
        }
        if (!window.confirm('پیشرفت فعلی با اطلاعات فایل جایگزین شود؟')) return;
        run(async isCurrent => {
          const backup = JSON.parse(await selected.text());
          const restored = api.restoreBackup(backup);
          if (!isCurrent()) return;
          state = restored;
          save();
          screen = 'hub';
        });
      }));
      root.append(button('بازگشت به درس‌ها', 'hub', () => go('hub')));
    }

    function render() {
      clearInterval(timer);
      root.replaceChildren();
      root.classList.add('learn-app');
      root.setAttribute('aria-busy', String(busy));
      if (warning) {
        const alert = element('p', warning, 'learn-warning');
        alert.tabIndex = -1;
        alert.setAttribute('role', 'alert');
        root.append(alert);
      }
      if (!data) {
        root.append(element('p', pending ? 'در حال بارگذاری مسیرها…' : 'مسیرها آماده نیستند.', 'learn-note'));
        if (!pending) root.append(button('تلاش دوباره', 'reload', open));
        return;
      }
      const pages = { hub: renderHub, course: renderCourse, lesson: renderLesson, builder: renderBuilder, quiz: renderQuiz, summary: renderSummary,
        review: renderReview, recurrence: renderRecurrence, questionIndex: renderQuestionIndex, issues: renderIssues, backup: renderBackup };
      pages[screen]();
      if (storageUnavailable) root.append(element('p', 'مرورگر ذخیرهٔ محلی را محدود کرده است. تا وقتی این صفحه باز است می‌توانی ادامه بدهی.', 'learn-note'));
      const title = root.querySelector('h2');
      if (title) title.tabIndex = -1;
      if (busy) root.querySelectorAll('button').forEach(b => { b.disabled = true; });
    }

    function open(nextScope) {
      if (typeof nextScope === 'string' && nextScope !== scope) {
        generation += 1;
        scope = nextScope;
        state = read();
        course = undefined;
        screen = 'hub';
        busy = false;
      }
      if (!data && !pending) {
        pending = api.overview().then(result => { data = result; }).catch(error => {
          warning = error.message || 'بارگذاری مسیر ممکن نشد.';
        }).finally(() => { pending = null; render(); });
      }
      render();
    }

    function close() {
      clearInterval(timer);
      generation += 1;
      busy = false;
      course = undefined;
      screen = 'hub';
    }

    return { open, close };
  }

  window.AELLearning = { mount };
})();
