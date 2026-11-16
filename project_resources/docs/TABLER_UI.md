# Tabler UI integration

BSCIAMS uses the official **Tabler** admin UI as the visual foundation.

- Website: https://tabler.io/
- Package CDN: `@tabler/core@1.7.5` (jsDelivr)

## Theme (government information system)

| Token | Value |
|---|---|
| Primary | `#24476B` deep blue |
| Secondary / accent | `#2A9D8F` calm teal |
| Background | `#F4F7FB` workspace |
| Surfaces | `#FFFFFF` |
| Pale surfaces | `#EAF0F8` / `#E8F3F1` |
| Text | `#25364A` / muted `#64748B` |
| Border | `#E2E8F0` |
| Font | Inter / system sans-serif |
| Sidebar | Deep blue navigation with teal active state |

Theme overrides: `css/tabler-theme.css`  
Shared shell tokens: `css/Global.css`  
Dashboard layouts: `css/Dashboard.css`

## Role dashboards

| Role | Home route | Focus |
|---|---|---|
| Administrator | `/AdminDashboard` | Accounts, security, audit, backups, oversight |
| Barangay Staff | `/Dashboard` | Registry, assistance, documents, programs |
| Health Worker | `/HealthDashboard` | Profiles, assessments, vitals, visits, referrals |

Navigation remains role-filtered. PostgreSQL remains the single source of truth for all tables and dashboards.
