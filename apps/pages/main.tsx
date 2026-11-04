import { createRoot } from 'react-dom/client';
import { parseWorkerAppUrl } from './app-url';
import './styles.css';

const appUrl = parseWorkerAppUrl(import.meta.env.VITE_AEL_APP_URL);

createRoot(document.getElementById('root')!).render(
  <main>
    <p className="brand">AEL</p>
    <h1>سامانهٔ یادگیری تطبیقی مدیریت</h1>
    <p>برنامهٔ مطالعه، تمرین و بازخورد پاسخ‌ها در محیط یادگیری ارائه می‌شود.</p>
    {appUrl
      ? <a href={appUrl} rel="noreferrer">باز کردن محیط یادگیری</a>
      : <p role="status">نشانی محیط یادگیری برای این نسخه تنظیم نشده است.</p>}
  </main>,
);
