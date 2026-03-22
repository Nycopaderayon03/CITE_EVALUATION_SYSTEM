import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

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
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

async function verifyToken(token: string) {
  try {
    const jwtLib = await loadJWT();
    const decoded = jwtLib.verify(token, process.env.JWT_SECRET as string);
    return decoded;
  } catch (error) {
    if (error) console.debug('JWT error');
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = await verifyToken(token);
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
