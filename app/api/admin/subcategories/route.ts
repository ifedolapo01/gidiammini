import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/auth';

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    if (!body.name || !body.slug || !body.category_slug) {
      return NextResponse.json(
        { success: false, error: 'Name, slug and category_slug are required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const subcategoryData = {
      name: body.name,
      slug: body.slug,
      category_slug: body.category_slug,
    };
    
    const { data, error } = await supabase
      .from('subcategories')
      .insert([subcategoryData])
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, subcategory: data, message: 'Subcategory created successfully' });
  } catch (error: any) {
    console.error('Error creating subcategory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subcategory', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Subcategory ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const { error } = await supabase
      .from('subcategories')
      .delete()
      .eq('id', body.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'Subcategory deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting subcategory:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete subcategory', details: error.message },
      { status: 500 }
    );
  }
}
