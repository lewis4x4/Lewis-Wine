const ROUTE_PATH = "/api/portfolio-radar/refresh/scheduled";

export const config = {
  schedule: "@daily",
};

function scheduledEndpoint() {
  const explicit = process.env.POURFOLIO_REFRESH_SCHEDULE_URL?.trim();
  if (explicit) return explicit;
  const siteUrl = process.env.URL?.trim() || process.env.DEPLOY_PRIME_URL?.trim();
  if (!siteUrl) return null;
  return new URL(ROUTE_PATH, siteUrl).toString();
}

export default async function portfolioRadarRefreshSchedule() {
  const endpoint = scheduledEndpoint();
  const secret = process.env.POURFOLIO_CRON_SECRET?.trim();

  if (!endpoint || !secret) {
    return new Response(JSON.stringify({ success: false, error: "Scheduled Portfolio Radar refresh is not configured" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secret,
      "content-type": "application/json",
    },
  });

  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") || "application/json" },
  });
}
