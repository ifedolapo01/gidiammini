// app/api/admin/products/route.ts - UPDATED FOR COMPLETE CRUD
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyAdminAuth } from '@/lib/auth';

export const maxDuration = 30;

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📱 Fetching all products');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
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
    
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return NextResponse.json(
      { 
        success: true, 
        products: data
      },
      { headers }
    );
    
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch products',
        details: error.message 
      },
      { status: 500, headers }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📱 Creating new product');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
    const body = await request.json();
    
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
    
    // Validate
    if (!body.name || !body.price || !body.main_image) {
      return NextResponse.json(
        { success: false, error: 'Product name, price, and image are required' },
        { status: 400, headers }
      );
    }
    
    // Prepare data
    const productData = {
      name: body.name.substring(0, 100),
      description: (body.description || '').substring(0, 500),
      price: Number(body.price),
      category: body.category || 'babies',
      main_image: body.main_image || '',
      images: body.images || [],
      colors: body.colors || [],
      sizes: body.sizes || [],
      details: body.details || [],
      sub_category: body.sub_category || null,
      stock: Number(body.stock) || 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Creating product:', productData.name);
    
    // Insert product
    const { data, error } = await supabase
      .from('products')
      .insert([productData])
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Product created:', data.id);
    
    return NextResponse.json(
      { 
        success: true, 
        product: data,
        message: 'Product created successfully'
      },
      { headers }
    );
    
  } catch (error: any) {
    console.error('❌ Product creation error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create product',
        details: error.message 
      },
      { status: 500, headers }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📱 Updating product');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
    const body = await request.json();
    
    if (!body.id) {
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
    
    // Prepare update data
    const updateData = {
      name: body.name.substring(0, 100),
      description: (body.description || '').substring(0, 500),
      price: Number(body.price),
      category: body.category || 'babies',
      main_image: body.main_image,
      images: body.images || [],
      colors: body.colors || [],
      sizes: body.sizes || [],
      details: body.details || [],
      sub_category: body.sub_category || null,
      stock: Number(body.stock) || 0,
      updated_at: new Date().toISOString()
    };
    
    // Update product
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', body.id)
      .select()
      .single();
    
    if (error) throw error;
    
    console.log('✅ Product updated:', body.id);
    
    return NextResponse.json(
      { 
        success: true, 
        product: data,
        message: 'Product updated successfully'
      },
      { headers }
    );
    
  } catch (error: any) {
    console.error('❌ Product update error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update product',
        details: error.message 
      },
      { status: 500, headers }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('📱 Deleting product');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  try {
    const body = await request.json();
    
    if (!body.id) {
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
    
    // Soft delete (set is_active to false)
    const { error } = await supabase
      .from('products')
      .update({ 
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', body.id);
    
    if (error) throw error;
    
    console.log('✅ Product deleted:', body.id);
    
    return NextResponse.json(
      { 
        success: true,
        message: 'Product deleted successfully'
      },
      { headers }
    );
    
  } catch (error: any) {
    console.error('❌ Product deletion error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete product',
        details: error.message 
      },
      { status: 500, headers }
    );
  }
}