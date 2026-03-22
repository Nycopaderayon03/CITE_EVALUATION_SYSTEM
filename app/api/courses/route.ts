import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';



export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const decoded: any = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const isHistory = url.searchParams.get('history') === 'true';

    // Get courses for the user based on their role
    let courses: any;
    
    if (decoded.role === 'teacher') {
      // Teachers see their own courses
      courses = await query(
        `SELECT c.id, c.name, c.code, c.semester, c.description, c.section, c.teacher_id, c.is_archived,
                COUNT(e.id) as student_count
         FROM courses c
         LEFT JOIN course_enrollments e ON c.id = e.course_id
         WHERE c.teacher_id = ? ${isHistory ? '' : 'AND c.is_archived = 0'}
         GROUP BY c.id`,
        [decoded.userId]
      );
    } else if (decoded.role === 'student') {
      // Students see their enrolled courses
      courses = await query(
        `SELECT c.id, c.name, c.code, c.semester, c.description, c.section, c.teacher_id, c.is_archived,
                u.name as teacher_name
         FROM courses c
         INNER JOIN course_enrollments e ON c.id = e.course_id
         LEFT JOIN users u ON c.teacher_id = u.id
         WHERE e.student_id = ? ${isHistory ? '' : 'AND c.is_archived = 0'}
         GROUP BY c.id`,
        [decoded.userId]
      );
    } else if (decoded.role === 'dean') {
      // Dean sees all courses
      courses = await query(
        `SELECT c.id, c.name, c.code, c.semester, c.description, c.section, c.teacher_id, c.is_archived,
                c.course_program, c.year_level,
                u.name as teacher_name,
                COUNT(e.id) as student_count
         FROM courses c
         LEFT JOIN users u ON c.teacher_id = u.id
         LEFT JOIN course_enrollments e ON c.id = e.course_id
         ${isHistory ? '' : 'WHERE c.is_archived = 0'}
         GROUP BY c.id`
      );
    }

    // Format response
    const formattedCourses = (courses || []).map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      teacher_id: c.teacher_id,
      instructor_id: c.teacher_id,
      instructor_name: c.teacher_name || 'Unknown',
      semester: c.semester,
      description: c.description,
      section: c.section || '',
      student_count: c.student_count || 0,
      course_program: c.course_program || null,
      year_level: c.year_level || null,
      is_archived: c.is_archived || 0,
    }));

    return NextResponse.json({
      success: true,
      courses: formattedCourses,
    });
  } catch (error) {
    console.error('Get courses error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

// PATCH updates to a course (assignment, section, semester, etc.)
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

    // only dean or admin may change assignments
    if (decoded.role !== 'dean' && decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, instructor_id, section, semester } = body;
    if (!id) {
      return NextResponse.json({ error: 'Course id required' }, { status: 400 });
    }

    const updates: string[] = [];
    const values: any[] = [];
    if (instructor_id !== undefined) {
      updates.push('teacher_id = ?');
      values.push(instructor_id);
    }
    if (section !== undefined) {
      updates.push('section = ?');
      values.push(section);
    }
    if (semester !== undefined) {
      updates.push('semester = ?');
      values.push(semester);
    }
    if (updates.length === 0) {
      return NextResponse.json({ success: true, message: 'No changes' });
    }

    values.push(id);
    await query(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, values);
    const updated: any = await queryOne('SELECT * FROM courses WHERE id = ?', [id]);
    return NextResponse.json({ success: true, course: updated });
  } catch (error) {
    console.error('Patch courses error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
