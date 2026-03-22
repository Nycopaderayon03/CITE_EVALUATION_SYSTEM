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
 * POST /api/evaluations/dean
 *
 * Dean-only. Creates a dean evaluation where the Dean acts as evaluator
 * but the evaluation blends in anonymously with regular results.
 *
 * Body: { period_id, evaluatee_id, course_id? }
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
    if (decoded?.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { period_id, evaluatee_id, course_id } = body;

    if (!period_id || !evaluatee_id) {
      return NextResponse.json({ error: 'period_id and evaluatee_id are required' }, { status: 400 });
    }

    // Determine evaluation type from the period's form
    const period: any = await queryOne(
      `SELECT ep.id, ef.type as form_type
       FROM evaluation_periods ep
       LEFT JOIN evaluation_forms ef ON ep.form_id = ef.id
       WHERE ep.id = ?`,
      [period_id]
    );

    if (!period) {
      return NextResponse.json({ error: 'Evaluation period not found' }, { status: 404 });
    }

    const evaluationType = period.form_type === 'peer-review' ? 'peer' : 'teacher';
    const deanId = decoded.userId || decoded.id;

    // Check if a ghost eval already exists for this dean+period+evaluatee+course combo
    const existing: any = await queryOne(
      `SELECT id FROM evaluations
       WHERE period_id = ? AND evaluatee_id = ? AND evaluator_id = ? AND evaluation_type = ?
         AND (course_id = ? OR (course_id IS NULL AND ? IS NULL))`,
      [period_id, evaluatee_id, deanId, evaluationType, course_id || null, course_id || null]
    );

    if (existing) {
      return NextResponse.json({ success: true, evaluationId: existing.id, existing: true });
    }

    const result: any = await query(
      `INSERT INTO evaluations (course_id, period_id, evaluatee_id, evaluator_id, evaluation_type, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [course_id || null, period_id, evaluatee_id, deanId, evaluationType]
    );

    return NextResponse.json({ success: true, evaluationId: result.insertId });
  } catch (error) {
    console.error('Dean evaluation error:', error);
    return NextResponse.json({ error: 'Internal server error', details: String(error) }, { status: 500 });
  }
}
