# 🚀 System Setup & Deployment Guide

## Quick Start

```bash
# 1. Navigate to project directory
cd college_of_information_technology2

# 2. Install dependencies
npm install

# 3. Set up database (create tables + seed data)
npm run db:migrate

# 4. Start development server
npm run dev
```

Visit `http://localhost:3000` and login with test credentials.

---

## Database Configuration

### Environment (.env.local)
```dotenv
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=cite_es
NODE_ENV=development
```

The app is pre-configured to use the **cite_es** database on localhost.

### Database Setup Scripts

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Create all tables (idempotent) |
| `npm run db:seed` | Populate sample data (safe if data exists) |
| `npm run db:init` | Run migrate + seed sequentially |
| `npm run db:admin` | Create default admin account (admin@jmc.edu.ph) |
| `npm run db:reset` | Drop all tables (⚠️ destructive) |

---

## Tables & Schema

The system uses 11 core tables:

### Core Tables
- **users** - Student, teacher, dean accounts
- **courses** - Course definitions with instructor assignment
- **course_enrollments** - Student enrollment in courses
- **evaluations** - Teacher/peer/self evaluation records
- **evaluation_responses** - Individual rating responses

### Supporting Tables
- **academic_periods** - Semester/term definitions
- **evaluation_periods** - Windows for submitting evaluations
- **evaluation_criteria** - Rating criteria definitions
- **evaluation_forms** - Form templates
- **audit_logs** - Activity tracking
- **sessions** - Active user sessions/tokens
- **comments** - Generic comment system

---

## API Architecture

Base URL: `http://localhost:3000/api`

### Authentication
- JWT-based authentication
- Include token in Authorization header: `Bearer <token>`
- Verify endpoint returns user role: `student`, `teacher`, `dean`

### Role-Based Access

**Students** can:
- GET their enrolled courses
- GET pending/submitted evaluations
- POST evaluation responses
- GET submitted evaluation history

**Teachers** can:
- GET their taught courses
- GET evaluations they've given
- GET peer evaluation requests
- GET student feedback analytics

**Deans** can:
- GET all courses/users/evaluations
- PATCH evaluation locks/deadlines
- POST bulk evaluation generation
- GET system-wide analytics

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/courses` | List courses for user |
| GET | `/evaluations` | List evaluations (filtered by role) |
| POST | `/evaluations` | Submit or create evaluation |
| PATCH | `/evaluations` | Update evaluation (lock/unlock) |
| GET | `/analytics` | Get analytics data |

---

## Frontend Architecture

### Pages by Role

**Student Dashboard** (`/student/dashboard`)
- Pending evaluations
- Completion progress
- Course list with status
- Export evaluation report

**Teacher Dashboard** (`/teacher/dashboard`)
- Department trends
- Peer evaluation progress
- Class statistics

**Dean Dashboard** (`/dean/dashboard`)
- Top instructors list
- Department performance
- System-wide metrics

### Components

- `DashboardCard` - Stats display
- `DataTable` - Tabular data
- `ChartCard` - Chart containers
- `RatingScale` - 1-5 rating input
- `FormStepper` - Multi-step forms

### Styling
- Tailwind CSS (utility-first)
- Dark mode support (next-themes)
- Responsive design (mobile-first)
- Custom animations (Framer Motion)

---

## Testing

### Test Credentials

After running `npm run db:seed`:

```
👨‍🎓 Student
  Email: ruby@jmc.edu.ph
  Password: student123

👩‍🎓 Student
  Email: john@jmc.edu.ph
  Password: student123

👨‍🏫 Teacher
  Email: ryan@jmc.edu.ph
  Password: teacher123

👨‍💼 Dean (Admin)
  Email: admin@jmc.edu.ph
  Password: admin123
  (Run `npm run db:admin` to create this account)

👨‍💼 Dean (Seeded)
  Email: janette@jmc.edu.ph
  Password: admin123
```

### API Testing

```bash
# Get JWT token
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ruby@jmc.edu.ph","password":"student123"}'

# Use token to fetch data
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/courses
```

---

## Features Overview

### Student Portal
✅ View pending evaluations
✅ Submit course evaluations
✅ Track completion progress
✅ View evaluation history
✅ Export evaluation reports
✅ Set evaluation reminders

### Teacher Portal
✅ View student feedback
✅ Submit peer reviews
✅ Track peer evaluation requests
✅ View class analytics
✅ Department performance trends
✅ Peer completion metrics

### Admin Portal
✅ Bulk generate evaluations
✅ Lock/unlock evaluation periods
✅ Extend evaluation deadlines
✅ View system analytics
✅ Top instructors ranking
✅ Department comparisons
✅ Audit logs

---

## Development Workflow

### Adding New Features

1. **Database updates**
   - Update `database/schema.sql`
   - Run `npm run db:migrate`

2. **API endpoints**
   - Create route in `app/api/<feature>/route.ts`
   - Use JWT verification
   - Query database via `lib/db.ts`

3. **Frontend pages**
   - Create component in `app/<role>/<feature>/page.tsx`
   - Use `useFetch` hook for data
   - Integrate with Zustand state (if needed)

### Code Standards

- **TypeScript**: Strict mode, explicit types
- **React**: Functional components + hooks
- **Database**: Parameterized queries (prevent SQL injection)
- **API**: RESTful design, consistent error handling
- **Styling**: Tailwind utility classes

---

## Troubleshooting

### Database Connection Issues

**Error**: "Connection refused"
- Verify MySQL is running
- Check `DB_HOST` and `DB_USER` in `.env.local`
- Verify port 3306 is available

**Error**: "Unknown database 'cite_es'"
- Database doesn't exist yet
- Run: `npm run db:migrate`

### API Issues

**Error**: "Unauthorized (401)"
- Missing or invalid JWT token
- Token may be expired
- Try re-login to get new token

**Error**: "EADDRINUSE: address already in use :3000"
- Port 3000 is occupied
- Kill process: `lsof -ti:3000 | xargs kill -9`
- Or use: `npm run dev -- -p 3001`

### TypeScript Errors

Some implicit `any` warnings exist in development. These don't block runtime:
```bash
# Check all errors
npm run type-check

# Most are safe to ignore in development
# Fix critical ones in production builds
```

---

## Performance Optimization

- ✅ Indexes on foreign keys (FK queries)
- ✅ Connection pooling (mysql2 pool)
- ✅ Query caching where appropriate
- ✅ Pagination for large datasets
- ✅ Server-side analytics aggregation

### Future Improvements
- Database query optimization
- API response caching
- Frontend bundle optimization
- Image optimization
- Database replication/backup

---

## Deployment Checklist

- [ ] Environment variables set (`.env.local` → production secrets)
- [ ] Database backups configured
- [ ] JWT_SECRET set to strong value
- [ ] CORS configured for frontend domain
- [ ] Rate limiting enabled on API
- [ ] Audit logs being captured
- [ ] Error monitoring configured (e.g., Sentry)
- [ ] SSL/TLS certificates configured
- [ ] Database running on dedicated server
- [ ] Node.js version locked in `package.json`
- [ ] Static assets served from CDN
- [ ] Database connection pooling tuned
- [ ] Load balancer configured (if multi-server)
- [ ] Backup/restore procedures tested

---

## File Structure

```
college_of_information_technology2/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   │   ├── auth/            # Authentication endpoints
│   │   ├── courses/         # Course management
│   │   ├── evaluations/     # Evaluation workflows
│   │   └── analytics/       # Analytics data
│   ├── student/             # Student pages
│   ├── teacher/             # Teacher pages
│   ├── dean/                # Admin/Dean pages
│   └── login/               # Public pages
├── components/              # React components
│   ├── ui/                  # Base UI components
│   ├── layout/              # Layout components
│   └── animations/          # Animation components
├── database/                # Database-related
│   └── schema.sql          # Table definitions
├── lib/                     # Utility libraries
│   └── db.ts               # Database connection
├── tools/                   # Utility scripts
│   ├── migrate.js          # Schema migration
│   ├── seed.js             # Data seeding
│   └── reset.js            # Database reset
├── public/                  # Static assets
├── .env.local              # Environment config
├── package.json            # Dependencies
└── DATABASE_SETUP.md       # Database guide
```

---

## Support & Resources

- **Database**: MySQL 5.7+
- **Runtime**: Node.js 18+
- **Framework**: Next.js 16.1.6
- **Database Driver**: mysql2/promise
- **Authentication**: jsonwebtoken (JWT)

---

**Last Updated**: March 2026  
**Version**: 1.0.1

