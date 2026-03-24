# AGENTS.md — Multi-Agent Coordination

> Shared workspace for AI agents collaborating on this project. Read before starting work, log what you change, keep each other informed.

---

## Registered Agents

Add yourself when you start work. Update status as you go.

| Agent ID | Slice | Status | Files Changed | Last Updated |
|----------|-------|--------|---------------|--------------|
| claude-opus | Pre-slice + Slice 1 + Slice 3 + Eval Setup Overhaul | Complete | see Communication Log | 2026-03-18 |
| copilot | Enrollment Feature | Planning | `agents/copilot/PLAN.md`, `database/schema.sql` | 2026-03-18 |
| antigravity | Slice 3 | Complete | `app/teacher/layout.tsx`, `app/dean/reports/page.tsx`, `app/globals.css`, `app/dean/dashboard/page.tsx`, `app/dean/forms/page.tsx` | 2026-03-22 |

---

## File Ownership

Files are loosely mapped to slices. If you need to touch a file outside your slice, **log it in the Communication Log** so other agents know — don't wait for permission, just communicate.

### Slice File Map

| Slice | Primary Files |
|-------|---------------|
| Pre-slice (Data Fix) | `database/schema.sql`, `app/api/courses/route.ts`, `tools/seed.js` |
| Slice 1 (Admin Setup) | `app/dean/evaluation-setup/page.tsx`, `app/dean/dashboard/page.tsx` |
| Slice 2 (Student Flow) | `app/student/evaluations/page.tsx`, `app/student/dashboard/page.tsx`, `app/student/history/page.tsx` |
| Slice 3 (Teacher Flow) | `app/teacher/dashboard/page.tsx`, `app/teacher/peer/page.tsx`, `app/teacher/results/page.tsx` |

### Shared Files — Coordinate Before Changing

These files are used across slices. You can edit them if needed, but **log what you changed and why** so other agents don't get surprised.

- `lib/db.ts` — DB connection pool. Stable, unlikely to need changes.
- `hooks/index.ts` — `useFetch` hook. Stable, unlikely to need changes.
- `app/api/*` — API routes. Can be modified to fix bugs or add fields — log changes.
- `components/ui/*` — UI component library. Add new components if needed, log them.
- `database/schema.sql` — Schema definition. Can be updated when the live DB schema changes — keep it aligned with `cite_es.sql`.

---

## Communication Log

Log your changes here so other agents have context. Most recent at the bottom.

### claude-opus — 2026-03-17
**To**: All
**Topic**: Pre-slice data consolidation + Slice 1 complete

**Pre-slice (Data Fix):**
- `database/schema.sql` — Aligned `courses` table with `cite_es.sql` (INT ids, `teacher_id` instead of `instructor_id`, added `course_program`/`year_level` columns). Aligned `course_enrollments` similarly.
- `app/api/courses/route.ts` — Fixed student query: `instructor_id` → `teacher_id`. Added `course_program`/`year_level` to dean query and response formatter. Fixed bug where course name was used as fallback for instructor name.
- `tools/seed.js` — Added ALTER TABLE to ensure `course_program`/`year_level` columns exist, updated course INSERTs with program and year data.
- Deleted dead files: `database/subjects.sql` (never imported), `app/api/subjects/route.ts` (queried non-existent table), `tools/import_sql.js` (referenced non-existent file).

**Slice 1 (Admin Eval Setup):**
- `app/dean/evaluation-setup/page.tsx` — Removed stray JSX block (build error). Replaced hardcoded instructor list with `useFetch('/users')` filtered to teachers. Replaced hardcoded subjects with `useFetch('/courses')` filtered by program/year/semester. Wired `saveSetup()` to POST `/api/forms` + POST `/api/evaluation_periods`. Wired `startEvaluation()` to PATCH period active + POST generate evaluations. Added `fetchApi` helper for authenticated mutations.
- `app/dean/dashboard/page.tsx` — Fixed "Create One" button route: `/dean/academic` → `/dean/evaluation-setup`.

**Gotchas for other agents:**
- Auth token key is `sessionStorage.getItem('auth_token')`, NOT `'token'`.
- The `courses` table uses `teacher_id` (not `instructor_id`). The API response includes both as `teacher_id` and `instructor_id` for compatibility.
- Courses now have `course_program` (ENUM: BSIT/BSEMC) and `year_level` (INT) fields.

### copilot — 2026-03-18
**To**: All
**Topic**: Database Tooling Update

**New Features:**
- `tools/create-admin.js` — Script to seed a default admin account (`admin@cite.edu` / `admin`).
- `package.json` — Added `npm run db:admin` command.

**Usage:**
- Run `npm run db:admin` to create the admin user if it doesn't exist.
- Password is stored in **plain text** (as requested).

### copilot — 2026-03-17
**To**: All
**Topic**: Slice 1 Clean-up & Slice 2 (Student Flow) Complete

**Slice 1 Fixes:**
- `app/dean/evaluation-setup/page.tsx`: Removed misplaced "Anonymous Student Feedback" section (copy-paste error) and unused handler functions. Verified syntax.

**Database Schema Update:**
- `database/schema.sql`: Changed `evaluation_responses.criteria_id` from `INT` to `VARCHAR(36)` and removed FK constraint to `evaluation_criteria`. This was necessary because evaluation forms now use JSON-based criteria with UUIDs.
- Ran migration script to apply this change to the local DB.

**Slice 2 (Student Flow):**
- `app/student/evaluations/page.tsx`:
  - Implemented fetching of active evaluation period and linked form.
  - Added dynamic form rendering based on the JSON form definition (supports criteria sections + questions).
  - Implemented submission logic using the new schema structure.
- `app/student/dashboard/page.tsx`:
  - Updated to fetch live data from `/evaluations` and `/evaluation_periods`.
  - Replaced dummy analytics with real pending/completed counts.
  - Fixed "Start Evaluation" links.
- `app/student/history/page.tsx`:
  - Updated to display submitted evaluations correctly.
  - Fixed status check (`status === 'locked'` instead of `isLocked`).
- `app/student/profile/page.tsx`:
  - Replaced `<Avatar>` component with a simple initial display (m1).

**API Updates:**
- `app/api/evaluation_periods/route.ts`: Allowed authenticated users (students/teachers) to fetch active periods.
- `app/api/forms/route.ts`: Allowed authenticated users to fetch a specific form by ID.

**Note:**
- `evaluation_responses` table now expects `criteria_id` as a string (UUID). If any other part of the system tries to insert INT, it will work (as string), but be aware of the type change.

### claude-opus — 2026-03-18
**To**: All
**Topic**: Slice 3 (Teacher Feedback & Peer Flow) Complete

**API Changes:**
- `app/api/evaluations/route.ts` — Added `role=evaluatee` query param support for non-dean users. When `?role=evaluatee` is passed, returns evaluations where the user is the evaluatee (received evaluations). Also added `evaluator_id`, `submitted_at`, `created_at`, `evaluatee_department` to the SELECT.

**Slice 3 (Teacher Flow):**
- `app/teacher/dashboard/page.tsx` — Added anonymous student feedback card fetching from `/api/comments?entity_type=evaluation&entity_id={teacherId}`. Added received evaluations fetch via `/api/evaluations?role=evaluatee` for accurate stats (overall rating, satisfaction distribution). Added quick action links to Peer Evaluation and Results pages.
- `app/teacher/peer/page.tsx` — Added `evaluateeId` to PeerEvaluation interface and mapping. On successful peer evaluation submission, now also POSTs an anonymous comment to `/api/comments` for the evaluatee's feedback dashboard.
- `app/student/evaluations/page.tsx` — Added anonymous comment POST to `/api/comments` on successful student evaluation submission, so teachers receive feedback on their dashboard. Added `evaluatee_id` to Evaluation interface.

**Gotchas for other agents:**
- Teacher dashboard now fetches TWO additional endpoints on mount: `/api/comments` and `/api/evaluations?role=evaluatee`.
- Anonymous feedback flows: student submits eval → comment POSTed to `/api/comments` with `entity_type='evaluation'`, `entity_id=teacherId`. Same for peer evaluations.
- The evaluations API now supports `?role=evaluatee` to return evaluations where the user is being evaluated (useful for viewing received scores).

### claude-opus — 2026-03-18 (Eval Setup Overhaul)
**To**: All
**Topic**: Evaluation Setup overhaul + new Evaluation Forms page

**Schema:**
- `database/schema.sql` — Added `draft` to `evaluation_periods.status` enum. Added `academic_year`, `semester`, `assignments_json` columns.

**API:**
- `app/api/evaluation_periods/route.ts` — POST now accepts and stores `academic_year`, `semester`, `assignments_json` fields for draft persistence.

**New Page:**
- `app/dean/forms/page.tsx` — Full Evaluation Forms CRUD page. List view with edit/delete, editor with inline criteria management (name, weight, questions). Validates total weight = 100%. Uses existing `/api/forms` endpoints.

**Evaluation Setup Rewrite:**
- `app/dean/evaluation-setup/page.tsx` — Major overhaul:
  - Subjects now load from `data/curriculum.ts` instead of the courses API (dynamic by program + year + semester)
  - Removed redundant semester dropdown in Section 2 — semester from Section 1 drives subject loading
  - Per-subject instructor dropdown (each subject gets its own instructor) + "Assign All" bulk action
  - Removed inline criteria section — replaced with form picker (dropdown of saved forms from `/api/forms`)
  - Read-only form preview when a form is selected
  - Semi-automatic evaluation name: `{prefix} — {AY} {Semester} ({date range})`
  - Draft management: fetches existing drafts, resume/delete buttons, saves setup as draft with `assignments_json`
  - Start Evaluation: validates all fields, auto-saves if needed, activates period, generates bulk assignments

**Gotchas:**
- `evaluation_periods` now uses `draft` status (not `upcoming`) for draft saves. The ENUM was updated in schema.sql but the live DB may need `ALTER TABLE evaluation_periods MODIFY COLUMN status ENUM('draft','upcoming','active','closed') DEFAULT 'upcoming';`.
- `assignments_json` stores `{program, yearLevel, section, assignments: {subjectCode: instructorId}}` as LONGTEXT JSON.

### gpt-5.1 — 2026-03-18
**To**: All
**Topic**: Teacher portal placeholder cleanup

- `app/teacher/classes/page.tsx` — Removed hardcoded sample stats, schedule, roster, and fake downloads. Kept layout but now only uses live course data where available (student counts) and neutral placeholders for future analytics.
- `app/teacher/dashboard/page.tsx` — Removed fallback teaching-load estimate; total students now derive only from real course enrollment fields.
- `app/teacher/results/page.tsx` — Removed hardcoded per-course student fallback (`35`); totals now use only real enrollment data.

### copilot — 2026-03-18
**To**: All
**Topic**: Student Self-Enrollment Feature Planning

**Plan**:
- **Objective**: Allow students to select Year Level and Section to auto-enroll in block subjects.
- **Schema**: Added `year_level` (INT) and `section` (VARCHAR) to `users` table.
- **Next Steps**: Implement API for profile update + auto-enrollment logic. Update Student Profile UI.
- **Note**: "Irregular" students will initially use this to set their primary block. Future iterations may allow granular subject selection.

### antigravity — 2026-03-20
**To**: All
**Topic**: Removed AI Coach Feature

- `app/teacher/layout.tsx`: Removed the AI Coach navigation tab.
- `app/teacher/ai-coach/`: Deleted the directory and the feature entirely as requested by the user.

### antigravity — 2026-03-20
**To**: All
**Topic**: Dean Dashboard Cleanups

- `app/dean/reports/page.tsx`: Converted report downloads from a faux PDF envelope to true native CSV files by implementing `generateCSVReport`, saving as `.csv`.
- `app/dean/reports/page.tsx`: Removed the "Compliance Report", "Criteria Analysis", and "Custom Report" sections and logic from the view.
- `app/dean/reports/page.tsx`: Removed the unused date picker filter component.
- `app/dean/audit/page.tsx`: Removed the "Export Logs" button and its unneeded file generation handler function.
- `app/teacher/dashboard/page.tsx`: Removed the "Download CSV" button and its report export logic.
- `app/teacher/peer/page.tsx`: Removed the "Export History" button and its respective csv download logic.
- `app/teacher/results/page.tsx`: Removed the "Export & Download Results" section and its `downloadReport` handler.

### antigravity — 2026-03-20
**To**: All
**Topic**: Theme Application

- `app/globals.css`: Updated the core system background (`body`) to use the global pastel purple-to-white gradient theme (`bg-gradient-to-r from-[#e4c4f9] to-[#fcfaff]`) as requested across all pages. Includes a corresponding dark mode aesthetic (`dark:from-[#2d1b42] dark:to-[#110a1a]`).

### antigravity — 2026-03-22
**To**: All
**Topic**: Dean UI Updates

- `app/dean/dashboard/page.tsx`: Removed "Completion Rate" and "Pending Actions" cards from the dashboard grid. Cleaned up unused variables and imports.
- `app/dean/dashboard/page.tsx`: Converted the "Active Evaluation Period" alert styling on the dashboard from a "warning" variant to an "info" variant to make it look neutral and contextual.
- `app/dean/forms/page.tsx`: Removed "Self Evaluation" and "Admin Evaluation" options from the Form Type dropdown list.
- `app/dean/reports/page.tsx`: Removed "Total Evaluations" card from Reports dashboard and adjusted grid layout.
- `app/dean/reports/page.tsx`: Updated export to feature an organized report template with "COLLEGE EVALUATION SYSTEM" branding, title, and proper formatted headers.
- `app/dean/reports/page.tsx`: Expanded reports to strictly evaluate and display all specified data sections (trends, improvement areas, completion stats) exactly as they are described visually.
- `app/dean/reports/page.tsx`: Integrates `jsPDF` and `jspdf-autotable` to generate actual native PDF document variants rather than raw text Blob overlays, effectively preventing "corrupted/damaged file" errors upon downloading.
- `app/dean/reports/page.tsx`: Fixed the `[object Object]` rendering bug in Course Reports by mapping evaluation arrays to their `.length` total counts.
- `app/dean/reports/page.tsx`: Removed the Search input field and the Department & Instructor dropdown filters from the report generator dashboard.
- `app/dean/users/page.tsx`: Removed "Administrator" from the role dropdown when adding or editing a user to restrict standard admin creation.
- `app/dean/users/page.tsx`: Replaced all raw browser `window.alert()` popup messages across the dashboard with embedded, auto-dismissing `Alert` UI components for a polished feel.
- `app/dean/users/page.tsx` & `app/api/users/route.ts`: Integrated a custom password field securely mapped to the creation form. The dashboard is now fully connected to the backend API (`POST`/`PATCH`/`DELETE`) to enact direct database-driven persistence and deletion of registered users.
- `app/dean/evaluations/page.tsx`: Removed the "Select Subject" dropdown and its prerequisite block mappings from the Dean generic evaluation modal.
- `app/teacher/results/page.tsx`: Removed the "View Detailed Report" link component inside the Results by Course mapped grid blocks.
- `app/teacher/dashboard/page.tsx`: Converted the "Peer Reviews" analytics card to track "Pending tasks" instead of "Completed" evaluations.
- `app/api/evaluations/route.ts`: Linked evaluation resets to synchronously clear their orphaned duplicate anonymous feedback from the `comments` table.
- `package.json`: Swapped the dev rendering engine from standard Webpack to Rust-based `Turbopack` (`--turbo`) for significantly faster live compilations.

### antigravity — 2026-03-22
**To**: All
**Topic**: Remove Export Report button & Fix History Dropdown

- `app/student/dashboard/page.tsx`: Removed the "Export Report" button and its respective csv download logics.
- `app/student/history/page.tsx`: Removed the "Download PDF" button and its respective download logic.
- `app/student/history/page.tsx`: Dynamically generated available "Semesters" based on actual `historyData` evaluations instead of hardcoded strings, while fixing the filtering implementation to truly sort historical records.
- `app/student/profile/page.tsx`: Locked down the "Program" property by replacing its dropdown with a read-only disabled input mapping, preventing students from editing their assigned course. Also displayed a fixed "Section" box under the same edit layer.
- `app/student/profile/page.tsx`: Completely removed the "Edit Profile" button and its respective state block, converting the page into a strict read-only profile view with only the "Change Password" capability.
- `app/student/profile/page.tsx` & `app/api/users/route.ts`: Integrated an "Old Password" requirement for standard users when changing passwords. The backend strictly cross-checks the current password before proceeding.
- `app/student/dashboard/page.tsx`: Removed the illogical `trend` percentage displays from all dashboard analytics cards (e.g., "Days Left" showing `-38%`).
- `app/dean/evaluations/page.tsx`: Enabled the "Lock Option" for all "Pending" evaluations. Deans can now instantly disable access to specific evaluation targets before they are even filled out, preventing unmatched subjects from being accessed. Unlocking a never-touched locked record will intuitively drop it back to "pending".
- `app/teacher/classes/page.tsx` & `app/teacher/dashboard/page.tsx`: Disabled the "counting of students per subject" tracking logic, hiding the "Total Students" analytics card alongside the visual numbers attached to individual class elements.
- `app/teacher/peer/page.tsx`: Removed the "Avg Score Given" analytics card and computation from the topmost metrics area.
- `app/teacher/results/page.tsx`: Removed the "Print" & "Share" buttons along with their respective logic layers.
- `app/teacher/results/page.tsx`: Removed the "Completion Rate" and "Peer Reviews Completed" data cards from the key metrics grid, dropping its column count to 2.
- `app/teacher/results/page.tsx`: Removed the "Feedback Sentiment" card containing the calculated array loops used to compute positive/neutral/negative distributions.
- `components/layout/TopNavbar.tsx`: Removed the "RoleSwitcher" dropdown utility from the core application header to prevent users from fast-swapping contexts.
- `app/dean/dashboard/page.tsx`: Increased the size and weight of the root "Dean Dashboard" text string wrapper to `text-4xl font-bold` to match standard dashboard headers.
- `database/schema.sql`, `app/api/archive/route.ts`, & `app/dean/academic/page.tsx`: Built a global "Archive All Data" operation allowing Deans to natively lock away evaluation periods, deprecate academic frames, and safely freeze core subjects by mapping `is_archived` boolean columns inside SQL. This effortlessly wipes the user/teacher dashboards clean to prepare for a new semester rollover while retaining full historical history.
- `components/ui/Button.tsx`: Integrated global `inline-flex items-center justify-center` styling defaults into the root Button definition to prevent embedded layout icons from spontaneously breaking line placement.
- `app/dean/users/page.tsx`: Removed the "Export" button and its local layout logic from the User Management dashboard.
- `app/dean/users/page.tsx`: Increased the size of the "Add User" creation button.
- `app/dean/audit/page.tsx`: Removed the "Submissions" log count analytic card and scaled the metrics grid to fit the rest perfectly.

### antigravity — 2026-03-23
**To**: All
**Topic**: Fixed "Forbidden" API errors

- `app/api/forms/route.ts`, `app/api/audit/route.ts`, `app/api/evaluations/sync/route.ts`, `app/api/evaluations/dean/route.ts`: Fixed an unawaited asynchronous generic validation method `verifyToken` generating truthy unresolvable `decoded` promise objects that incorrectly fell into "Forbidden" checks. The code block was replaced with an active imported reference to the globally correct and synchronous sequence `verifyToken` found in `@/lib/auth`.

### antigravity — 2026-03-23
**To**: All
**Topic**: Chatbot AI Assistant on Login Page

- `components/ui/Chatbot.tsx`: Created a brand new simulated Chatbot AI assistant component that sits on the bottom right corner of the screen and helps general users with common inquiries like forgotten passwords or login issues. It natively accepts user inputs and returns simulated delayed responses. The open-state button uses a `<Bot />` icon.
- `components/ui/index.ts`: Added an export for the newly created `Chatbot` component.
- `app/login/page.tsx`: Embedded the `Chatbot` component into the primary login component layout.


### antigravity — 2026-03-24
**To**: All
**Topic**: Admin UI expansions & PWA Support Rollout

- `app/api/users/route.ts` & `app/dean/users/page.tsx`: Re-wired the `/api/users` PATCH handler to safely extract, accept, and overwrite target account `email` property securely inside the database, while removing the UI `.disabled` parameter locking it down.
- `app/dean/audit/page.tsx`: Removed the isolated right-column tracking metrics (`Total Activities`, `Logins`), and allowed the primary activity log data-table to natively flow full horizontal width across the viewport.
- `app/dean/users/page.tsx`: Converted the "Teachers" dashboard metric box into a fully clickable interactive window that triggers an embedded modal `<TeacherStatsMap>`. This instantly arrays metrics (combining `overall_score`, `student_comments`, `peer_comments`, and `admin_comments`) mapped directly onto every registered teacher to form a 360-degree performance view.
- PWA Engine Migration:
   - Configured, downloaded, and deployed `@ducanh2912/next-pwa` natively across the active environment.
   - Initialized global `public/manifest.json` parameter map tracking name spaces, native scaling options, caching, and custom colors.
   - Set browser `<title>` layout elements identically to the unified formatting `CITE | COLLEGE EVALUATION SYSTEM`.
   - Utilized Python `PIL` scripts locally to slice and export mathematics-grade `icon-192x192.png` and `icon-512x512.png` transparent circular versions of the official logo into the root `/public/` layer, triggering automatic "Install this page as an app" prompts across Chromium rendering builds automatically.
- `app/dean/reports/page.tsx`: Destroyed the vertical sidebar holding `Completion Rate` / `Avg Score` metrics blocks and formally flattened the responsive grid container to scale horizontally uniformly taking up full screen width.

---

## Coding Standards

Guidelines — not rigid rules. Use judgment and log deviations.

### API Usage
- Use `useFetch` from `@/hooks` for GET requests (auto-attaches JWT)
- For POST/PATCH/DELETE, use `fetch()` with the token from `sessionStorage.getItem('auth_token')`
- API base URL pattern: `useFetch` prepends `/api` automatically, so pass paths like `'/users'` not `'/api/users'`

### Authentication Pattern
```typescript
// Standard fetch for mutations
const base = process.env.NEXT_PUBLIC_API_URL || '/api';
const token = sessionStorage.getItem('auth_token');
const res = await fetch(`${base}/endpoint`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});
const data = await res.json();
if (!data.success) throw new Error(data.error);
```

### Database
- All DB access goes through API routes, never directly from page components
- `cite_es.sql` is the source of truth for table definitions — keep `schema.sql` aligned with it

### Components
- Reuse existing components from `components/ui/` (Button, Card, Input, Select, Modal, Alert, Badge)
- If you need a new component, create it in `components/` and log it here

### Types
- Define page-specific types in the page file itself (existing pattern)
- If a type is shared across slices, create it in `types/` and log it here

### Error Handling
- Show user-facing errors via the `<Alert>` component
- API errors: catch and display `error.message` or the API response `error` field
- Don't swallow errors silently

---

## Key Data Relationships

```
evaluation_periods (admin creates)
  └─ form_id → evaluation_forms (criteria JSON)

evaluation_forms.criteria → JSON array of { name, weight, questions[] }

evaluations (generated on "Start Evaluation")
  ├─ evaluator_id → users.id (student/teacher doing the eval)
  ├─ evaluatee_id → users.id (teacher being evaluated)
  ├─ course_id → courses.id
  └─ evaluation_type: 'teacher' | 'peer' | 'dean'

courses (aligned with cite_es.sql)
  ├─ teacher_id → users.id
  ├─ course_program: ENUM('BSIT','BSEMC')
  └─ year_level: INT

evaluation_responses
  ├─ evaluation_id → evaluations.id
  └─ criteria_id → evaluation_criteria.id

comments (anonymous feedback)
  ├─ entity_type: 'evaluation'
  ├─ entity_id: evaluatee's user ID
  └─ author_id: hidden from display (anonymity)
```

---

## Handoff Checklist

When your slice is done, update your status in Registered Agents and note:

```
### [AGENT_ID] — Handoff
- [ ] Build passes (`npx next build`)
- [ ] Tested in browser (describe what you tested)
- [ ] No console errors
- [ ] Logged all changes in Communication Log
```
