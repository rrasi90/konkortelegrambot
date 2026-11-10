// ماژول مجازی: فقط در زمان Build توسط scripts/build-ael-offline.mjs تزریق می‌شود
// و «Projection عمومی» دوره‌ها را می‌دهد (بدون هیچ فیلد کلید-محور).
declare module 'ael-offline-source' {
  const offlineSourceCourses: unknown[];
  export default offlineSourceCourses;
}
