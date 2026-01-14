// app/api/test/[id]/route.ts - NEW FILE
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log('Test route - ID received:', id);
    
    return NextResponse.json({
      success: true,
      message: 'Dynamic route test successful',
      id,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Test route error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}