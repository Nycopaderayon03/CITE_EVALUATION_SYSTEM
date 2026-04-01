# College Evaluation System (CITE-ES)

A full-stack college evaluation management system built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, and **MySQL**.

## Features

- **Multi-role system** — Dean, Teacher, and Student dashboards with role-based access
- **Academic period management** — Semesters with automatic transition handling (cascade close/lock)
- **Evaluation periods** — Draft → Active → Closed lifecycle with date-enforced submission windows
- **Multi-group evaluation setup** — Assign multiple programs/year levels per evaluation period
- **Dynamic evaluation forms** — JSON-based criteria and questions (student-to-teacher & peer-review)
- **Peer-to-peer evaluations** — Pairwise teacher evaluations with anonymous results
- **Ghost evaluations** — Dean can submit anonymous evaluations that blend into regular results
- **Just-in-time sync** — Late registrants automatically receive evaluation assignments on dashboard load
- **Real-time analytics** — Per-teacher performance trends, criteria breakdowns, top instructors
- **Anonymous feedback** — Student/peer comments displayed without author identity

---

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
Create `.env.local`:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=cite_es
JWT_SECRET=your_secret_here
```

### 3. Set up database
Requires MySQL (XAMPP recommended).
```bash
npm run db:init       # Creates tables + seeds sample data
```

### 4. Start dev server
```bash
npm run dev
```
Open **http://localhost:3000**

### Test credentials
| Role | Email | Password |
|------|-------|----------|
| Dean | janette@jmc.edu.ph | admin123 |
| Teacher | ryan@jmc.edu.ph | teacher123 |
| Student | ruby@jmc.edu.ph | student123 |

---

## Project Structure

```
app/
  api/                        # Backend API routes
    academic_periods/           # Academic year/semester CRUD
    analytics/                  # Role-filtered dashboard metrics
    auth/                       # Login, signup, logout, token verify
    comments/                   # Anonymous feedback CRUD
    courses/                    # Course assignment management
    criteria/                   # Public criteria endpoint
    evaluation_periods/         # Evaluation window CRUD
    evaluations/                # Evaluation CRUD + bulk generation
      ghost/                    # Dean ghost evaluation creation
      sync/                     # JIT evaluation sync for late registrants
    forms/                      # Evaluation form template CRUD
    users/                      # User profile management
  dean/                       # Dean pages
    academic/                   # Academic period management
    evaluation-setup/           # Create/edit evaluation periods (multi-group)
    evaluations/                # Monitor evaluations, ghost evaluate, row actions
      fill/[id]/                # Ghost evaluation form filler
    dashboard/                  # Dean analytics dashboard
    forms/                      # Form builder
    users/                      # User management
    reports/                    # Report generation
  student/                    # Student pages
    dashboard/                  # Pending evals, deadlines, completion rate
    evaluations/                # Fill out evaluations (stepper form)
    history/                    # Past evaluation history
  teacher/                    # Teacher pages
    dashboard/                  # Ratings, feedback, analytics
    peer/                       # Peer-to-peer evaluation form
    results/                    # View received evaluations
    classes/                    # Teaching assignments
components/
  ui/                         # Reusable UI components (Card, Button, Modal, etc.)
  RatingScale.tsx               # 1-5 star rating input
  FormStepper.tsx               # Multi-step form navigation
lib/
  db.ts                       # MySQL pool (globalThis cached for HMR safety)
  auth.ts                     # JWT sign/verify helpers
hooks/
  index.ts                    # useFetch, useDebounce, usePaginatedData, etc.
database/
  schema.sql                  # Table definitions (13 tables)
  cite_es.sql                 # Seed data
tools/                        # CLI utilities
data/
  curriculum.ts               # Program/subject definitions (BSIT, BSEMC)
```

---

## Database Scripts

| Command | Description |
|---------|-------------|
| `npm run db:init` | Create tables + seed sample data |
| `npm run db:migrate` | Create tables from `database/schema.sql` |
| `npm run db:seed` | Populate sample data from `database/cite_es.sql` |
| `npm run db:truncate` | Wipe all data, keep schema intact |
| `npm run db:reset` | Drop all tables (destructive) |
| `npm run db:admin` | Create default admin account |
| `npm run db:fix` | Apply incremental schema patches |

```bash
# Wipe data and re-seed (no schema rebuild)
npm run db:truncate && npm run db:seed

# Full nuclear reset
npm run db:reset && npm run db:init
```

---

## API Overview

14 route groups, all authenticated via JWT Bearer token (`Authorization: Bearer <token>`).

| Endpoint | Methods | Access |
|----------|---------|--------|
| `/api/auth` | POST | Public |
| `/api/users` | GET, PATCH | Authenticated |
| `/api/academic_periods` | GET, POST, PATCH, DELETE | Dean |
| `/api/evaluation_periods` | GET, POST, PATCH, DELETE | Dean (full), others (active) |
| `/api/evaluations` | GET, POST, PATCH, DELETE | Role-filtered |
| `/api/evaluations/sync` | POST | Student, Teacher |
| `/api/evaluations/ghost` | POST | Dean |
| `/api/forms` | GET, POST, PATCH, DELETE | Dean |
| `/api/analytics` | GET | Role-filtered |
| `/api/comments` | GET, POST, PATCH, DELETE | Authenticated |
| `/api/courses` | GET, PATCH | Role-filtered |
| `/api/criteria` | GET | Public |
| `/api/audit` | GET | Dean |

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for full documentation.

---

## Key Workflows

### Evaluation lifecycle
1. Dean creates an **Academic Period** (semester)
2. Dean creates an **Evaluation Period** with a form, date range, and assignment groups
3. Dean clicks **Start Evaluation** → bulk generates evaluation records for matching students/teachers
4. Students/teachers fill out evaluations within the date window
5. Dean monitors progress, can ghost-evaluate, lock/unlock, or reset evaluations
6. Dean activates a new academic period → old evaluations auto-close and lock

### Late registrant handling
When a student or teacher visits their dashboard, `POST /api/evaluations/sync` runs automatically, creating any missing evaluation assignments based on their program/year/section.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS (dark mode support)
- **Database:** MySQL 5.7+ (mysql2/promise)
- **Auth:** JWT (jsonwebtoken + bcrypt)
- **Icons:** Lucide React
- **Animations:** Framer Motion

---

## Troubleshooting

### "Too many connections" in phpMyAdmin
Next.js hot reloading creates new DB pools on each file save. The pool is cached on `globalThis` to prevent this, but if it happens:
1. Restart MySQL in XAMPP
2. Restart dev server

### Port 3000 busy
Next.js auto-switches to the next available port.

### Stale dev lock
```bash
rm -rf .next/dev/lock
```

---

## Documentation

- [Database Guide](docs/DATABASE.md) — Setup, scripts, schema, troubleshooting
- [API Reference](docs/API_REFERENCE.md) — All endpoints with examples
- [Setup Guide](SETUP_GUIDE.md) — Detailed installation and configuration
- [Login Credentials](docs/LOGIN_CREDENTIALS.md) — Test accounts
# Rubygrace
