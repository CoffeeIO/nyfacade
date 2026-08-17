// Preview-page tracker. No cookie, no localStorage, no raw IP in storage.

const ALLOWED_ORIGIN = "https://nyfacade.dk";
const RETENTION_DAYS = 90;

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function visitorId(request, secret) {
  const material = [
    request.headers.get("cf-connecting-ip") ?? "",
    request.headers.get("user-agent") ?? "",
    today(),
    secret ?? "",
  ].join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(material),
  );
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function handleBeacon(request, env) {
  if (request.headers.get("origin") !== ALLOWED_ORIGIN) {
    return new Response(null, { status: 204 });
  }

  let payload;
  try {
    payload = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 204 });
  }

  const event = {
    ts: new Date().toISOString(),
    page: String(payload.p ?? "?").slice(0, 120),
    event: String(payload.e ?? "?").slice(0, 16),
    depth: Number(payload.d) || 0,
    secs: Number(payload.s) || 0,
    visitor: await visitorId(request, env.VISITOR_SALT),
    country: request.cf?.country ?? "??",
  };

  await env.HITS.put(
    `${event.ts}|${event.page}|${crypto.randomUUID().slice(0, 8)}`,
    JSON.stringify(event),
    { expirationTtl: RETENTION_DAYS * 86400 },
  );

  if (event.event === "arrive" && env.NTFY_TOPIC) {
    await fetch(`https://ntfy.sh/${env.NTFY_TOPIC}`, {
      method: "POST",
      body: `${event.page}: someone just opened the preview (${event.country})`,
    }).catch(() => {});
  }

  return new Response(null, { status: 204 });
}

async function handleStats(url, env) {
  if (url.searchParams.get("key") !== env.STATS_KEY) {
    return new Response("nope", { status: 401 });
  }

  const listed = await env.HITS.list({ limit: 1000 });
  const rows = await Promise.all(
    listed.keys.map((k) => env.HITS.get(k.name, "json")),
  );

  const byPage = new Map();
  for (const r of rows.filter(Boolean)) {
    const agg = byPage.get(r.page) ?? {
      page: r.page, visits: 0, visitors: new Set(),
      maxDepth: 0, maxSecs: 0, last: "",
    };
    if (r.event === "arrive") agg.visits += 1;
    agg.visitors.add(r.visitor);
    agg.maxDepth = Math.max(agg.maxDepth, r.depth);
    agg.maxSecs = Math.max(agg.maxSecs, r.secs);
    if (r.ts > agg.last) agg.last = r.ts;
    byPage.set(r.page, agg);
  }

  const summary = [...byPage.values()]
    .map((a) => ({ ...a, visitors: a.visitors.size }))
    .sort((a, b) => b.last.localeCompare(a.last));

  return Response.json(summary, {
    headers: { "cache-control": "no-store" },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/t" && request.method === "POST") {
      return handleBeacon(request, env);
    }
    if (url.pathname === "/stats") {
      return handleStats(url, env);
    }
    return new Response(null, { status: 404 });
  },
};
