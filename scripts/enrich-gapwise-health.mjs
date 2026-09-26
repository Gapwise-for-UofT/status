const [owner, repo] = String(process.env.GITHUB_REPOSITORY || "GapwiseHQ/status").split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must be in owner/repo form.");
const issueNumber = Number(process.env.STATUS_ISSUE_NUMBER || "1");
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
if (!token) throw new Error("GH_TOKEN or GITHUB_TOKEN is required.");

const START = "<!-- GAPWISE_STATUS_JSON_START -->";
const END = "<!-- GAPWISE_STATUS_JSON_END -->";
const headers = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "gapwise-status-enricher",
};

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function safeJson(url) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(5_000),
      headers: { Accept: "application/json", "User-Agent": "GapwiseStatusMonitor/1.0 (+https://status.gapwise.ca)" },
    });
    if (!response.ok) return null;
    const value = await response.json();
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function parse(body) {
  const start = body.indexOf(START);
  const end = body.indexOf(END);
  if (start < 0 || end <= start) throw new Error("Status issue is missing JSON markers.");
  return JSON.parse(body.slice(start + START.length, end).trim());
}

function render(originalBody, data) {
  const start = originalBody.indexOf(START);
  const end = originalBody.indexOf(END);
  return `${originalBody.slice(0, start + START.length)}\n${JSON.stringify(data, null, 2)}\n${originalBody.slice(end)}`;
}

const issue = await github(`/repos/${owner}/${repo}/issues/${issueNumber}`);
const body = issue.body || "";
const data = parse(body);
const services = (data.groups || []).flatMap((group) => group.services || []);
const web = services.find((service) => service.id === "web");
if (!web) throw new Error("Status payload has no web service.");

const [health, version] = await Promise.all([
  safeJson("https://gapwise.ca/api/health"),
  safeJson("https://gapwise.ca/api/version"),
]);

const details = [];
if (typeof web.detail === "string" && web.detail.trim()) details.push(web.detail.split(" · ")[0]);
if (health && (health.status === "operational" || health.status === "degraded")) {
  details.push(`health ${health.status}`);
}
if (version && typeof version.revision === "string" && /^[a-f0-9]{7,12}$/i.test(version.revision)) {
  details.push(`rev ${version.revision}`);
  web.revision = version.revision;
}
if (version && typeof version.environment === "string" && version.environment.length <= 32) {
  web.environment = version.environment;
}
if (details.length > 0) web.detail = details.join(" · ");
web.healthCheckedAt = typeof health?.checkedAt === "string" ? health.checkedAt : null;

await github(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body: render(body, data) }),
});

console.log(JSON.stringify({
  service: "web",
  health: health?.status ?? "unavailable",
  revision: web.revision ?? null,
  environment: web.environment ?? null,
}, null, 2));
