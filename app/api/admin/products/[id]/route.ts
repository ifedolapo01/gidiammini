// app/api/admin/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📱 Fetching single product');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
    const { id } = await params;
    
    console.log('Product ID from params:', id);
    
    if (!id || id === 'undefined') {
      return NextResponse.json(
        { success: false, error: 'Product ID is required' },
        { status: 400, headers }
      );
    }
    
    // Create client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
    
    // Get product
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();
    
    if (error) {
      console.error('Supabase error:', error);
      
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { success: false, error: 'Product not found' },
          { status: 404, headers }
        );
      }
      
      throw error;
    }
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'Product not found' },
        { status: 404, headers }
      );
    }
    
    console.log('✅ Product found:', data.id);
    
    return NextResponse.json(
      { 
        success: true, 
        product: data
      },
      { headers }
    );
    
  } catch (error: any) {
    console.error('Error fetching product:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch product',
        details: error.message 
      },
      { status: 500, headers }
    );
  }
}