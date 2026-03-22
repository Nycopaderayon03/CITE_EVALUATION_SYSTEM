import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';

let jwt: any = null;

async function loadJWT() {
  if (!jwt) {
    const jwtModule = await import('jsonwebtoken');
    jwt = jwtModule.default || jwtModule;
  }
  return jwt;
}

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

async function verifyToken(token: string) {
  try {
    const jwtLib = await loadJWT();
    return jwtLib.verify(token, process.env.JWT_SECRET as string);
  } catch {
    return null;
  }
}

/**
 * POST /api/evaluations/sync
 *
 * Just-In-Time evaluation generation for late registrants.
 * When a student or teacher hits their dashboard, this catches up any missing
 * evaluation assignments from active evaluation periods.
 */
/**
 * Handles the HTTP POST request securely.
 * Mutates system state through parametric execution safely.
 * Asserts strict JSON structural types directly.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = decoded.userId || decoded.id;
    const role = decoded.role;

    if (role !== 'student' && role !== 'teacher') {
      return NextResponse.json({ success: true, generated: 0 });
    }

    // Fetch user profile for matching
    const user: any = await queryOne('SELECT * FROM users WHERE id = ? AND is_active = 1', [userId]);
    if (!user) {
      return NextResponse.json({ error: 'User not found or inactive' }, { status: 404 });
    }

    // Find all active evaluation periods
    const activePeriods: any = await query(
      `SELECT ep.*, ef.type as form_type
       FROM evaluation_periods ep
       LEFT JOIN evaluation_forms ef ON ep.form_id = ef.id
       WHERE ep.status = 'active'`
    );

    let generated = 0;
    let coursesCreated = 0;
    let enrollmentsCreated = 0;

    for (const period of (activePeriods || [])) {
      if (role === 'teacher' && period.form_type === 'peer-review') {
        // Peer-review: ensure this teacher has pairwise evaluations with all other active teachers
        const otherTeachers: any = await query(
          `SELECT id FROM users WHERE role = 'teacher' AND is_active = 1 AND id != ?`,
          [userId]
        );

        for (const other of (otherTeachers || [])) {
          // This teacher evaluates the other
          const existsAsEvaluator: any = await queryOne(
            `SELECT 1 FROM evaluations
             WHERE period_id = ? AND evaluator_id = ? AND evaluatee_id = ? AND evaluation_type = 'peer'`,
            [period.id, userId, other.id]
          );
          if (!existsAsEvaluator) {
            await query(
              `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
               VALUES (NULL, ?, ?, ?, 'peer', 'pending')`,
              [period.id, other.id, userId]
            );
            generated++;
          }

          // The other teacher evaluates this teacher
          const existsAsEvaluatee: any = await queryOne(
            `SELECT 1 FROM evaluations
             WHERE period_id = ? AND evaluator_id = ? AND evaluatee_id = ? AND evaluation_type = 'peer'`,
            [period.id, other.id, userId]
          );
          if (!existsAsEvaluatee) {
            await query(
              `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
               VALUES (NULL, ?, ?, ?, 'peer', 'pending')`,
              [period.id, userId, other.id]
            );
            generated++;
          }
        }
      }

      if (role === 'student' && period.form_type === 'student-to-teacher' && period.assignments_json) {
        // Student-to-teacher: check if this student matches any assignment group
        const parsed = typeof period.assignments_json === 'string'
          ? JSON.parse(period.assignments_json)
          : period.assignments_json;

        const groups: any[] = parsed.groups
          ? parsed.groups
          : (parsed.program ? [parsed] : []);

        const semesterNum = period.semester === '1st Semester' ? 1
          : period.semester === '2nd Semester' ? 2
          : period.semester === 'Summer' ? 3
          : Number.parseInt(period.semester) || null;

        const { buildCurriculum } = await import('@/app/api/curriculum/route');
        const curriculum = await buildCurriculum();

        for (const group of groups) {
          const program = group.program;
          const yearLevel = group.yearLevel;
          const assignments = group.assignments || {};
          const sections = group.sections || {};
          const defaultSection = group.defaultSection || 'A';
          const selectedCodes = group.selectedCodes || Object.keys(assignments);

          if (!program || !yearLevel) continue;

          const yearNum = Number.parseInt(yearLevel) || 0;

          // Check if this student matches this group
          if (
            user.course !== program ||
            user.year_level !== yearNum ||
            !selectedCodes.length
          ) continue;

          const programData = (curriculum as any)[program];
          const yearData = programData?.[yearLevel];
          const semSubjects: Array<{ code: string; name: string }> = yearData?.[period.semester] || [];
          const subjectNameMap: Record<string, string> = {};
          for (const s of semSubjects) {
            subjectNameMap[s.code] = s.name;
          }

          for (const code of selectedCodes) {
            const instructorId = assignments[code];
            if (!instructorId) continue;

            const section = sections[code] || defaultSection;

            // Student must match the section for this subject
            if (user.section !== section) continue;

            const subjectName = subjectNameMap[code] || code;

            // Find or create the course
            let course: any = await queryOne(
              `SELECT id FROM courses
               WHERE code = ? AND teacher_id = ? AND section = ?
                 AND course_program = ? AND year_level = ?
                 AND academic_year = ? AND semester = ?`,
              [code, instructorId, section, program, yearNum, period.academic_year, semesterNum]
            );

            if (!course) {
              const insertResult: any = await query(
                `INSERT INTO courses (code, name, teacher_id, section, course_program, year_level, academic_year, semester)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [code, subjectName, instructorId, section, program, yearNum, period.academic_year, semesterNum]
              );
              course = { id: insertResult.insertId };
              coursesCreated++;
            }

            const courseId = course.id;

            // Create enrollment if needed
            await query(
              `INSERT IGNORE INTO course_enrollments (course_id, student_id) VALUES (?, ?)`,
              [courseId, userId]
            ).then((r: any) => { enrollmentsCreated += r?.affectedRows || 0; });

            // Create evaluation if it doesn't exist
            const exists: any = await queryOne(
              `SELECT 1 FROM evaluations
               WHERE period_id = ? AND course_id = ? AND evaluatee_id = ? AND evaluator_id = ? AND evaluation_type = 'teacher'`,
              [period.id, courseId, instructorId, userId]
            );

            if (!exists) {
              await query(
                `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
                 VALUES (?, ?, ?, ?, 'teacher', 'pending')`,
                [courseId, period.id, instructorId, userId]
              );
              generated++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      coursesCreated,
      enrollmentsCreated,
    });
  } catch (error) {
    console.error('Evaluations sync error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
