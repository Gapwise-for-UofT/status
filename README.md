<div align="center">

<img src="public/logo-mark-green.svg" width="116" alt="Gapwise Status deer mark" />

# Gapwise Status

### Independent service health for the Gapwise ecosystem.

**The public monitoring and incident-communication surface for Gapwise applications, APIs, AI, data, documentation, and selected operator-maintained systems.**

[![Live Status](https://img.shields.io/badge/Live_Status-status.gapwise.ca-36C692?style=for-the-badge&logo=vercel&logoColor=white)](https://status.gapwise.ca)
[![Monitoring](https://img.shields.io/badge/Monitoring-Every_15_Min-36C692?style=for-the-badge)](https://status.gapwise.ca)

<sub>Astro · GitHub Actions · Vercel</sub>

<br />

**[Gapwise](https://gapwise.ca)** · **[Android](https://github.com/Gapwise-for-UofT/android)** · **[iOS](https://github.com/Gapwise-for-UofT/ios)** · **[AI](https://ai.gapwise.ca)** · **[Data](https://data.gapwise.ca)** · **[Docs](https://docs.gapwise.ca)** · **[Status](https://status.gapwise.ca)** · **[History](https://status.gapwise.ca/history/)**

</div>

---

## What Gapwise Status is

Gapwise Status is the independent operational-health surface for **Gapwise**, a privacy-first timetable and campus-intelligence platform for University of Toronto students created and engineered by **Andrew Muratov**.

The seven first-party product repositories cover the web/PWA and developer platform, native Android and iOS clients, permissioned AI/MCP, canonical University of Toronto campus data, developer documentation, and this separately deployed status service.

Status is deliberately deployed independently from the main app and developer docs so a failure in those surfaces does not automatically remove the place used to communicate service health.

Canonical production URL:

```text
https://status.gapwise.ca
```

The site communicates the latest known state of Gapwise-owned production surfaces and selected operator-maintained services. It is not a contractual SLA and does not claim continuous third-party synthetic monitoring of every dependency.

---

## Monitoring model

Gapwise separates automated probes from services that require operator confirmation.

Automated checks cover safely observable public production surfaces such as the main application, public API, AI service, Data portal, and developer documentation. Operator-maintained state is used when real health requires private-session, app-store, device, or provider-side evidence that cannot be verified safely through a public HTTP probe alone.

Key behavior:

- automatic public-surface checks run every 15 minutes and are serialized to avoid competing publishers;
- stale monitoring data becomes visibly **unknown / monitoring delayed** rather than silently remaining green;
- operator-reported incidents remain visible when automation is stale;
- service-state transitions are retained for the public history view;
- current state and history use GitHub-backed state with safe fallbacks;
- a failure to load status data is not itself presented as proof that the entire Gapwise ecosystem is down;
- external University of Toronto systems and other upstream dependencies remain outside Gapwise's control.

Public routes include `/` for current state, `/history/` for recorded transitions/incidents, `/_data/current`, and `/_data/history`.

Native Android/iOS repository existence, build state, or app-store release state is **release metadata**, not an HTTP uptime signal. Mobile distribution should only appear as operational status when a meaningful and safely verifiable health contract exists.

---

## Current developer-platform state

Gapwise's public developer surface is versioned at `https://api.gapwise.ca/v1` with an OpenAPI 3.1 contract at `https://api.gapwise.ca/openapi.json`.

Current first-party SDK releases:

```bash
npm install @gapwise/sdk@0.1.1
# JSR: @gapwise/sdk@0.1.1
# GitHub Packages mirror: @gapwise-for-uoft/sdk@0.1.1
python -m pip install gapwise==0.1.0
```

The JavaScript/TypeScript SDK is canonically published as `@gapwise/sdk` on npm and JSR and mirrored on GitHub Packages as `@gapwise-for-uoft/sdk`; the Python SDK is published on PyPI. Registry availability is a developer-platform release fact, not a substitute for live API/service monitoring.

---

## Gapwise ecosystem

| Repository | Role | Primary surface |
| --- | --- | --- |
| **[`gapwise`](https://github.com/Gapwise-for-UofT/gapwise)** | Core web/PWA, canonical timetable/gap/routing semantics, public API, OpenAPI, and SDK source | [gapwise.ca](https://gapwise.ca) / [api.gapwise.ca](https://api.gapwise.ca/v1) |
| **[`android`](https://github.com/Gapwise-for-UofT/android)** | Native Kotlin + Jetpack Compose Android client | Android app |
| **[`ios`](https://github.com/Gapwise-for-UofT/ios)** | Native Swift + SwiftUI iOS client | iOS app |
| **[`ai`](https://github.com/Gapwise-for-UofT/ai)** | OAuth/MCP layer for explicitly delegated student context and bounded actions | [ai.gapwise.ca](https://ai.gapwise.ca) |
| **[`data`](https://github.com/Gapwise-for-UofT/data)** | Canonical public University of Toronto campus data, provenance, schemas, validation, and distribution | [data.gapwise.ca](https://data.gapwise.ca) |
| **[`docs`](https://github.com/Gapwise-for-UofT/docs)** | Canonical public developer documentation | [docs.gapwise.ca](https://docs.gapwise.ca) |
| **[`status`](https://github.com/Gapwise-for-UofT/status)** | **Independent service-health monitoring and incident communication** | [status.gapwise.ca](https://status.gapwise.ca) |

`status` owns operational communication, not product semantics. The main `gapwise` repository remains authoritative for deterministic timetable, routing, gap, public API, SDK, and student-state behavior; `data` owns public University of Toronto campus facts.

---

## Local development

Requires Node.js 22 or newer.

```bash
git clone https://github.com/Gapwise-for-UofT/status.git
cd status
npm ci
npm run check
npm run build
npm run dev
```

`main` is the production status branch and deploys through the dedicated Gapwise Status Vercel project. `status.gapwise.ca` is independent from the `gapwise` and `docs` deployments.

---

## Independent project

> **Gapwise is an independent student software project created by Andrew Muratov. It is not affiliated with, endorsed by, or an official service of the University of Toronto.**

Original status-site code and documentation are available under the [MIT License](LICENSE).

<div align="center">

**Health should be observable without becoming another source of truth.**

[View Gapwise Status →](https://status.gapwise.ca)

</div>
