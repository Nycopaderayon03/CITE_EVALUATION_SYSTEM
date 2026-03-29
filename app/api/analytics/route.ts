import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';



/**
 * Handles the HTTP GET request securely.
 * Verifies the authorization bearer token natively via abstract logic.
 * Prevents access if user does not match the scoped role mapping.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded: any = verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get analytics based on user role
    let analytics: any = {};

    if (decoded.role === 'student') {
      // Student analytics
      const enrolledCoursesResult: any = await query(
        'SELECT COUNT(*) as count FROM course_enrollments WHERE student_id = ?',
        [decoded.userId]
      );
      const enrolledCourses = enrolledCoursesResult[0]?.count || 0;

      const evaluationsResult: any = await query(
        'SELECT COUNT(*) as count FROM evaluations WHERE evaluator_id = ?',
        [decoded.userId]
      );
      const totalEvaluations = evaluationsResult[0]?.count || 0;

      const submittedResult: any = await query(
        'SELECT COUNT(*) as count FROM evaluations WHERE evaluator_id = ? AND status = "submitted"',
        [decoded.userId]
      );
      const submittedEvaluations = submittedResult[0]?.count || 0;

      const completionRate = totalEvaluations > 0 
        ? Math.round((submittedEvaluations / totalEvaluations) * 100 * 10) / 10 
        : 0;

      analytics = {
        enrolledCourses,
        totalEvaluations,
        submittedEvaluations,
        pendingEvaluations: totalEvaluations - submittedEvaluations,
        completionRate,
      };
    } else if (decoded.role === 'teacher') {
      // Teacher analytics
      const classesResult: any = await query(
        'SELECT COUNT(*) as count FROM courses WHERE teacher_id = ?',
        [decoded.userId]
      );
      const classesTaught = classesResult[0]?.count || 0;

      const studentsResult: any = await query(
        'SELECT COUNT(DISTINCT e.student_id) as count FROM courses c INNER JOIN course_enrollments e ON c.id = e.course_id WHERE c.teacher_id = ?',
        [decoded.userId]
      );
      const totalStudents = studentsResult[0]?.count || 0;

      // Count evaluations where this teacher is the evaluatee (includes peer evals with null course_id)
      const evaluationsCreatedResult: any = await query(
        'SELECT COUNT(*) as count FROM evaluations WHERE evaluatee_id = ?',
        [decoded.userId]
      );
      const evaluationsCreated = evaluationsCreatedResult[0]?.count || 0;

      const evaluationsSubmittedResult: any = await query(
        `SELECT COUNT(*) as count FROM evaluations WHERE evaluatee_id = ? AND status = 'submitted'`,
        [decoded.userId]
      );
      const evaluationsSubmitted = evaluationsSubmittedResult[0]?.count || 0;

      const evaluationRate = evaluationsCreated > 0 
        ? Math.round((evaluationsSubmitted / evaluationsCreated) * 100 * 10) / 10 
        : 0;

      // Teacher-specific performance trend and criteria breakdown
      try {
        // Use evaluatee_id to include peer evaluations (which have course_id = NULL)
        const trendResult: any = await query(
          `SELECT DATE_FORMAT(e.submitted_at, '%Y-%m') as period, AVG(er.rating) as avg_score
           FROM evaluation_responses er
           JOIN evaluations e ON er.evaluation_id = e.id
           WHERE e.status = 'submitted' AND e.evaluatee_id = ?
           GROUP BY DATE_FORMAT(e.submitted_at, '%Y-%m')
           ORDER BY period`,
          [decoded.userId]
        );
        const performanceTrend = (trendResult || []).map((r: any) => ({ period: r.period, score: Number.parseFloat(r.avg_score) }));

        // department-wide trend for comparison
        const deptTrendResult: any = await query(
          `SELECT DATE_FORMAT(e.submitted_at, '%Y-%m') as period, AVG(er.rating) as avg_score
           FROM evaluation_responses er
           JOIN evaluations e ON er.evaluation_id = e.id
           WHERE e.status = 'submitted'
           GROUP BY DATE_FORMAT(e.submitted_at, '%Y-%m')
           ORDER BY period`
        );
        const departmentTrend = (deptTrendResult || []).map((r: any) => ({ period: r.period, score: Number.parseFloat(r.avg_score) }));

        // criteria_id in evaluation_responses actually references evaluation_questions.id (FK),
        // so the JOIN chain is: evaluation_responses.criteria_id → evaluation_questions.id
        // → evaluation_criteria.id (via eq.criteria_id) to get the criteria name.
        // Uses evaluatee_id to include peer evaluations (course_id may be NULL).
        const criteriaResult: any = await query(
          `SELECT ec.id, ec.name, AVG(er.rating) as avg_score
           FROM evaluation_responses er
           JOIN evaluations e ON er.evaluation_id = e.id
           JOIN evaluation_questions eq ON er.criteria_id = eq.id
           JOIN evaluation_criteria ec ON eq.criteria_id = ec.id
           WHERE e.status = 'submitted' AND e.evaluatee_id = ?
           GROUP BY ec.id, ec.name
           ORDER BY avg_score DESC`,
          [decoded.userId]
        );
        const criteriaBreakdown = (criteriaResult || []).map((r: any) => ({ criteriaName: r.name, score: Number.parseFloat(r.avg_score) }));

        // count peer evaluations completed by this teacher
        const peerResult: any = await query(
          `SELECT COUNT(*) as count FROM evaluations WHERE evaluator_id = ? AND evaluation_type = 'peer' AND status = 'submitted'`,
          [decoded.userId]
        );
        const peerCompleted = peerResult[0]?.count || 0;

        analytics = {
          classesTaught,
          totalStudents,
          evaluationsCreated,
          evaluationsSubmitted,
          evaluationRate,
          performanceTrend,
          departmentTrend,
          criteriaBreakdown,
          peerCompleted,
        };
      } catch (err) {
        console.error('Teacher analytics additional queries failed:', err);
        analytics = {
          classesTaught,
          totalStudents,
          evaluationsCreated,
          evaluationsSubmitted,
          evaluationRate,
        };
      }
    } else if (decoded.role === 'dean' || decoded.role === 'admin') {
      // System-wide analytics
      const url = new URL(request.url);
      const periodId = url.searchParams.get('periodId');
      
      let periodFilter = '';
      let periodParams: any[] = [];
      
      if (periodId && periodId !== 'all') {
        periodFilter = 'WHERE ep.academic_period_id = ?';
        periodParams = [periodId];
      }

      const totalUsersResult: any = await query('SELECT COUNT(*) as count FROM users');
      const totalUsers = totalUsersResult[0]?.count || 0;

      const totalCoursesResult: any = await query('SELECT COUNT(*) as count FROM courses');
      const totalCourses = totalCoursesResult[0]?.count || 0;

      const totalEvaluationsResult: any = await query('SELECT COUNT(*) as count FROM evaluations');
      const totalEvaluations = totalEvaluationsResult[0]?.count || 0;

      const submittedEvaluationsResult: any = await query('SELECT COUNT(*) as count FROM evaluations WHERE status = "submitted"');
      const submittedEvaluations = submittedEvaluationsResult[0]?.count || 0;

      const evaluationRate = totalEvaluations > 0 
        ? Math.round((submittedEvaluations / totalEvaluations) * 100 * 10) / 10 
        : 0;

      // breakdown by role
      const roleCounts: any = await query('SELECT role, COUNT(*) as count FROM users GROUP BY role');
      const totalStudents = roleCounts.find((r: any) => r.role === 'student')?.count || 0;
      const totalTeachers = roleCounts.find((r: any) => r.role === 'teacher')?.count || 0;

      // performance trend by month
      const trendQuery = `
        SELECT DATE_FORMAT(e.submitted_at, '%Y-%m') as period, AVG(er.rating) as avg_score
        FROM evaluation_responses er
        JOIN evaluations e ON er.evaluation_id = e.id
        LEFT JOIN evaluation_periods ep ON e.period_id = ep.id
        WHERE e.status = 'submitted' AND e.submitted_at IS NOT NULL
        ${periodId && periodId !== 'all' ? 'AND ep.academic_period_id = ?' : ''}
        GROUP BY DATE_FORMAT(e.submitted_at, '%Y-%m')
        ORDER BY period
      `;
      const trendResult: any = await query(trendQuery, periodParams);
      const performanceTrend = (trendResult || []).map((r: any) => ({ period: r.period, score: Number.parseFloat(r.avg_score) }));

      // program completion by academic year
      const programQuery = `
        SELECT c.academic_year as program,
                COUNT(*) as total,
                SUM(e.status = 'submitted') as completed
         FROM evaluations e
         JOIN courses c ON e.course_id = c.id
         LEFT JOIN evaluation_periods ep ON e.period_id = ep.id
         ${periodId && periodId !== 'all' ? 'WHERE ep.academic_period_id = ?' : ''}
         GROUP BY c.academic_year
      `;
      const programResult: any = await query(programQuery, periodParams);
      const programCompletion = (programResult || []).map((r: any) => ({
        name: r.program,
        students: r.total,
        completion: r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0,
      }));

      // active evaluation period
      const activePeriodResult: any = await query('SELECT * FROM evaluation_periods WHERE status = "active" LIMIT 1');
      const activePeriod = activePeriodResult[0] || null;

      // calculate top performing instructors by average rating
      // Joins through evaluation_periods to filter by academic_period_id if provided
      const instructorsQuery = `
        SELECT u.id, u.name, AVG(er.rating) as avg_score
        FROM users u
        LEFT JOIN evaluations e ON u.id = e.evaluatee_id 
             AND e.status = 'submitted'
             ${periodId && periodId !== 'all' ? 'AND e.period_id IN (SELECT id FROM evaluation_periods WHERE academic_period_id = ?)' : ''}
        LEFT JOIN evaluation_responses er ON e.id = er.evaluation_id
        WHERE u.role = 'teacher'
        GROUP BY u.id, u.name
        ORDER BY avg_score DESC
      `;
      const instructorsResult: any = await query(instructorsQuery, periodParams);
      const topInstructors = (instructorsResult || []).map((r: any, idx: number) => ({
        rank: idx + 1,
        instructor: { name: r.name },
        overallScore: Number.parseFloat(r.avg_score || 0).toFixed(2),
      }));

      analytics = {
        totalUsers,
        totalCourses,
        totalEvaluations,
        submittedEvaluations,
        evaluationRate,
        totalStudents,
        totalTeachers,
        performanceTrend,
        programCompletion,
        activePeriod,
        topInstructors,
      };
    }

    return NextResponse.json({
      success: true,
      analytics,
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
