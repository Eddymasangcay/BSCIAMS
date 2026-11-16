# Tabler UI integration

BSCIAMS uses the official **Tabler** admin UI as the visual foundation.

- Website: https://tabler.io/
- Package CDN: `@tabler/core@1.7.5` (jsDelivr)

## Theme (government information system)

| Token | Value |
|---|---|
| Primary | `#183153` deep navy |
| Secondary | `#426B91` muted blue |
| Background | `#F5F7FA` soft gray |
| Surfaces | `#FFFFFF` |
| Font | Inter / system sans-serif |
| Sidebar | Dark navy navigation |

Theme overrides: `css/tabler-theme.css`  
Existing shell styles retained in `css/Global.css` with navy tokens.

## Workspaces

Navigation remains role-filtered (Administrator / Barangay Staff / Health Worker). Tabler styles the shell; PostgreSQL remains the single source of truth for all tables and dashboards.
