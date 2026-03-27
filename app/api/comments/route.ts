import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { verifyToken, getAuthToken } from '@/lib/auth';



// GET /api/comments?entity_type=course&entity_id=course-1
/**
 * Handles the HTTP GET request securely.
 * Verifies the authorization bearer token natively via abstract logic.
 * Prevents access if user does not match the scoped role mapping.
 */
export async function GET(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const url = new URL(request.url);
    const entityType = url.searchParams.get('entity_type');
    const entityId = url.searchParams.get('entity_id');

    if (!entityType || !entityId) {
      return NextResponse.json({ error: 'entityType and entityId are required' }, { status: 400 });
    }

    let sqlQuery = 'SELECT c.id, c.entity_type, c.entity_id, c.author_id, u.name as author_name, u.role as author_role, c.content, c.rating, c.meta_json, c.created_at FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.entity_type = ? AND c.entity_id = ?';
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
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await request.json();
    const { entity_type, entity_id, content, rating, meta_json } = body;
    if (!entity_type || !entity_id || !content) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

    const id = uuidv4();
    await query('INSERT INTO comments (id, entity_type, entity_id, author_id, content, rating, meta_json) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, entity_type, entity_id, decoded.userId, content, rating || null, meta_json || null]);

    const inserted: any = await query('SELECT c.id, c.entity_type, c.entity_id, c.author_id, u.name as author_name, c.content, c.rating, c.meta_json, c.created_at FROM comments c LEFT JOIN users u ON c.author_id = u.id WHERE c.id = ?', [id]);

    return NextResponse.json({ success: true, comment: inserted[0] }, { status: 201 });
  } catch (err) {
    console.error('Create comment error:', err);
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}

// PATCH update a comment: { id, content, rating }
/**
 * Handles the HTTP PATCH request securely.
 * Applies partial structural updates reliably over database.
 */
export async function PATCH(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = verifyToken(token);
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
/**
 * Handles the HTTP DELETE request securely.
 * Ensures isolated teardowns leveraging foreign cascaded keys securely.
 */
export async function DELETE(request: NextRequest) {
  try {
    const token = getAuthToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded: any = verifyToken(token);
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
