# Campus data ownership

Canonical public University of Toronto campus facts and geometry live in `GapwiseHQ/data`. UTM's reviewed entrance/routing dataset lives under `data/utm`; UTSG and UTSC identities and geometry live in their own campus directories.

`gapwise` consumes a validated build-time snapshot and owns deterministic routing, gap-planning, API, SDK, and product behavior. `status` remains an operationally independent service-health and incident-communication surface; it does not own or consume raw campus data as an application dependency.

## Rules for this repository

- Do not copy building, entrance, footprint, or routing-graph facts here.
- Status checks may observe the availability/health of public Gapwise surfaces, including the data portal, without becoming dependent on raw campus data.
- An outage of `data.gapwise.ca` must not be represented as proof that core routing is unavailable; the core product uses a vendored build-time campus snapshot.
- Campus fact changes belong in `data`; calculation/API behavior belongs in `gapwise`; health/incident behavior belongs here.

The machine-readable ecosystem contract in `gapwise.ecosystem.json` records the same ownership boundary.
