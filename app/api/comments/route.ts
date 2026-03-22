import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

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
  } catch (err) {
    return null;
  }
}

// GET /api/comments?entity_type=course&entity_id=course-1
export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const entityType = url.searchParams.get('entity_type');
    const entityId = url.searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    let sqlQuery = 'SELECT c.id, c.entity_type, c.entity_id, c.author_id, u.name as author_name, u.role as author_role, c.content, c.rating, c.created_at FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.entity_type = ? AND c.entity_id = ?';
    if (decoded.role !== 'dean') {
      sqlQuery += ' AND c.is_archived = 0';
    }
    sqlQuery += ' ORDER BY c.created_at DESC';

    const rows: any = await query(sqlQuery, [entityType, entityId]);

    return NextResponse.json({ success: true, comments: rows });
  } catch (err) {
    console.error('Get comments error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// POST create a comment: { entity_type, entity_id, content, rating? }
export async function POST(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { entity_type, entity_id, content, rating } = body;
    if (!entity_type || !entity_id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const id = uuidv4();
    await query('INSERT INTO comments (id, entity_type, entity_id, author_id, content, rating) VALUES (?, ?, ?, ?, ?, ?)', [id, entity_type, entity_id, decoded.userId, content, rating || null]);

    const inserted: any = await query('SELECT c.id, c.entity_type, c.entity_id, c.author_id, u.name as author_name, c.content, c.rating, c.created_at FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?', [id]);

    return NextResponse.json({ success: true, comment: inserted[0] }, { status: 201 });
  } catch (err) {
    console.error('Create comment error:', err);
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}

// PATCH update a comment: { id, content, rating }
export async function PATCH(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { id, content, rating } = body;
    if (!id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const existing: any = await query('SELECT author_id FROM comments WHERE id = ?', [id]);
    if (!existing || existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const authorId = existing[0].author_id;
    if (decoded.userId !== authorId && decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await query('UPDATE comments SET content = ?, rating = ? WHERE id = ?', [content, rating || null, id]);

    const updated: any = await query('SELECT c.id, c.entity_type, c.entity_id, c.author_id, u.name as author_name, c.content, c.rating, c.created_at FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?', [id]);

    return NextResponse.json({ success: true, comment: updated[0] });
  } catch (err) {
    console.error('Update comment error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE /api/comments?id=<id>
export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const existing: any = await query('SELECT author_id FROM comments WHERE id = ?', [id]);
    if (!existing || existing.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const authorId = existing[0].author_id;
    if (decoded.userId !== authorId && decoded.role !== 'dean') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await query('DELETE FROM comments WHERE id = ?', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Delete comment error:', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
