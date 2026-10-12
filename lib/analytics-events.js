export function filterAnalyticsEvent(event) {
  if (typeof event?.url !== 'string') return null;
  try {
    const url = new URL(event.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const pathname = decodeURIComponent(url.pathname);
    // Account search URLs can contain email addresses. Keep admin activity out
    // of analytics, including equivalent percent-encoded route names.
    if (pathname === '/admin' || pathname.startsWith('/admin/')) return null;
    return event;
  } catch {
    return null;
  }
}
