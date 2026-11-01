// §8.3 (Phase 4): FSRS reference tests.
// Pins our scheduler to the published FSRS-5 specification and cross-probes the
// independent reference implementation ts-fsrs where the two specs coincide.
//
// ORACLE REGISTRY (mission §8.3: "reference library version and parameters must be recorded"):
//   reference: open-spaced-repetition FSRS-5 spec constants, re-derived as literals in this
//              file (DECAY=-0.5, FACTOR=19/81) — expected values computed here, not imported
//              from our module, so the check is independent of the implementation under test.
//   oracle lib: ts-fsrs@6.0.0 (devDependency, MIT, open-spaced-repetition org).
//   KNOWN DEVIATION (honest, asserted as documentation below): ts-fsrs 6.0.0 ships FSRS-6
//     (decay −0.1542, extra short-term w[20] modulation) and cannot run the FSRS-5 curve
//     (FSRSVersion exports "v6.0.0" only). It therefore agrees with us only at integral
//     stability/elapsed points (both curves satisfy R(S,S)=0.9 for S≥1) and NOT on
//     fractional-S points or DSR transitions. Our engine implements the FSRS-5 transition
//     formulas per spec; ts-fsrs numbers are not the acceptance criterion for transitions.
//   our weights: DEFAULT_FSRS_WEIGHTS = 17-param FSRS-5 set; w[0..3]=(0.4,1.2,3.2,8.0) are
//     deliberately re-calibrated for academic MCQ (published FSRS-5 defaults:
//     0.4025/1.1822/3.1213/8.0) — recorded deviation, not a bug.
import { describe, expect, it } from 'vitest';
import {
  FSRS5_DEFAULT_DECAY,
  FSRS6_DEFAULT_DECAY,
  FSRS,
  FSRSVersion,
  State,
  createEmptyCard,
} from 'ts-fsrs';
import {
  Rating,
  FSRS_DECAY,
  FSRS_FACTOR,
  DEFAULT_FSRS_WEIGHTS,
  calculateRetrievability,
  calculateNextInterval,
  initializeFSRSState,
  scheduleNextFSRS,
  type FSRSState,
} from '../src/fsrs';

/* ---------- FSRS-5 spec constants, re-derived independently in the test ---------- */
const SPEC_DECAY = -1 / 2; // published FSRS-5 DECAY
const SPEC_FACTOR = Math.pow(0.9, 1 / SPEC_DECAY) - 1; // = 19/81 exactly
const specRetrievability = (S: number, t: number) => Math.pow(1 + SPEC_FACTOR * (t / S), SPEC_DECAY);

const D0 = new Date('2026-01-01T00:00:00Z').getTime();
const DAY = 86_400_000;
const oracle = new FSRS({ enable_fuzz: false });

function oracleCard(stability: number, difficulty = 5) {
  const card = createEmptyCard(D0);
  return {
    ...card,
    stability,
    difficulty,
    reps: 2,
    lapses: 0,
    state: State.Review,
    last_review: D0,
    due: D0,
  };
}

describe('§8.3 FSRS reference tests', () => {
  it('منحنی FSRS-5: DECAY و FACTOR با مقادیر منتشرشده یکی‌اند', () => {
    expect(FSRS_DECAY).toBeCloseTo(SPEC_DECAY, 12);
    expect(SPEC_FACTOR).toBeCloseTo(19 / 81, 12); // sanity of the derivation itself
    expect(FSRS_FACTOR).toBeCloseTo(SPEC_FACTOR, 12);
  });

  describe('منحنی فراموشی — بردارهای مرجع مشخصه (محاسبهٔ مستقل در تست)', () => {
    const vectors: [number, number][] = [
      [2, 0], [2, 1], [2, 2], [5, 3], [10, 15], [0.5, 4], [30, 45], [120, 60],
    ];
    for (const [S, t] of vectors) {
      it(`R(S=${S}, t=${t}) == (1+19/81·t/S)^-0.5`, () => {
        expect(calculateRetrievability(S, t)).toBeCloseTo(specRetrievability(S, t), 12);
      });
    }

    it('تعریف پایداری: R(S, S) = 0.90 برای هر S (منتظر ۱۰، ۴، ۱۲۰)', () => {
      for (const S of [4, 10, 120]) {
        expect(calculateRetrievability(S, S)).toBeCloseTo(0.9, 9);
      }
    });

    it('وارونگی: f⁻¹(f(S,t)) = t و f(f⁻¹) = r هدف', () => {
      for (const S of [1.5, 5, 40]) {
        for (const r of [0.7, 0.8, 0.85, 0.9, 0.95]) {
          const days = calculateNextInterval(S, r, 3650);
          // round() convention: unrounded spec inverse must lie within 0.5 of our integer
          const exact = (S * (Math.pow(r, 1 / SPEC_DECAY) - 1)) / SPEC_FACTOR;
          expect(Math.abs(days - exact)).toBeLessThanOrEqual(0.5 + 1e-9);
          expect(specRetrievability(S, days)).toBeCloseTo(r, 1);
        }
      }
    });
  });

  describe('اوراکل ts-fsrs — نقاط اشتراک و انحراف ثبت‌شده', () => {
    it('نسخهٔ مرجع ثبت می‌شود و مد آن FSRS-6 است (انحراف مستند)', () => {
      // نسخهٔ دقیق کتابخانهٔ مرجع (از import خود ماژول) ثبت می‌شود:
      expect(FSRSVersion).toBe('v6.0.0');
      // FSRS-6 (مد ts-fsrs) و FSRS-5 (مدل ما) DECAY مشترک ندارند:
      expect(FSRS5_DEFAULT_DECAY).toBeCloseTo(0.5, 10); // magnitude of FSRS-5 decay
      expect(FSRS6_DEFAULT_DECAY).toBeCloseTo(0.1542, 4);
      // در نقاط صحیحِ S≥1 هر دو منحنی R(S,S)=0.9 را دارند — این را چک می‌کنیم:
      expect(oracle.retrievability(oracleCard(2), D0 + 2 * DAY)).toBeCloseTo(0.9, 9);
      expect(calculateRetrievability(2, 2)).toBeCloseTo(0.9, 9);
      // و انحراف را هم مستند می‌کنیم (نه اینکه پنهانش کنیم): ts-fsrs روی S کسری
      // روزشمار floor می‌کند و منحنی FSRS-6 دارد؛ پس فقط نقاط صحیح هم‌خوان‌اند.
      expect(oracle.retrievability(oracleCard(0.5), D0 + 0.5 * DAY)).not.toBeCloseTo(0.9, 6);
    });

    it('فاصلهٔ مرجع: next_interval در r=0.9 با ما یکی است؛ در r≠0.9 گردکردن متفاوت است (مستند)', () => {
      // r=0.9 شبکهٔ صحیح: S=2→2، S=5→5، S=10→10 در هر دو پیاده‌سازی
      for (const S of [2, 5, 10, 20]) {
        expect(oracle.model.nextInterval(oracleCard(S), 0.9)).toBe(S);
        expect(calculateNextInterval(S, 0.9, 3650)).toBe(S);
      }
      // r=0.85: مقدار دقیق 3.287 روز؛ ما round→3، ts-fsrs با فرمول FSRS-6→4.
      // انحراف ثبت‌شده است: convention گردکردن ما Math.round (مستند در ARC-02).
      const exact085 = (2 * (Math.pow(0.85, 1 / SPEC_DECAY) - 1)) / SPEC_FACTOR;
      expect(Math.abs(calculateNextInterval(2, 0.85, 3650) - exact085)).toBeLessThanOrEqual(0.5);
    });
  });

  describe('مقادیر اولیه — فرمول FSRS-5 با وزن‌های کالیبره‌شدهٔ ما', () => {
    it('S0(rating) = w[rating-1] و D0 = clamp(w4 − exp(w5·(r−1)) + 1, 1, 10)', () => {
      const w = DEFAULT_FSRS_WEIGHTS;
      for (const rating of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy]) {
        const st = initializeFSRSState(rating, new Date(D0));
        expect(st.stability).toBeCloseTo(w[rating - 1], 6);
        const d0 = w[4] - Math.exp(w[5] * (rating - 1)) + 1;
        expect(st.difficulty).toBeCloseTo(Math.max(1, Math.min(10, d0)), 6);
      }
      // وزن‌های منتشرشدهٔ FSRS-5 برای S0 با ما متفاوت است (کالیبراسیون MCQ) — مستند:
      const publishedFSRS5S0 = [0.4025, 1.1822, 3.1213, 8.0];
      expect(DEFAULT_FSRS_WEIGHTS.slice(0, 4)).not.toEqual(publishedFSRS5S0);
    });

    it('Again روی کارت تازه: reps=0 و lapses=1؛ Good: reps=1 و lapses=0', () => {
      const again = initializeFSRSState(Rating.Again, new Date(D0));
      expect(again.reps).toBe(0);
      expect(again.lapses).toBe(1);
      const good = initializeFSRSState(Rating.Good, new Date(D0));
      expect(good.reps).toBe(1);
      expect(good.lapses).toBe(0);
    });
  });

  describe('گذار DSR — ویژگی‌های مشخصه FSRS-5', () => {
    // کارت بالغ با تاریخچه: سه مرور Good به‌موقع تا elapsed≥1 و S>1
    const mature = () => {
      let st = initializeFSRSState(Rating.Good, new Date(D0));
      for (let i = 0; i < 3; i++) {
        st = scheduleNextFSRS(st, Rating.Good, new Date(D0 + st.intervalDays * DAY));
      }
      return st;
    };
    // کارت میانی (D=5، خارج از کران‌ها) برای تست یکنواicidad سختی:
    // D0 پس از clamp اغلب روی کران می‌نشیند و آنجا Hard=Good=Easy برابرن؛
    // ordering را در نقطهٔ داخلی منحنی بررسی می‌کنیم.
    const midCard = (difficulty: number): FSRSState => ({
      ...initializeFSRSState(Rating.Good, new Date(D0)),
      difficulty,
    });

    it('پاسخ موفق (با elapsed≥1) پایداری را زیاد می‌کند', () => {
      const base = mature();
      expect(base.intervalDays).toBeGreaterThan(1);
      const afterGood = scheduleNextFSRS(base, Rating.Good, new Date(D0 + base.intervalDays * DAY));
      expect(afterGood.stability).toBeGreaterThan(base.stability);
      expect(afterGood.reps).toBe(base.reps + 1);
    });

    it('بی‌نظمی یکنوا است: Hard > Good > Easy و همواره در [1,10]', () => {
      const base = midCard(5); // نقطهٔ داخلی منحنی؛ در کران‌ها مقایسهٔ strict بی‌معناست
      const at = new Date(D0 + base.intervalDays * DAY);
      const dH = scheduleNextFSRS(base, Rating.Hard, at).difficulty;
      const dG = scheduleNextFSRS(base, Rating.Good, at).difficulty;
      const dE = scheduleNextFSRS(base, Rating.Easy, at).difficulty;
      expect(dH).toBeGreaterThan(dG);
      expect(dG).toBeGreaterThan(dE);
      for (const d of [dH, dG, dE]) {
        expect(d).toBeGreaterThanOrEqual(1);
        expect(d).toBeLessThanOrEqual(10);
      }
    });

    it('سقوط: S_new ≤ S_old و کران پایین 0.1 و lapses+1؛ فرمول w11·D^−w12·((S+1)^w13−1)·e^{w14(1−R)}', () => {
      const base = mature();
      const at = new Date(D0 + base.intervalDays * DAY);
      const lapse = scheduleNextFSRS(base, Rating.Again, at);
      expect(lapse.stability).toBeLessThanOrEqual(base.stability);
      expect(lapse.stability).toBeGreaterThanOrEqual(0.1);
      expect(lapse.lapses).toBe(base.lapses + 1);
      // بازتولید مستقل فرمول مشخصه از وزن‌ها و حالت پایه.
      // طبق منبع/fsrs.ts خط 156 و مشخصه FSRS-5، فرمول فراموشی از D پایه (پیش از گذار) استفاده می‌کند.
      // convention: موتور نتایج را ۲ اعشار گرد می‌کند (ARC-02) — مقایسه با round۲:
      const r2 = (x: number) => Math.round(x * 100) / 100;
      const w = DEFAULT_FSRS_WEIGHTS;
      const elapsed = (at.getTime() - new Date(base.lastReviewedAt).getTime()) / 86_400_000;
      const R = calculateRetrievability(base.stability, elapsed);
      const sForget =
        w[11] *
        Math.pow(base.difficulty, -w[12]) *
        (Math.pow(base.stability + 1, w[13]) - 1) *
        Math.exp(w[14] * (1 - R));
      expect(lapse.stability).toBe(r2(Math.max(0.1, Math.min(base.stability, sForget))));
    });

    it('تأثیر بازیابی: مرور دیرتر (R پایین‌تر) ضربهٔ پایداری بزرگ‌تری دارد — member w10', () => {
      const base = mature();
      const onTime = scheduleNextFSRS(base, Rating.Good, new Date(D0 + base.intervalDays * DAY));
      const late = scheduleNextFSRS(base, Rating.Good, new Date(D0 + (base.intervalDays + 20) * DAY));
      expect(late.stability).toBeGreaterThan(onTime.stability);
    });

    it('زمان‌بندی مجدد: interval = clamp(round(S·(r^{1/DECAY}−1)/FACTOR),1,max) در چرخهٔ ۱۲ مرور', () => {
      let st = initializeFSRSState(Rating.Easy, new Date(D0));
      for (let review = 0; review < 12; review++) {
        st = scheduleNextFSRS(st, Rating.Good, new Date(D0 + (st.intervalDays + 1) * DAY), {
          maximumInterval: 60,
        });
        expect(st.intervalDays).toBeGreaterThanOrEqual(1);
        expect(st.intervalDays).toBeLessThanOrEqual(60);
        const exact = (st.stability * (Math.pow(0.9, 1 / SPEC_DECAY) - 1)) / SPEC_FACTOR;
        expect(Math.abs(st.intervalDays - Math.min(60, Math.max(1, Math.round(exact))))).toBeLessThanOrEqual(1e-9);
      }
    });
  });
});
