interface Env {
  APP_ORIGIN?: string;
}

function json(body: Record<string, unknown>, status = 200, origin?: string): Response {
  const headers = new Headers({
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });

  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
    headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
    headers.set("access-control-allow-headers", "content-type, authorization, x-telegram-bot-api-secret-token");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("origin");
    const allowedOrigin = env.APP_ORIGIN && origin === env.APP_ORIGIN ? origin : undefined;

    if (request.method === "OPTIONS") {
      if (origin && !allowedOrigin) return json({ error: "origin_not_allowed" }, 403);
      return new Response(null, {
        status: 204,
        headers: allowedOrigin
          ? {
              "access-control-allow-origin": allowedOrigin,
              "access-control-allow-methods": "GET, POST, OPTIONS",
              "access-control-allow-headers": "content-type, authorization",
              "access-control-max-age": "600",
              vary: "Origin",
            }
          : {},
      });
    }

    if (origin && env.APP_ORIGIN && !allowedOrigin) {
      return json({ error: "origin_not_allowed" }, 403);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return json({ status: "ok", service: "konkor-api", implementation: "scaffold" }, 200, allowedOrigin);
    }

    if (request.method === "GET" && url.pathname === "/api/v1/status") {
      return json({
        state: "scaffold_only",
        connected: {
          telegramWebhook: false,
          telegramInitDataValidation: false,
          database: false,
          learnerEvents: false,
        },
      }, 200, allowedOrigin);
    }

    if (url.pathname === "/telegram/webhook") {
      return json({ error: "telegram_webhook_not_configured" }, 503, allowedOrigin);
    }

    if (url.pathname.startsWith("/api/")) {
      return json({ error: "not_implemented", message: "This endpoint is intentionally unavailable in the scaffold." }, 501, allowedOrigin);
    }

    return json({ error: "not_found" }, 404, allowedOrigin);
  },
};
