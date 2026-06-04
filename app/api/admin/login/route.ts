// app/api/admin/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { signJWT } from '@/lib/auth';
import bcryptjs from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!adminEmail || !adminPasswordHash || !jwtSecret) {
      console.error('Admin configuration missing in environment variables');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }
    
    console.log('--- LOGIN ATTEMPT ---');
    console.log('Input Email:', JSON.stringify(email));
    console.log('Env Email:', JSON.stringify(adminEmail));
    console.log('Password length:', password.length);
    console.log('Hash:', JSON.stringify(adminPasswordHash));

    // Check credentials (use bcrypt comparison)
    const isPasswordValid = await bcryptjs.compare(password, adminPasswordHash);
    
    console.log('Bcrypt matches:', isPasswordValid);
    console.log('Email matches:', email === adminEmail);

    if (email === adminEmail && isPasswordValid) {
      
      const payload = {
        role: 'admin',
        email: email,
        exp: Date.now() + 60 * 60 * 24 * 7 * 1000, // 7 days
      };
      
      const token = await signJWT(payload, jwtSecret);
      
      const response = NextResponse.json({ 
        success: true, 
        message: 'Login successful' 
      });
      
      // Set the cookie
      response.cookies.set('admin-token', token, {
        httpOnly: true,
        secure: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
        sameSite: 'lax',
      });
      
      return response;
    }
    
    return NextResponse.json(
      { success: false, error: 'Invalid credentials' },
      { status: 401 }
    );
    
  } catch (error) {
    console.error('Login failed:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    );
  }
}