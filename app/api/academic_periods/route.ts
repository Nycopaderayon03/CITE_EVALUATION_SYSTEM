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
    return null;
  }
}

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

    // only dean can access
    if (decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const periods: any = await query('SELECT * FROM academic_periods ORDER BY start_date DESC');
    return NextResponse.json({ success: true, periods });
  } catch (error) {
    console.error('Academic periods GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = await verifyToken(token);
    if (!decoded || decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { name, academic_year, semester, start_date, end_date, is_active } = body;
    if (!name || !academic_year || !semester || !start_date || !end_date) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // if is_active is true, deactivate others and close their evaluation periods
    if (is_active) {
      // Find the currently active academic period before deactivating
      const oldActive: any = await queryOne('SELECT id FROM academic_periods WHERE is_active = TRUE');
      await query('UPDATE academic_periods SET is_active = FALSE');

      // Close evaluation periods and lock pending evaluations from the old academic period
      if (oldActive) {
        const openPeriods: any = await query(
          `SELECT id FROM evaluation_periods WHERE academic_period_id = ? AND status != 'closed'`,
          [oldActive.id]
        );
        for (const ep of (openPeriods || [])) {
          await query(`UPDATE evaluation_periods SET status = 'closed' WHERE id = ?`, [ep.id]);
          await query(
            `UPDATE evaluations SET status = 'locked' WHERE period_id = ? AND status = 'pending'`,
            [ep.id]
          );
        }
      }
    }

    const result: any = await query(
      `INSERT INTO academic_periods (name, academic_year, semester, start_date, end_date, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, academic_year, semester, start_date, end_date, is_active ? 1 : 0]
    );
    const inserted = await queryOne('SELECT * FROM academic_periods WHERE id = ?', [result.insertId]);
    return NextResponse.json({ success: true, period: inserted });
  } catch (error) {
    console.error('Academic periods POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = await verifyToken(token);
    if (!decoded || decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // build set clause
    const fields = Object.keys(updates);
    if (fields.length === 0) {
      return NextResponse.json({ success: true });
    }
    if (updates.is_active) {
      // Find the currently active academic period before deactivating
      const oldActive: any = await queryOne(
        'SELECT id FROM academic_periods WHERE is_active = TRUE AND id != ?',
        [id]
      );
      await query('UPDATE academic_periods SET is_active = FALSE');

      // Close evaluation periods and lock pending evaluations from the old academic period
      if (oldActive) {
        const openPeriods: any = await query(
          `SELECT id FROM evaluation_periods WHERE academic_period_id = ? AND status != 'closed'`,
          [oldActive.id]
        );
        for (const ep of (openPeriods || [])) {
          await query(`UPDATE evaluation_periods SET status = 'closed' WHERE id = ?`, [ep.id]);
          await query(
            `UPDATE evaluations SET status = 'locked' WHERE period_id = ? AND status = 'pending'`,
            [ep.id]
          );
        }
      }
    }

    if (updates.is_archived === 0) {
      const pToUnlock: any = await queryOne('SELECT * FROM academic_periods WHERE id = ?', [id]);
      if (pToUnlock) {
        await query('UPDATE courses SET is_archived = 0 WHERE academic_year = ? AND semester = ?', [pToUnlock.academic_year, pToUnlock.semester]);
        await query('UPDATE evaluation_periods SET status = \'active\' WHERE academic_period_id = ? AND status = \'closed\'', [id]);
        await query('UPDATE evaluations SET is_archived = 0 WHERE period_id IN (SELECT id FROM evaluation_periods WHERE academic_period_id = ?)', [id]);
        await query('UPDATE evaluations SET status = \'pending\' WHERE status = \'locked\' AND period_id IN (SELECT id FROM evaluation_periods WHERE academic_period_id = ?)', [id]);
        await query('UPDATE comments SET is_archived = 0 WHERE created_at >= ? AND created_at <= ?', [pToUnlock.start_date, pToUnlock.end_date]);
      }
    }

    const sets = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => (updates as any)[f]);
    values.push(id);
    await query(`UPDATE academic_periods SET ${sets} WHERE id = ?`, values);
    const updated = await queryOne('SELECT * FROM academic_periods WHERE id = ?', [id]);
    return NextResponse.json({ success: true, period: updated });
  } catch (error) {
    console.error('Academic periods PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const decoded: any = await verifyToken(token);
    if (!decoded || decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param required' }, { status: 400 });
    }

    // Deep cascade: Delete all evaluation responses linked to evaluations inside this academic period
    await query(
      `DELETE er FROM evaluation_responses er
       JOIN evaluations e ON er.evaluation_id = e.id
       JOIN evaluation_periods ep ON e.period_id = ep.id
       WHERE ep.academic_period_id = ?`,
      [id]
    );

    // Deep cascade: Delete evaluations inside this academic period
    await query(
      `DELETE e FROM evaluations e
       JOIN evaluation_periods ep ON e.period_id = ep.id
       WHERE ep.academic_period_id = ?`,
      [id]
    );

    // Deep cascade: Delete evaluation periods linked to this academic period
    await query('DELETE FROM evaluation_periods WHERE academic_period_id = ?', [id]);

    // Finally, delete the academic period itself
    await query('DELETE FROM academic_periods WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Academic periods DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}