<!-- last_verified: 2026-06-30 -->
# Feature: Dashboard

## Purpose
Provide an at-a-glance overview of tracking-dataset-builder activity on B2.

## Used By
- UI: `/` page (dashboard home)
- API: `GET /datasets/stats`, `GET /datasets`

## Core Functions
- `apps/web/src/components/dashboard/dataset-stats-cards.tsx` — metric cards
- `apps/web/src/components/dashboard/recent-builds-table.tsx` — recent datasets
- `apps/web/src/components/dashboard/upload-chart.tsx` — "Tracks per dataset" bar chart
- `apps/web/src/lib/api-client.ts` — `getDatasetStats()`, `getDatasets()`
- `services/api/app/runtime/datasets.py` — `GET /datasets/stats` handler
- `services/api/app/service/datasets.py` — `get_dashboard_stats()` business logic

## Canonical Files
- Dashboard metric cards: `apps/web/src/components/dashboard/dataset-stats-cards.tsx`
- Stats service logic: `services/api/app/service/datasets.py`

## Inputs
- None (dashboard loads data automatically)

## Outputs
- `GET /datasets/stats` → `DatasetStatsSummary` (`footage_ingested`, `datasets_built`, `total_tracks`, `total_clips`, `total_releases`, `storage_used_human`)
- `GET /datasets` → `DatasetSummary[]` for the recent-builds table and the tracks-per-dataset chart (newest-first)

## Flow
- Page loads → parallel API calls (dataset stats, dataset list)
- Metric cards display footage ingested, datasets built, object tracks, total clips, MOT releases, and B2 storage used
- The bar chart shows tracks extracted per dataset
- Recent builds table shows the latest datasets with name, source, tracks, created, status

## Edge Cases
- API unavailable → inline error state with retry
- No datasets → empty chart/table messages
- Large object count → stats endpoints paginate using `ContinuationToken`

## UX States
- Loading: skeleton placeholders for cards and table
- Empty: "No datasets yet" / "No builds yet"
- Loaded: populated cards, chart, table

## Verification
- Test files: `services/api/tests/test_datasets.py` (`test_dashboard_stats_rollup`)
- Required cases: stats rollup with a built dataset, empty state
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all pytest tests green, no ruff violations

## Related Docs
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [App Workflows](../app-workflows.md)
