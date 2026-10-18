const ABOUT_WEBSITE_ENDPOINT = "/api/about-website-info";
const ABOUT_WEBSITE_ANALYTICS_ENDPOINT = "/api/about-website-analytics";
const ANALYTICS_GRAPHQL_ENDPOINT = "https://api.cloudflare.com/client/v4/graphql";
const ANALYTICS_CACHE_SECONDS = 300;
const ANALYTICS_RANGES = {
  "24h": { milliseconds: 24 * 60 * 60 * 1000, label: "24 hours" },
  "7d": { milliseconds: 7 * 24 * 60 * 60 * 1000, label: "7 days" },
  "30d": { milliseconds: 30 * 24 * 60 * 60 * 1000, label: "30 days" }
};

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...headers
    }
  });
}

function graphqlString(value) {
  return JSON.stringify(String(value));
}

function buildAnalyticsQuery({ accountId, zoneId, workerName, start, end }) {
  const httpFilter = `filter: { datetime_geq: ${graphqlString(start)}, datetime_lt: ${graphqlString(end)}, requestSource: "eyeball" }`;
  const securityFilter = `filter: { datetime_geq: ${graphqlString(start)}, datetime_lt: ${graphqlString(end)} }`;
  const workerFilter = `filter: { scriptName: ${graphqlString(workerName)}, datetime_geq: ${graphqlString(start)}, datetime_lt: ${graphqlString(end)} }`;

  return `query AboutWebsiteAnalytics {
    viewer {
      zones(filter: { zoneTag: ${graphqlString(zoneId)} }) {
        requests: httpRequestsAdaptiveGroups(${httpFilter}, limit: 1) {
          count
          sum { edgeResponseBytes }
          avg { sampleInterval }
        }
        cache: httpRequestsAdaptiveGroups(${httpFilter}, limit: 20, orderBy: [count_DESC]) {
          count
          dimensions { cacheStatus }
        }
        countries: httpRequestsAdaptiveGroups(${httpFilter}, limit: 10, orderBy: [count_DESC]) {
          count
          dimensions { clientCountryName }
        }
        statuses: httpRequestsAdaptiveGroups(${httpFilter}, limit: 20, orderBy: [count_DESC]) {
          count
          dimensions { edgeResponseStatus }
        }
        security: firewallEventsAdaptiveGroups(${securityFilter}, limit: 20, orderBy: [count_DESC]) {
          count
          dimensions { action source }
        }
      }
      accounts(filter: { accountTag: ${graphqlString(accountId)} }) {
        worker: workersInvocationsAdaptive(limit: 1, ${workerFilter}) {
          sum { requests errors subrequests }
          quantiles { cpuTimeP50 cpuTimeP99 }
        }
      }
    }
  }`;
}

async function fetchAnalytics(env, range) {
  const now = Date.now();
  const end = new Date(now).toISOString();
  const start = new Date(now - range.milliseconds).toISOString();
  const query = buildAnalyticsQuery({
    accountId: env.CF_ANALYTICS_ACCOUNT_ID,
    zoneId: env.CF_ANALYTICS_ZONE_ID,
    workerName: env.CF_ANALYTICS_WORKER_NAME || "blog123",
    start,
    end
  });

  const upstream = await fetch(ANALYTICS_GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CF_ANALYTICS_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({ query })
  });

  if (!upstream.ok) throw new Error("Cloudflare Analytics request failed");

  const payload = await upstream.json();
  if (payload.errors?.length) throw new Error("Cloudflare Analytics query failed");

  const viewer = payload.data?.viewer;
  const zone = viewer?.zones?.[0];
  const worker = viewer?.accounts?.[0]?.worker?.[0];
  if (!zone) throw new Error("Cloudflare Analytics returned no zone data");

  const total = zone.requests?.[0] || {};
  const workerSum = worker?.sum || {};
  const workerQuantiles = worker?.quantiles || {};

  return jsonResponse({
    range: range.label,
    generatedAt: end,
    requests: total.count ?? null,
    trafficBytes: total.sum?.edgeResponseBytes ?? null,
    sampleInterval: total.avg?.sampleInterval ?? null,
    cache: (zone.cache || []).map((row) => ({
      status: row.dimensions?.cacheStatus ?? "N/A",
      requests: row.count ?? 0
    })),
    countries: (zone.countries || []).map((row) => ({
      country: row.dimensions?.clientCountryName ?? "N/A",
      requests: row.count ?? 0
    })),
    statuses: (zone.statuses || []).map((row) => ({
      status: row.dimensions?.edgeResponseStatus ?? "N/A",
      requests: row.count ?? 0
    })),
    securityEvents: (zone.security || []).map((row) => ({
      action: row.dimensions?.action ?? "N/A",
      source: row.dimensions?.source ?? "N/A",
      events: row.count ?? 0
    })),
    worker: {
      requests: workerSum.requests ?? null,
      errors: workerSum.errors ?? null,
      subrequests: workerSum.subrequests ?? null,
      cpuTimeP50: workerQuantiles.cpuTimeP50 ?? null,
      cpuTimeP99: workerQuantiles.cpuTimeP99 ?? null
    }
  }, 200, {
    "Cache-Control": `public, max-age=${ANALYTICS_CACHE_SECONDS}, s-maxage=${ANALYTICS_CACHE_SECONDS}`
  });
}

async function handleAnalyticsRequest(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET, HEAD" }
    });
  }

  const url = new URL(request.url);
  const rangeKey = url.searchParams.get("range") || "24h";
  const range = ANALYTICS_RANGES[rangeKey];
  if (!range) {
    return jsonResponse({ error: "invalid_range", allowed: Object.keys(ANALYTICS_RANGES) }, 400, {
      "Cache-Control": "no-store"
    });
  }

  if (!env.CF_ANALYTICS_TOKEN || !env.CF_ANALYTICS_ACCOUNT_ID || !env.CF_ANALYTICS_ZONE_ID) {
    return jsonResponse({ error: "analytics_not_configured" }, 503, {
      "Cache-Control": "no-store"
    });
  }

  if (request.method === "HEAD") {
    return new Response(null, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${ANALYTICS_CACHE_SECONDS}, s-maxage=${ANALYTICS_CACHE_SECONDS}`
      }
    });
  }

  const cacheKey = new Request(`${url.origin}${ABOUT_WEBSITE_ANALYTICS_ENDPOINT}?range=${rangeKey}`);
  let edgeCache;
  try {
    edgeCache = caches.default;
    const cached = await edgeCache.match(cacheKey);
    if (cached) {
      return request.method === "HEAD"
        ? new Response(null, { status: cached.status, headers: cached.headers })
        : cached;
    }
  } catch {
    edgeCache = null;
  }

  try {
    const response = await fetchAnalytics(env, range);
    if (edgeCache) {
      try {
        await edgeCache.put(cacheKey, response.clone());
      } catch {
        // The endpoint still works if the cache is unavailable in a local or preview runtime.
      }
    }
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  } catch {
    return jsonResponse({ error: "analytics_unavailable" }, 502, {
      "Cache-Control": "no-store"
    });
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === ABOUT_WEBSITE_ANALYTICS_ENDPOINT) {
      return handleAnalyticsRequest(request, env);
    }

    if (url.pathname !== ABOUT_WEBSITE_ENDPOINT) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" }
      });
    }

    const cf = request.cf || {};
    const info = {
      asn: cf.asn ?? null,
      asOrganization: cf.asOrganization ?? null,
      clientAcceptEncoding: cf.clientAcceptEncoding ?? null,
      clientQuicRtt: cf.clientQuicRtt ?? null,
      clientTcpRtt: cf.clientTcpRtt ?? null,
      colo: cf.colo ?? null,
      country: cf.country ?? null,
      edgeL4DeliveryRate: cf.edgeL4?.deliveryRate ?? null,
      isEUCountry: cf.isEUCountry ?? null,
      httpProtocol: cf.httpProtocol ?? null,
      hostMetadata: cf.hostMetadata ?? null,
      requestPriority: cf.requestPriority ?? null,
      tlsCipher: cf.tlsCipher ?? null,
      tlsClientAuth: cf.tlsClientAuth ?? null,
      tlsClientCiphersSha1: cf.tlsClientCiphersSha1 ?? null,
      tlsClientExtensionsSha1: cf.tlsClientExtensionsSha1 ?? null,
      tlsClientExtensionsSha1Le: cf.tlsClientExtensionsSha1Le ?? null,
      tlsClientHelloLength: cf.tlsClientHelloLength ?? null,
      tlsClientRandom: cf.tlsClientRandom ?? null,
      tlsVersion: cf.tlsVersion ?? null,
      continent: cf.continent ?? null,
      city: cf.city ?? null,
      latitude: cf.latitude ?? null,
      longitude: cf.longitude ?? null,
      postalCode: cf.postalCode ?? null,
      metroCode: cf.metroCode ?? null,
      region: cf.region ?? null,
      regionCode: cf.regionCode ?? null,
      timezone: cf.timezone ?? null,
      cfRay: request.headers.get("cf-ray")
    };

    const response = jsonResponse(info, 200, { "Cache-Control": "private, no-store" });
    return request.method === "HEAD"
      ? new Response(null, { status: response.status, headers: response.headers })
      : response;
  }
};
