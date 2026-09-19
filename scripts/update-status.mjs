const [owner, repo] = String(process.env.GITHUB_REPOSITORY || "Gapwise-for-UofT/status").split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must be in owner/repo form.");
const issueNumber = Number(process.env.STATUS_ISSUE_NUMBER || "1");
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;

if (!token) throw new Error("GH_TOKEN or GITHUB_TOKEN is required to publish status data.");

const STATUS_MARKER_START = "<!-- GAPWISE_STATUS_JSON_START -->";
const STATUS_MARKER_END = "<!-- GAPWISE_STATUS_JSON_END -->";
const EVENT_MARKER_START = "<!-- GAPWISE_STATUS_EVENT_START -->";
const EVENT_MARKER_END = "<!-- GAPWISE_STATUS_EVENT_END -->";

const automaticChecks = new Map([
  ["web", { url: "https://gapwise.ca/", expected: (status) => status >= 200 && status < 400 }],
  ["public-api", { url: "https://api.gapwise.ca/v1", expected: (status) => status >= 200 && status < 300 }],
  ["ai-health", { url: "https://ai.gapwise.ca/api/health", expected: (status) => status >= 200 && status < 300 }],
  ["data", { url: "https://data.gapwise.ca/", expected: (status) => status >= 200 && status < 400 }],
  ["docs", { url: "https://docs.gapwise.ca/", expected: (status) => status >= 200 && status < 400 }],
]);

const canonicalAutomaticServices = [
  {
    groupId: "data",
    groupName: "Open data",
    service: {
      id: "data",
      name: "Gapwise Data",
      url: "https://data.gapwise.ca/",
      status: "unknown",
      monitoring: "automatic",
      checkedAt: null,
      detail: "Awaiting first automatic probe",
    },
  },
];

const githubHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "gapwise-status-monitor",
};

async function github(path, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: { ...githubHeaders, ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  if (response.status === 204) return null;
  return response.json();
}

function extractPayload(body) {
  const start = body.indexOf(STATUS_MARKER_START);
  const end = body.indexOf(STATUS_MARKER_END);
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Status issue is missing the machine-readable JSON markers.");
  }
  return JSON.parse(body.slice(start + STATUS_MARKER_START.length, end).trim());
}

function flattenServices(data) {
  return new Map((data.groups || []).flatMap((group) =>
    (group.services || []).map((service) => [service.id, service]),
  ));
}

function ensureCanonicalServices(data) {
  if (!Array.isArray(data.groups)) data.groups = [];
  for (const definition of canonicalAutomaticServices) {
    let group = data.groups.find((candidate) => candidate.id === definition.groupId);
    if (!group) {
      group = { id: definition.groupId, name: definition.groupName, services: [] };
      data.groups.push(group);
    }
    if (!Array.isArray(group.services)) group.services = [];
    let service = group.services.find((candidate) => candidate.id === definition.service.id);
    if (!service) {
      group.services.push(structuredClone(definition.service));
      continue;
    }
    service.name = definition.service.name;
    service.url = definition.service.url;
    service.monitoring = "automatic";
    if (!new Set(["operational", "degraded", "outage", "unknown"]).has(service.status)) service.status = "unknown";
    if (!("checkedAt" in service)) service.checkedAt = null;
  }
}

async function oneProbe(url, expected) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "*/*", "User-Agent": "GapwiseStatusMonitor/1.0 (+https://status.gapwise.ca)" },
    });
    return {
      ok: expected(response.status),
      statusCode: response.status,
      durationMs: Math.round(performance.now() - started),
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: null,
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function probeService(check) {
  const attempts = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    attempts.push(await oneProbe(check.url, check.expected));
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  const successes = attempts.filter((attempt) => attempt.ok).length;
  const latest = attempts.at(-1);
  const status = successes === 3 ? "operational" : successes > 0 ? "degraded" : "outage";
  let detail;
  if (status === "operational") detail = latest?.statusCode ? `HTTP ${latest.statusCode}` : "Probe passed";
  else if (status === "degraded") detail = `${successes}/3 probes passed`;
  else detail = latest?.statusCode ? `HTTP ${latest.statusCode}; 0/3 probes passed` : "0/3 probes passed";
  return { status, detail };
}

function singleServiceSummary(service, status) {
  if (service.monitoring === "manual") {
    if (status === "outage") return `${service.name} is marked unavailable by the Gapwise operator.`;
    if (status === "degraded") return `${service.name} is marked degraded by the Gapwise operator.`;
    return `${service.name} has not been confirmed by the Gapwise operator.`;
  }
  if (status === "outage") return `${service.name} did not pass the latest production checks.`;
  if (status === "degraded") return `${service.name} returned intermittent results in the latest check.`;
  return `${service.name} could not be determined in the latest production check.`;
}

function multiServiceSummary(services, status) {
  const manualCount = services.filter((service) => service.monitoring === "manual").length;
  const automaticCount = services.length - manualCount;
  if (manualCount > 0 && automaticCount > 0) {
    if (status === "outage") return `${services.length} services are unavailable or failing production checks.`;
    if (status === "degraded") return `${services.length} services are degraded or returning intermittent production results.`;
    return `${services.length} service states are currently unconfirmed.`;
  }
  if (manualCount === services.length) {
    if (status === "outage") return `${services.length} operator-maintained services are marked unavailable.`;
    if (status === "degraded") return `${services.length} operator-maintained services are marked degraded.`;
    return `${services.length} operator-maintained service states are not confirmed.`;
  }
  if (status === "outage") return `${services.length} services did not pass the latest production checks.`;
  if (status === "degraded") return `${services.length} services returned intermittent results in the latest check.`;
  return `${services.length} service states could not be determined in the latest production checks.`;
}

function summaryFor(data) {
  const services = Array.from(flattenServices(data).values());
  for (const status of ["outage", "degraded", "unknown"]) {
    const affected = services.filter((service) => service.status === status);
    if (affected.length === 0) continue;
    return {
      status,
      message: affected.length === 1
        ? singleServiceSummary(affected[0], status)
        : multiServiceSummary(affected, status),
    };
  }
  return {
    status: "operational",
    message: "All automatically checked Gapwise services passed the latest scheduled probes.",
  };
}

function statusIssueBody(data) {
  return `This issue is a machine-managed public data source for \`status.gapwise.ca\`.

The scheduled status workflow runs every 15 minutes and updates automatic checks, while the operator workflow updates operator-maintained services. Status-history transitions are recorded as comments. Do not use this issue for vulnerability reports or support requests.

${STATUS_MARKER_START}
${JSON.stringify(data, null, 2)}
${STATUS_MARKER_END}`;
}

function transitionMessage(service, from, to) {
  if (to === "operational") return `${service.name} passed all three probes in the latest scheduled check and is marked operational again.`;
  if (to === "degraded") return `${service.name} returned inconsistent probe results and is marked degraded.`;
  if (to === "outage") return `${service.name} failed all three probes in the latest scheduled check and is marked unavailable.`;
  return `${service.name} changed from ${from} to ${to}.`;
}

async function publishTransition(service, from, to, at) {
  const event = {
    version: 1,
    at,
    serviceId: service.id,
    serviceName: service.name,
    from,
    to,
    source: "automatic",
    message: transitionMessage(service, from, to),
  };
  const body = `${EVENT_MARKER_START}\n${JSON.stringify(event, null, 2)}\n${EVENT_MARKER_END}`;
  await github(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
}

const issue = await github(`/repos/${owner}/${repo}/issues/${issueNumber}`);
const previous = extractPayload(issue.body || "");
const previousServices = flattenServices(previous);
const now = new Date().toISOString();
const next = structuredClone(previous);
next.version = 1;
next.generatedAt = now;
ensureCanonicalServices(next);

for (const group of next.groups || []) {
  for (const service of group.services || []) {
    if (service.monitoring !== "automatic") continue;
    const check = automaticChecks.get(service.id);
    if (!check) {
      service.status = "unknown";
      service.detail = "No automated probe is configured";
      service.checkedAt = now;
      continue;
    }
    const result = await probeService(check);
    service.url = check.url;
    service.status = result.status;
    service.detail = result.detail;
    service.checkedAt = now;
  }
}

next.summary = summaryFor(next);

await github(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body: statusIssueBody(next) }),
});

if (previous.generatedAt) {
  const nextServices = flattenServices(next);
  for (const [id, service] of nextServices) {
    const before = previousServices.get(id);
    if (!before || before.status === service.status) continue;
    await publishTransition(service, before.status || "unknown", service.status || "unknown", now);
  }
}

console.log(JSON.stringify({
  generatedAt: now,
  summary: next.summary,
  services: Array.from(flattenServices(next).values()).map((service) => ({
    id: service.id,
    status: service.status,
    monitoring: service.monitoring,
    checkedAt: service.checkedAt || null,
    detail: service.detail || null,
  })),
}, null, 2));
