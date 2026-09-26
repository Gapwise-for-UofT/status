const [owner, repo] = String(process.env.GITHUB_REPOSITORY || "GapwiseHQ/status").split("/");
if (!owner || !repo) throw new Error("GITHUB_REPOSITORY must be in owner/repo form.");
const issueNumber = Number(process.env.STATUS_ISSUE_NUMBER || "1");
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const serviceId = String(process.env.STATUS_SERVICE_ID || "").trim();
const requestedStatus = String(process.env.STATUS_VALUE || "").trim();
const operatorMessage = String(process.env.STATUS_MESSAGE || "").trim();
const actor = String(process.env.GITHUB_ACTOR || "Gapwise operator").trim();

if (!token) throw new Error("GH_TOKEN or GITHUB_TOKEN is required to publish status data.");
if (!serviceId) throw new Error("STATUS_SERVICE_ID is required.");

const allowedStatuses = new Set(["operational", "degraded", "outage", "unknown"]);
if (!allowedStatuses.has(requestedStatus)) {
  throw new Error(`STATUS_VALUE must be one of ${Array.from(allowedStatuses).join(", ")}.`);
}

const STATUS_MARKER_START = "<!-- GAPWISE_STATUS_JSON_START -->";
const STATUS_MARKER_END = "<!-- GAPWISE_STATUS_JSON_END -->";
const EVENT_MARKER_START = "<!-- GAPWISE_STATUS_EVENT_START -->";
const EVENT_MARKER_END = "<!-- GAPWISE_STATUS_EVENT_END -->";

const githubHeaders = {
  Accept: "application/vnd.github+json",
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": "2022-11-28",
  "User-Agent": "gapwise-status-operator",
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

function defaultDetail(status) {
  if (status === "operational") return "Operator confirmed";
  if (status === "degraded") return "Operator reported degraded service";
  if (status === "outage") return "Operator reported service unavailable";
  return "Awaiting operator confirmation";
}

function transitionMessage(service, from, to) {
  if (operatorMessage) return operatorMessage;
  if (to === "operational") return `${service.name} was marked operational by the Gapwise operator.`;
  if (to === "degraded") return `${service.name} was marked degraded by the Gapwise operator.`;
  if (to === "outage") return `${service.name} was marked unavailable by the Gapwise operator.`;
  return `${service.name} was changed from ${from} to unknown by the Gapwise operator.`;
}

async function publishTransition(service, from, to, at) {
  const event = {
    version: 1,
    at,
    serviceId: service.id,
    serviceName: service.name,
    from,
    to,
    source: "operator",
    actor,
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
const next = structuredClone(previous);
const now = new Date().toISOString();
const service = flattenServices(next).get(serviceId);

if (!service) throw new Error(`Unknown status service: ${serviceId}`);
if (service.monitoring !== "manual") {
  throw new Error(`${service.name} is automatically monitored and cannot be changed manually.`);
}

const previousStatus = service.status || "unknown";
service.status = requestedStatus;
service.checkedAt = now;
service.detail = operatorMessage || defaultDetail(requestedStatus);
next.summary = summaryFor(next);

await github(`/repos/${owner}/${repo}/issues/${issueNumber}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ body: statusIssueBody(next) }),
});

if (previousStatus !== requestedStatus) {
  await publishTransition(service, previousStatus, requestedStatus, now);
}

console.log(JSON.stringify({
  serviceId: service.id,
  serviceName: service.name,
  from: previousStatus,
  to: requestedStatus,
  checkedAt: now,
  historyEventPublished: previousStatus !== requestedStatus,
  summary: next.summary,
}, null, 2));
