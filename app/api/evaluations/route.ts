import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';


// request payload used by students/teachers when submitting responses
// we also support optional parameters when creating new evaluation
// records on the fly (courseId, evaluationType, evaluateeId) and an
// admin action to generate assignments in bulk.

type EvalRequest = {
  evaluationId?: string;
  courseId?: string;
  evaluationType?: string; // 'teacher' | 'peer'
  evaluateeId?: string;
  periodId?: number; // link generated evaluations to a period
  comment?: string; // overall comment stored in evaluations.comments
  responses?: Array<{ criteriaId: string; rating: number; comment?: string }>;
  action?: 'generate'; // for admin bulk operations
};

// GET evaluations for the logged-in user
// support optional query parameters ?type=peer|teacher&status=locked|submitted
export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded: any = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const url = new URL(request.url);
    const filterType = url.searchParams.get('type');
    const filterStatus = url.searchParams.get('status');
    const filterPeriodId = url.searchParams.get('period_id');
    const filterId = url.searchParams.get('id');

    let evaluations: any;
    if (decoded.role === 'dean') {
      // dean sees all evaluations (completed or not) with full response details
      let base =
        `SELECT e.id, e.course_id, e.period_id, e.evaluatee_id, e.evaluator_id, e.evaluation_type, e.status, e.comments,
                c.name as course_name, c.code as course_code,
                u.name as evaluatee_name,
                ev.name as evaluator_name
         FROM evaluations e
         LEFT JOIN courses c ON e.course_id = c.id
         LEFT JOIN users u ON e.evaluatee_id = u.id
         LEFT JOIN users ev ON e.evaluator_id = ev.id`;
      const conditions: string[] = [];
      const params: any[] = [];
      if (filterId) {
        conditions.push('e.id = ?');
        params.push(filterId);
      }
      if (filterType) {
        conditions.push('e.evaluation_type = ?');
        params.push(filterType);
      }
      if (filterStatus) {
        conditions.push('e.status = ?');
        params.push(filterStatus);
      }
      if (filterPeriodId) {
        conditions.push('e.period_id = ?');
        params.push(filterPeriodId);
      }
      if (conditions.length) {
        base += ' WHERE ' + conditions.join(' AND ');
      }
      base += ' ORDER BY e.created_at DESC';
      evaluations = await query(base, params);
      // attach responses for each
      const withResp = await Promise.all(
        (evaluations || []).map(async (evaluation: any) => {
          // Join responses with questions to get the question text
          const responses: any = await query(
            `SELECT er.id, er.criteria_id, er.rating, er.comment,
                    eq.text as question_text, ec.name as criteria_name
             FROM evaluation_responses er
             LEFT JOIN evaluation_questions eq ON er.criteria_id = eq.id
             LEFT JOIN evaluation_criteria ec ON eq.criteria_id = ec.id
             WHERE er.evaluation_id = ?
             ORDER BY er.id`,
            [evaluation.id]
          );
          const deanId = decoded.userId || decoded.id;
          return {
            ...evaluation,
            responses: responses || [],
            evaluator: { name: evaluation.evaluator_name },
            evaluatee: { name: evaluation.evaluatee_name },
            form: { type: evaluation.evaluation_type },
            course: { name: evaluation.course_name, code: evaluation.course_code },
            isLocked: evaluation.status === 'locked',
            is_ghost: evaluation.evaluator_id === deanId,
          };
        })
      );
      evaluations = withResp;

      // Dean path already has full responses — skip the shared block below
      return NextResponse.json({ success: true, evaluations });
    } else {
      // role=evaluatee returns evaluations where this user is being evaluated
      const role = url.searchParams.get('role');
      const isHistory = url.searchParams.get('history') === 'true';
      let base =
        `SELECT e.id, e.course_id, e.period_id, e.evaluatee_id, e.evaluator_id, e.evaluation_type, e.status, e.comments, e.submitted_at, e.created_at, e.is_archived,
                c.name as course_name, c.code as course_code,
                u.name as evaluatee_name,
                ep.name as period_name, ep.academic_year, ep.semester, ep.form_id,
                ep.status as period_status, ep.start_date as period_start_date, ep.end_date as period_end_date
         FROM evaluations e
         LEFT JOIN courses c ON e.course_id = c.id
         LEFT JOIN users u ON e.evaluatee_id = u.id
         LEFT JOIN evaluation_periods ep ON e.period_id = ep.id`;
      const params: any[] = [decoded.userId];
      if (role === 'evaluatee') {
        base += ' WHERE e.evaluatee_id = ?';
        if (!isHistory) base += ' AND e.is_archived = 0';
      } else {
        base += ' WHERE e.evaluator_id = ?';
        if (!isHistory) {
          base += ` AND e.status != 'locked' AND e.is_archived = 0`;
        }
      }
      if (filterType) {
        base += ' AND e.evaluation_type = ?';
        params.push(filterType);
      }
      if (filterStatus) {
        base += ' AND e.status = ?';
        params.push(filterStatus);
      }
      base += ' ORDER BY e.created_at DESC';
      evaluations = await query(base, params);
    }

    // Get responses for each evaluation
    const evaluationsWithResponses = await Promise.all(
      (evaluations || []).map(async (evaluation: any) => {
        const responses: any = await query(
          `SELECT er.id, er.criteria_id, er.rating, er.comment,
                  ec.name as criteria_name
           FROM evaluation_responses er
           LEFT JOIN evaluation_questions eq ON er.criteria_id = eq.id
           LEFT JOIN evaluation_criteria ec ON eq.criteria_id = ec.id
           WHERE er.evaluation_id = ? 
           ORDER BY er.id`,
          [evaluation.id]
        );
        return {
          ...evaluation,
          responses: responses || [],
          evaluatee: { name: evaluation.evaluatee_name },
          course: { name: evaluation.course_name, code: evaluation.course_code },
          period: { id: evaluation.period_id, name: evaluation.period_name, academic_year: evaluation.academic_year, semester: evaluation.semester, form_id: evaluation.form_id, status: evaluation.period_status, start_date: evaluation.period_start_date, end_date: evaluation.period_end_date },
        };
      })
    );

    return NextResponse.json({
      success: true,
      evaluations: evaluationsWithResponses,
    });
  } catch (error) {
    console.error('Get evaluations error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH evaluation attributes or lock/unlock. Dean may update any evaluation; evaluators
// may only modify their own draft evaluations (e.g. change status back to draft).
export async function PATCH(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: any = await request.json();
    const { id, status, evaluator_id, evaluatee_id, course_id } = body;
    if (!id) {
      return NextResponse.json({ error: 'Evaluation id required' }, { status: 400 });
    }

    // only dean or the evaluator themselves (and not locked) may patch
    const evalRecord: any = await queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
    if (!evalRecord) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    if (decoded.role !== 'dean') {
      if (evalRecord.evaluator_id !== decoded.userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      if (evalRecord.status === 'locked') {
        return NextResponse.json({ error: 'Evaluation locked' }, { status: 400 });
      }
    }

    const updates: string[] = [];
    const params: any[] = [];
    if (status !== undefined) {
      updates.push('status = ?');
      params.push(status);
    }
    if (evaluator_id !== undefined && decoded.role === 'dean') {
      updates.push('evaluator_id = ?');
      params.push(evaluator_id);
    }
    if (evaluatee_id !== undefined && decoded.role === 'dean') {
      updates.push('evaluatee_id = ?');
      params.push(evaluatee_id);
    }
    if (course_id !== undefined && decoded.role === 'dean') {
      updates.push('course_id = ?');
      params.push(course_id);
    }

    if (updates.length > 0) {
      params.push(id);
      await query(`UPDATE evaluations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const updated = await queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
    return NextResponse.json({ success: true, evaluation: updated });
  } catch (err) {
    console.error('Evaluation patch error', err);
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}

// POST evaluation responses
export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decoded: any = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const body: EvalRequest = await request.json();

    // ADMIN BULK GENERATION
    if (body.action === 'generate') {
      if (decoded.role !== 'dean') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const periodId = body.periodId || null;

      let generated = 0;
      let coursesCreated = 0;
      let enrollmentsCreated = 0;

      if (periodId) {
        const period: any = await queryOne(
          `SELECT ep.assignments_json, ep.academic_year, ep.semester, ep.form_id, ef.type as form_type
           FROM evaluation_periods ep
           LEFT JOIN evaluation_forms ef ON ep.form_id = ef.id
           WHERE ep.id = ?`,
          [periodId]
        );

        // Peer-review form: generate pairwise evaluations among all active teachers
        if (period?.form_type === 'peer-review') {
          const teachers: any = await query(
            `SELECT id FROM users WHERE role = 'teacher' AND is_active = 1`
          );
          for (const evaluator of (teachers || [])) {
            for (const evaluatee of (teachers || [])) {
              if (evaluator.id === evaluatee.id) continue;
              const exists: any = await queryOne(
                `SELECT 1 FROM evaluations
                 WHERE period_id = ? AND evaluatee_id = ? AND evaluator_id = ? AND evaluation_type = 'peer'`,
                [periodId, evaluatee.id, evaluator.id]
              );
              if (!exists) {
                await query(
                  `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
                   VALUES (NULL, ?, ?, ?, 'peer', 'pending')`,
                  [periodId, evaluatee.id, evaluator.id]
                );
                generated++;
              }
            }
          }
        }

        if (period?.assignments_json) {
          const parsed = typeof period.assignments_json === 'string'
            ? JSON.parse(period.assignments_json)
            : period.assignments_json;

          // Support multi-group format (groups array) with backwards compatibility
          const groups: any[] = parsed.groups
            ? parsed.groups
            : (parsed.program ? [parsed] : []);

          // Map semester number back from string for the courses table
          const semesterNum = period.semester === '1st Semester' ? 1
            : period.semester === '2nd Semester' ? 2
            : period.semester === 'Summer' ? 3
            : Number.parseInt(period.semester) || null;

          // Load curriculum once for all groups
          const { buildCurriculum } = await import('@/app/api/curriculum/route');
          const curriculum = await buildCurriculum();

          for (const group of groups) {
            const program = group.program;       // e.g. 'BSIT'
            const yearLevel = group.yearLevel;   // e.g. '1st Year'
            const assignments = group.assignments || {}; // { subjectCode: instructorId }
            const sections = group.sections || {};       // { subjectCode: 'A' }
            const defaultSection = group.defaultSection || 'A';
            const selectedCodes = group.selectedCodes || Object.keys(assignments);

            if (!program || !yearLevel) continue;

            // Convert year level string to number (e.g. '1st Year' → 1)
            const yearNum = Number.parseInt(yearLevel) || 0;

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
              const subjectName = subjectNameMap[code] || code;

              // 1. Find or create the course (subject-instructor-section assignment)
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

              // 2. Find students matching program + year_level + section and enroll them
              const students: any = await query(
                `SELECT id FROM users
                 WHERE role = 'student' AND course = ? AND year_level = ? AND section = ?`,
                [program, yearNum, section]
              );

              for (const student of (students || [])) {
                // Create enrollment if it doesn't exist
                await query(
                  `INSERT IGNORE INTO course_enrollments (course_id, student_id) VALUES (?, ?)`,
                  [courseId, student.id]
                ).then((r: any) => { enrollmentsCreated += r?.affectedRows || 0; });

                // 3. Create evaluation: student (evaluator) evaluates teacher (evaluatee)
                const exists: any = await queryOne(
                  `SELECT 1 FROM evaluations
                   WHERE period_id = ? AND course_id = ? AND evaluatee_id = ? AND evaluator_id = ? AND evaluation_type = 'teacher'`,
                  [periodId, courseId, instructorId, student.id]
                );

                if (!exists) {
                  await query(
                    `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
                     VALUES (?, ?, ?, ?, 'teacher', 'pending')`,
                    [courseId, periodId, instructorId, student.id]
                  );
                  generated++;
                }
              }
            }
          }
        }
      }

      return NextResponse.json({
        success: true,
        message: `Generated ${generated} evaluations, ${coursesCreated} courses, ${enrollmentsCreated} enrollments`,
      });
    }

    // regular submission
    // if client provided courseId instead of an evaluationId create one
    let evaluationId = body.evaluationId;
    if (!evaluationId) {
      if (!body.courseId) {
        return NextResponse.json({ error: 'evaluationId or courseId required' }, { status: 400 });
      }
      // determine evaluatee (instructor or specified)
      let evaluatee = body.evaluateeId;
      if (!evaluatee && body.evaluationType === 'teacher') {
        const course: any = await queryOne('SELECT teacher_id FROM courses WHERE id = ?', [body.courseId]);
        evaluatee = course?.teacher_id;
      }
      if (!evaluatee) {
        return NextResponse.json({ error: 'Unable to determine evaluatee' }, { status: 400 });
      }
      const insertResult: any = await query(
        `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [body.courseId || null, body.periodId || null, evaluatee, decoded.userId, body.evaluationType || 'teacher', 'draft']
      );
      evaluationId = insertResult.insertId;
    }

    if (!body.responses || !Array.isArray(body.responses)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Verify evaluation exists and belongs to this user
    const evaluation: any = await queryOne(
      'SELECT id, status FROM evaluations WHERE id = ? AND evaluator_id = ?',
      [evaluationId, decoded.userId]
    );

    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    if (evaluation.status === 'locked') {
      return NextResponse.json({ error: 'Evaluation is locked' }, { status: 400 });
    }

    // Validate ratings are between 1 and 5
    for (const response of body.responses) {
      const r = Number(response.rating);
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        return NextResponse.json(
          { error: `Invalid rating ${response.rating} — must be an integer between 1 and 5` },
          { status: 400 }
        );
      }
    }

    // Enforce evaluation period date window and status
    const evalRecord: any = await queryOne(
      `SELECT e.period_id, ep.start_date, ep.end_date, ep.status as period_status
       FROM evaluations e
       LEFT JOIN evaluation_periods ep ON e.period_id = ep.id
       WHERE e.id = ?`,
      [evaluationId]
    );
    if (evalRecord?.period_status === 'closed') {
      return NextResponse.json(
        { error: 'This evaluation period is closed. Submissions are no longer accepted.' },
        { status: 400 }
      );
    }
    if (evalRecord?.start_date && evalRecord?.end_date) {
      // Compare dates in local time only (ignore time component).
      // Date-only strings like "2026-03-20" are parsed as UTC midnight,
      // which causes timezone mismatches vs local new Date(). Strip to
      // YYYY-MM-DD and compare as plain date strings instead.
      const nowDate = new Date();
      const today = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
      const startDate = String(evalRecord.start_date).slice(0, 10);
      const endDate = String(evalRecord.end_date).slice(0, 10);
      if (today < startDate || today > endDate) {
        return NextResponse.json(
          { error: 'Submissions are only accepted during the evaluation period' },
          { status: 400 }
        );
      }
    }

    // Upsert responses — delete old ones first, then insert fresh
    await query('DELETE FROM evaluation_responses WHERE evaluation_id = ?', [evaluationId]);
    for (const response of body.responses) {
      await query(
        'INSERT INTO evaluation_responses (evaluation_id, criteria_id, rating, comment) VALUES (?, ?, ?, ?)',
        [evaluationId, response.criteriaId, response.rating, response.comment || null]
      );
    }

    // Compute overall score
    const avgScore = body.responses.reduce((sum, r) => sum + r.rating, 0) / body.responses.length;

    // Update evaluation status to submitted, store overall comment and score
    await query(
      'UPDATE evaluations SET status = ?, submitted_at = NOW(), comments = ?, overall_score = ? WHERE id = ?',
      ['submitted', body.comment || null, Math.round(avgScore * 100) / 100, evaluationId]
    );

    return NextResponse.json({ success: true, message: 'Evaluation submitted successfully' }, { status: 200 });
  } catch (err) {
    console.error('Error processing evaluation submission:', err);
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}

/**
 * DELETE /api/evaluations
 * Dean-only. Two modes based on whether the evaluation is a ghost:
 * - Ghost (evaluator is dean): deletes the evaluation and its responses entirely
 * - Normal (evaluator is student/teacher): resets to pending (deletes responses, sets status='pending')
 *
 * Query param: ?id=<evaluation_id>
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = await verifyToken(token);
    if (decoded?.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    const evaluation: any = await queryOne('SELECT * FROM evaluations WHERE id = ?', [id]);
    if (!evaluation) {
      return NextResponse.json({ error: 'Evaluation not found' }, { status: 404 });
    }

    const deanId = decoded.userId || decoded.id;
    const isGhost = evaluation.evaluator_id === deanId;

    // Always clear responses first
    await query('DELETE FROM evaluation_responses WHERE evaluation_id = ?', [id]);

    // Clean up duplicate anonymous dashboard comment if it exists
    if (evaluation.comments) {
      await query(
        `DELETE FROM comments WHERE entity_type = 'evaluation' AND entity_id = ? AND author_id = ? AND content = ?`,
        [evaluation.evaluatee_id, evaluation.evaluator_id, evaluation.comments]
      );
    }

    if (isGhost) {
      // Ghost eval: delete entirely
      await query('DELETE FROM evaluations WHERE id = ?', [id]);
      return NextResponse.json({ success: true, action: 'deleted' });
    } else {
      // Normal eval: reset to pending
      await query(
        'UPDATE evaluations SET status = ?, submitted_at = NULL, comments = NULL, overall_score = NULL WHERE id = ?',
        ['pending', id]
      );
      return NextResponse.json({ success: true, action: 'reset' });
    }
  } catch (error) {
    console.error('Evaluations DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

