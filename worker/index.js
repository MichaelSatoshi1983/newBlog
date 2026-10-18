const ABOUT_WEBSITE_ENDPOINT = "/api/about-website-info";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
      continent: cf.continent ?? null,
      city: cf.city ?? null,
      region: cf.region ?? null,
      timezone: cf.timezone ?? null,
      clientTcpRtt: cf.clientTcpRtt ?? null,
      clientQuicRtt: cf.clientQuicRtt ?? null,
      cfRay: request.headers.get("cf-ray")
    };

    return new Response(request.method === "HEAD" ? null : JSON.stringify(info), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
