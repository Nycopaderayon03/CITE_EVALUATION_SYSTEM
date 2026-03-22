import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from '@/lib/auth';


function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
}

async function verifyCaptcha(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const secret = process.env.RECAPTCHA_SECRET_KEY as string;
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${secret}&response=${token}`
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error('CAPTCHA verification error:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  const clientIp = getClientIp(request);
  const userAgent = request.headers.get('user-agent') || '';

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'email-login') {
      return await handleEmailLogin(body, clientIp, userAgent);
    }



    if (action === 'signup') {
      return await handleSignup(body, clientIp, userAgent);
    }

    if (action === 'logout') {
      return await handleLogout(body, clientIp, userAgent);
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleEmailLogin(
  body: any,
  clientIp: string,
  userAgent: string
) {
  try {
    const { email, password, captchaToken } = body;
    console.log('Login attempt:', { email });

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const isHuman = await verifyCaptcha(captchaToken);
    if (!isHuman) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // Query database for user
    const users = await query(
      'SELECT id, name, email, role, course, year_level, section FROM users WHERE email = ? AND password = ?',
      [email, password] // TODO: Use bcrypt for password hashing in production
    ) as any[];
    console.log('User query result:', users);

    if (users.length === 0) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const user = users[0];
    const token = await generateToken(String(user.id), user.role);
    
    // Log login to audit
    await query(
      'INSERT INTO audit_logs (user_id, action, description, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, 'LOGIN', 'User login via email', clientIp, userAgent, 'success']
    );

    // Create session record
    await query(
      'INSERT INTO sessions (user_id, token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
      [user.id, token, clientIp, userAgent]
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        course: user.course,
        year_level: user.year_level,
        section: user.section,
      },
      token,
    });
  } catch (error) {
    console.error('Email login error:', error);
    return NextResponse.json(
      { error: 'Login failed', details: String(error) },
      { status: 500 }
    );
  }
}


async function handleSignup(
  body: any,
  clientIp: string,
  userAgent: string
) {
  try {
    const { firstName, lastName, email, password, role, course, jmcId, yearLevel, section, captchaToken } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !role || (role === 'student' && !course) || !jmcId) {
      return NextResponse.json(
        { error: 'All fields are required' },
        { status: 400 }
      );
    }

    const isHuman = await verifyCaptcha(captchaToken);
    if (!isHuman) {
      return NextResponse.json(
        { error: 'reCAPTCHA verification failed. Please try again.' },
        { status: 400 }
      );
    }

    // Combine first and last name
    const name = `${firstName} ${lastName}`;

    // Validate role
    if (!['student', 'teacher'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be "student" or "teacher"' },
        { status: 400 }
      );
    }

    // Verify email domain
    if (!email.endsWith('@jmc.edu.ph')) {
      return NextResponse.json(
        { error: 'Please use your official JMC institutional email' },
        { status: 400 }
      );
    }

    // Check if email already exists
    const existingUser: any = await queryOne(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Create user ID
    const userId = uuidv4();

    // Insert user into database
    if (role === 'student') {
      await query(
        'INSERT INTO users (id, name, email, course, year_level, section, password, role, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)',
        [userId, name, email, course, yearLevel ? Number(yearLevel) : null, section || null, password, role]
      );
    } else {
      await query(
        'INSERT INTO users (id, name, email, password, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
        [userId, name, email, password, role]
      );
    }

    // Log signup to audit
    await query(
      'INSERT INTO audit_logs (user_id, action, description, ip_address, user_agent, status) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, 'SIGNUP', `User signed up as ${role}`, clientIp, userAgent, 'success']
    );

    // Generate token for auto-login
    const token = await generateToken(userId, role);

    return NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: {
        id: userId,
        name: name,
        email: email,
        role: role,
        course: course || null,
      },
      token: token,
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Signup failed', details: String(error) },
      { status: 500 }
    );
  }
}

async function handleLogout(
  body: any,
  clientIp: string,
  userAgent: string
) {
  try {
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Demo mode - accept logout
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed', details: String(error) },
      { status: 500 }
    );
  }
}
