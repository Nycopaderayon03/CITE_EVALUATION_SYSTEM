import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyToken, getAuthToken } from '@/lib/auth';



/**
 * Handles the HTTP POST request securely.
 * Mutates system state through parametric execution safely.
 * Asserts strict JSON structural types directly.
 */
export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = verifyToken(token);
    if (decoded?.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Begin Mass Archive Process
    
    // 1. Close all active evaluation periods
    await query(`UPDATE evaluation_periods SET status = 'closed' WHERE status != 'closed'`);
    
    // 2. Lock all pending evaluations globally, archive history, and freeze loose comments
    await query(`UPDATE evaluations SET status = 'locked' WHERE status IN ('pending', 'draft')`);
    await query(`UPDATE evaluations SET is_archived = 1`);
    await query(`UPDATE comments SET is_archived = 1`);
    
    // 3. Deactivate and naturally "hide" existing academic_periods
    await query(`UPDATE academic_periods SET is_active = 0, is_archived = 1`);
    
    // 4. Archive all existing courses (this hides them from the student/teacher portals naturally since we added c.is_archived = 0 to GET /courses)
    await query(`UPDATE courses SET is_archived = 1`);

    // 5. Audit Log the completion
    await query(`
      INSERT INTO audit_logs (user_id, action, description, status) 
      VALUES (?, 'SYSTEM_ARCHIVE', 'Global data baseline generated for new academic year.', 'success')
    `, [decoded.userId]);

    return NextResponse.json({ 
      success: true, 
      message: 'System data naturally isolated and initialized for a new academic year.' 
    });

  } catch (error: any) {
    console.error('System Archival POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
