import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/auth';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // We can optionally verify auth here, but since categories are public data,
  // we might want this route to be callable by the admin forms easily.
  // We'll keep auth check to ensure only admins use the admin API route.
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    // Fetch categories with their subcategories
    const { data, error } = await supabase
      .from('categories')
      .select('*, subcategories(*)');
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, categories: data });
  } catch (error: any) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch categories', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    if (!body.name || !body.slug) {
      return NextResponse.json(
        { success: false, error: 'Name and slug are required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    // Generate random gradient color if not provided
    const defaultColors = [
      'from-amber-300/80 to-orange-400/90',
      'from-sky-300/80 to-indigo-400/90',
      'from-pink-300/80 to-purple-400/90',
      'from-emerald-300/80 to-teal-400/90',
      'from-fuchsia-300/80 to-rose-400/90',
      'from-violet-300/80 to-purple-500/90'
    ];
    const randomColor = defaultColors[Math.floor(Math.random() * defaultColors.length)];
    
    const categoryData = {
      name: body.name,
      slug: body.slug,
      color: body.color || randomColor,
    };
    
    const { data, error } = await supabase
      .from('categories')
      .insert([categoryData])
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, category: data, message: 'Category created successfully' });
  } catch (error: any) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create category', details: error.message },
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
        { success: false, error: 'Category ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', body.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'Category deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting category:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete category', details: error.message },
      { status: 500 }
    );
  }
}
