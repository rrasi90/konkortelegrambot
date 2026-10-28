const modules = [
  { number: "۰۱", title: "تمرین روزانه", description: "فعالیت بعدی بر اساس زمان و شواهد یادگیری انتخاب می‌شود." },
  { number: "۰۲", title: "مرور هوشمند", description: "مرور حافظه پس از اتصال موتور FSRS فعال خواهد شد." },
  { number: "۰۳", title: "شبیه‌ساز آزمون", description: "بانک تمرین و آزمون دیده‌نشده از هم جدا خواهند بود." },
  { number: "۰۴", title: "نقشهٔ مهارت‌ها", description: "وضعیت مهارت همراه با میزان اطمینان به شواهد نمایش داده می‌شود." },
];

export default function App() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">ک</div>
        <div className="brand-copy">
          <span className="eyebrow">سامانهٔ یادگیری تطبیقی</span>
          <h1>مسیر کنکور تو</h1>
        </div>
        <span className="demo-badge">نمونهٔ رابط</span>
      </header>

      <section className="hero" aria-labelledby="hero-title">
        <p className="eyebrow">یادگیری با شواهد، نه حدس</p>
        <h2 id="hero-title">هر پاسخ، سرنخی برای قدم بعدی است.</h2>
        <p className="hero-copy">
          سیستم باید ضعف احتمالی را بررسی کند، تمرین متناسب پیشنهاد دهد و با یک سؤال تازه
          بسنجد که یادگیری واقعاً اتفاق افتاده است یا نه.
        </p>
        <div className="prototype-notice" role="status">
          این نسخه فقط اسکلت رابط است؛ هنوز به ربات تلگرام، حساب کاربری یا بانک سؤال متصل نیست.
        </div>
        <button className="primary-button" type="button" disabled>
          تمرین روزانه پس از اتصال فعال می‌شود
        </button>
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">ماژول‌های اصلی</p>
          <h2>یک مسیر، چهار ابزار</h2>
        </div>
        <span className="module-count">۴ بخش</span>
      </section>

      <section className="module-grid" aria-label="بخش‌های محصول">
        {modules.map((item) => (
          <article className="module-card" key={item.number}>
            <span className="module-number">{item.number}</span>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span className="not-connected">هنوز متصل نشده</span>
          </article>
        ))}
      </section>

      <footer className="footer">
        <span>نسخهٔ پایهٔ محصول</span>
        <span>تمرین ← تشخیص ← ترمیم ← بازسنجی</span>
      </footer>
    </main>
  );
}
