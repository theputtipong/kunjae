import type { Breadcrumb, CloudflareOptions, Event, RequestEventData } from "@sentry/cloudflare";

const TRACES_SAMPLE_RATE = 0.1;

const DROPPED_INTEGRATIONS = new Set(["RequestData"]);

const NETWORK_CRUMBS = new Set(["fetch", "http"]);

const KEPT_SPAN_KEYS = new Set([
  "http.request.method",
  "http.response.status_code",
  "http.route",
  "url.path",
]);

type SpanData = NonNullable<Event["spans"]>[number]["data"];

const scrubSpanData = (data: SpanData | undefined): SpanData | undefined => {
  if (data === undefined) return undefined;
  const kept: SpanData = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("sentry.") || KEPT_SPAN_KEYS.has(key)) kept[key] = value;
  }
  const full = data["url.full"];
  if (typeof full === "string" && kept["url.path"] === undefined) {
    const path = pathOnly(full);
    if (path !== null) kept["url.path"] = path;
  }
  return kept;
};

const pathOnly = (url: string | undefined): string | null => {
  if (url === undefined) return null;
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
};

const scrubRequest = (request: RequestEventData): RequestEventData => {
  const kept: RequestEventData = {};
  if (request.method !== undefined) kept.method = request.method;
  const path = pathOnly(request.url);
  if (path !== null) kept.url = path;
  return kept;
};

const scrubCrumb = (crumb: Breadcrumb): Breadcrumb => {
  const kept: Breadcrumb = { ...crumb };
  delete kept.data;
  return kept;
};

const scrub = <E extends Event>(event: E): E => {
  delete event.user;
  delete event.server_name;
  event.breadcrumbs = (event.breadcrumbs ?? [])
    .filter((crumb) => !NETWORK_CRUMBS.has(crumb.category ?? ""))
    .map(scrubCrumb);
  if (event.request !== undefined) event.request = scrubRequest(event.request);
  delete event.extra;
  const trace = event.contexts?.trace;
  event.contexts = trace === undefined ? {} : { trace: { ...trace, data: scrubSpanData(trace.data) ?? {} } };
  if (event.spans !== undefined) {
    event.spans = event.spans.map((span) => ({ ...span, data: scrubSpanData(span.data) ?? {} }));
  }
  return event;
};

export const sentryOptions = (env: Env): CloudflareOptions | undefined => {
  const raw: unknown = (env as unknown as Record<string, unknown>)["SENTRY_DSN"];
  if (typeof raw !== "string" || raw.length === 0) return undefined;

  return {
    dsn: raw,
    environment: "production",
    sendDefaultPii: false,
    tracesSampleRate: TRACES_SAMPLE_RATE,
    integrations: (defaults) => defaults.filter((integration) => !DROPPED_INTEGRATIONS.has(integration.name)),
    beforeSend: (event) => scrub(event),
    beforeSendTransaction: (event) => scrub(event),
    beforeBreadcrumb: (crumb) => (NETWORK_CRUMBS.has(crumb.category ?? "") ? null : crumb),
  };
};
