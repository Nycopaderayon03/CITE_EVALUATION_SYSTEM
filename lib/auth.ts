
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET as string;

export interface DecodedToken {
  userId: string;
  role: string;
  id?: string; // Compatibility alias
  iat?: number;
  exp?: number;
}

/**
 * Generates a JWT token for a user
 */
export function generateToken(userId: string, role: string): string {
  return jwt.sign(
    { userId, role, id: userId }, // Includes 'id' for compatibility
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

/**
 * Verifies a JWT token and returns the decoded payload
 */
export function verifyToken(token: string): DecodedToken | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as DecodedToken;
    // Ensure both userId and id are present for compatibility
    if (decoded.userId && !decoded.id) decoded.id = decoded.userId;
    if (decoded.id && !decoded.userId) decoded.userId = decoded.id;
    return decoded;
  } catch (error) {
    if (error) console.debug('JWT error');
    return null;
  }
}

/**
 * Extracts bearer token from NextRequest
 */
export function getAuthToken(request: any): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
