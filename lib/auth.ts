import { NextRequest } from 'next/server';

// Helper to encode to Base64URL
function base64urlEncode(str: string): string {
  const bytes = new TextEncoder().encode(str);
  const binString = String.fromCharCode(...bytes);
  return btoa(binString)
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Helper to decode from Base64URL
function base64urlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binString = atob(base64);
  const bytes = new Uint8Array(binString.length);
  for (let i = 0; i < binString.length; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

// Sign JWT using native Web Crypto API
export async function signJWT(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  
  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
    
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Verify JWT using native Web Crypto API
export async function verifyJWT(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const encoder = new TextEncoder();
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const sigBytes = new Uint8Array(
      atob(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'))
        .split('')
        .map(c => c.charCodeAt(0))
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${encodedHeader}.${encodedPayload}`)
    );
    
    if (!isValid) return null;
    
    const payload = JSON.parse(base64urlDecode(encodedPayload));
    
    // Check expiration
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    
    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

// Verify admin auth cookie in NextRequest
export async function verifyAdminAuth(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin-token')?.value;
  if (!token) return false;
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET environment variable is not defined');
    return false;
  }
  
  const payload = await verifyJWT(token, secret);
  return payload !== null && payload.role === 'admin';
}
