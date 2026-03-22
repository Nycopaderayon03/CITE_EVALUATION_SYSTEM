import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getAuthToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// Remove local verifyToken function as it is now imported
// async function verifyToken(token: string) { ... }

export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Dean sees all; others see only active
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const filterId = url.searchParams.get('id');

    let queryStr = `SELECT ep.*, ef.type as form_type
     FROM evaluation_periods ep
     LEFT JOIN evaluation_forms ef ON ep.form_id = ef.id`;
    const params: any[] = [];
    const conditions: string[] = [];

    if (filterId) {
      conditions.push('ep.id = ?');
      params.push(filterId);
    }

    if (decoded.role !== 'dean') {
      conditions.push("ep.status = 'active'");
    } else if (status) {
      conditions.push('ep.status = ?');
      params.push(status);
    }

    if (conditions.length > 0) {
      queryStr += ' WHERE ' + conditions.join(' AND ');
    }

    queryStr += ' ORDER BY ep.start_date DESC';

    const periods: any = await query(queryStr, params);
    return NextResponse.json({ success: true, periods });
  } catch (error) {
    console.error('Eval periods GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = verifyToken(token);
    if (!decoded || decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { name, start_date, end_date, status, form_id, academic_period_id, academic_year, semester, assignments_json } = body;
    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if ((!start_date || !end_date) && status !== 'draft') {
      return NextResponse.json({ error: 'Start and end dates are required for non-draft periods' }, { status: 400 });
    }
    const result: any = await query(
      `INSERT INTO evaluation_periods (name, start_date, end_date, status, form_id, academic_period_id, academic_year, semester, assignments_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, start_date || '1970-01-01', end_date || '1970-01-01', status || 'upcoming', form_id || null, academic_period_id || null, academic_year || null, semester || null, assignments_json || null]
    );
    const inserted = await queryOne('SELECT * FROM evaluation_periods WHERE id = ?', [result.insertId]);
    return NextResponse.json({ success: true, period: inserted });
  } catch (error) {
    console.error('Eval periods POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ['active', 'upcoming'],
  upcoming: ['active', 'draft'],
  active: ['closed'],
  closed: ['active'],
};

export async function PATCH(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = verifyToken(token);
    if (!decoded || decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const current: any = await queryOne('SELECT status, form_id FROM evaluation_periods WHERE id = ?', [id]);
    if (!current) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }

    // Reject form_id changes on non-draft periods to prevent breaking existing evaluations
    // Allow sending the same form_id (redundant/no-op) so full-payload updates don't fail
    if (updates.form_id !== undefined && current.status !== 'draft') {
      if (String(updates.form_id) !== String(current.form_id)) {
        return NextResponse.json(
          { error: 'Cannot change the evaluation form after the period has left draft status.' },
          { status: 400 }
        );
      }
    }

    // Validate status transition if status is being changed
    if (updates.status && updates.status !== current.status) {
      const allowed = VALID_TRANSITIONS[current.status] || [];
      if (!allowed.includes(updates.status)) {
        return NextResponse.json(
          { error: `Cannot change status from '${current.status}' to '${updates.status}'. Allowed: ${allowed.join(', ') || 'none'}` },
          { status: 400 }
        );
      }
    }

    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return NextResponse.json({ success: true });
    }
    const sets = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      if (f === 'assignments_json' && typeof (updates as any)[f] === 'object') {
        return JSON.stringify((updates as any)[f]);
      }
      return (updates as any)[f];
    });
    values.push(id);
    await query(`UPDATE evaluation_periods SET ${sets} WHERE id = ?`, values);

    // Cascading child updates: lock/unlock pending evaluations depending on the parent period's status
    if (updates.status === 'closed') {
      // Lock any pending evaluations so targets can no longer access them
      await query("UPDATE evaluations SET status = 'locked' WHERE period_id = ? AND status = 'pending'", [id]);
    } else if (updates.status === 'active') {
      // If reopening, drop untouched locked evaluations back to pending
      await query("UPDATE evaluations SET status = 'pending' WHERE period_id = ? AND status = 'locked'", [id]);
    }

    const updated = await queryOne('SELECT * FROM evaluation_periods WHERE id = ?', [id]);
    return NextResponse.json({ success: true, period: updated });
  } catch (error) {
    console.error('Eval periods PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = verifyToken(token);
    if (!decoded || decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    // Block deletion of active periods — must close first
    const period: any = await queryOne('SELECT status FROM evaluation_periods WHERE id = ?', [id]);
    if (!period) {
      return NextResponse.json({ error: 'Period not found' }, { status: 404 });
    }
    if (period.status === 'active') {
      return NextResponse.json({ error: 'Cannot delete an active period. Close it first.' }, { status: 400 });
    }

    // Cascade-delete: responses → evaluations → period
    await query(
      `DELETE er FROM evaluation_responses er
       JOIN evaluations e ON er.evaluation_id = e.id
       WHERE e.period_id = ?`,
      [id]
    );
    await query('DELETE FROM evaluations WHERE period_id = ?', [id]);
    await query('DELETE FROM evaluation_periods WHERE id = ?', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Eval periods DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}