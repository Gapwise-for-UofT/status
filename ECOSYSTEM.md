# Gapwise ecosystem integration

`status` is the independently deployed operational-health and incident-communication surface for the seven-repository Gapwise product ecosystem. It observes availability; it does not own product semantics, package contracts, data truth, or release definitions.

## Surfaces in scope

- Main product: `https://gapwise.ca`
- Public API: `https://api.gapwise.ca/v1`
- OpenAPI: `https://api.gapwise.ca/openapi.json`
- Data/provenance: `https://data.gapwise.ca`
- Developer docs: `https://docs.gapwise.ca`
- AI service: `https://ai.gapwise.ca`
- Core source/API/SDKs: `Gapwise-for-UofT/gapwise`
- Native Android: `Gapwise-for-UofT/android`
- Native iOS: `Gapwise-for-UofT/ios`
- AI/MCP source: `Gapwise-for-UofT/ai`
- Canonical data source: `Gapwise-for-UofT/data`
- Documentation source: `Gapwise-for-UofT/docs`
- Status source: `Gapwise-for-UofT/status`

## Current developer-platform release facts

- TypeScript `@gapwise/sdk@0.1.1` is canonically published on both npm and JSR with provenance through trusted GitHub Actions publishing.
- The same JavaScript/TypeScript SDK is mirrored publicly on GitHub Packages as `@gapwise-for-uoft/sdk@0.1.1`; the organization-scoped name is required by GitHub Packages and does not replace the canonical npm/JSR identity.
- Node, Bun, and Deno are runtime targets for the same TypeScript implementation, not separately monitored SDK products.
- Python `gapwise==0.1.0` is published on PyPI through Trusted Publishing.
- TypeScript and Python are equal first-party SDK implementations of the same public API v1 semantics.

Registry publication is release metadata, not service health. Native repository/build/app-store state is also release metadata unless a meaningful health contract can be probed. Availability reporting should focus on public endpoints and operator-confirmable service state.

## Status-specific rules

1. A failed probe is evidence about that probe/surface, not proof that the entire Gapwise ecosystem is down.
2. Stale automation becomes `unknown` / monitoring delayed rather than silently remaining healthy.
3. Operator incidents remain visible when automated data is stale.
4. Third-party University/provider outages are distinguished from Gapwise-owned failures where evidence permits.
5. Package registry existence, Android/iOS release state, and docs claims are sourced from their owning release systems and are not inferred from HTTP uptime.
6. New public first-party services should trigger explicit review of monitoring coverage rather than being silently omitted.
7. Renames/deprecations in the core API, docs, data, AI, Android, or iOS surfaces must be reflected here without creating alternate canonical URLs.

## Change impact

When monitoring changes, check:

- `gapwise` for canonical production endpoints and API behavior;
- `docs` for public operations guidance;
- `data` for data-surface endpoints;
- `ai` for health/MCP endpoints and privacy-safe observability;
- `android` only for Android-specific dependencies that have meaningful public/operator health signals;
- `ios` only for iOS-specific dependencies that have meaningful public/operator health signals.

Status is intentionally independent in deployment and deliberately dependent on the rest of the ecosystem for the meaning of what it monitors.
