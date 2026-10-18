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

    return new Response(request.method === "HEAD" ? null : JSON.stringify(info), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
