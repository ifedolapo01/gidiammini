import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/auth';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, discounts: data });
  } catch (error: any) {
    console.error('Error fetching discounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discounts', details: error.message },
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
    
    if (!body.name || !body.type || !body.value || !body.scope) {
      return NextResponse.json(
        { success: false, error: 'Name, type, value and scope are required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const discountData = {
      name: body.name,
      type: body.type, // 'PERCENTAGE' or 'FIXED'
      value: Number(body.value),
      scope: body.scope, // 'SITEWIDE', 'CATEGORY', 'SUBCATEGORY', 'PRODUCT'
      target_id: body.target_id || null, // Optional target identifier
      is_active: body.is_active ?? true,
      start_date: body.start_date || null,
      end_date: body.end_date || null
    };
    
    const { data, error } = await supabase
      .from('discounts')
      .insert([discountData])
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, discount: data, message: 'Discount created successfully' });
  } catch (error: any) {
    console.error('Error creating discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create discount', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    
    if (!body.id) {
      return NextResponse.json(
        { success: false, error: 'Discount ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const updateData = {
      name: body.name,
      type: body.type,
      value: Number(body.value),
      scope: body.scope,
      target_id: body.target_id,
      is_active: body.is_active,
      start_date: body.start_date,
      end_date: body.end_date
    };
    
    const { data, error } = await supabase
      .from('discounts')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, discount: data, message: 'Discount updated successfully' });
  } catch (error: any) {
    console.error('Error updating discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update discount', details: error.message },
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
        { success: false, error: 'Discount ID is required' },
        { status: 400 }
      );
    }
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    
    const { error } = await supabase
      .from('discounts')
      .delete()
      .eq('id', body.id);
    
    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'Discount deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting discount:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete discount', details: error.message },
      { status: 500 }
    );
  }
}
