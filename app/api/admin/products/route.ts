// app/api/admin/products/route.ts - MOBILE OPTIMIZED
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Increase timeout for mobile
export const maxDuration = 30; // 30 seconds for mobile

export async function POST(request: NextRequest) {
  console.log('📱 Mobile product creation API called');
  
  // Add CORS headers for mobile
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };
  
  try {
    // Handle OPTIONS preflight for CORS
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { status: 200, headers });
    }
    
    // Parse with timeout for mobile
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 25000);
    });
    
    const body = await Promise.race([request.json(), timeoutPromise]) as any;
    
    // Create client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      }
    );
    
    // Validate
    if (!body.name || !body.price) {
      return NextResponse.json(
        { success: false, error: 'Product name and price are required' },
        { status: 400, headers }
      );
    }
    
    // Prepare data
    const productData = {
      name: body.name.substring(0, 100), // Limit length for mobile
      description: (body.description || '').substring(0, 500),
      price: Number(body.price),
      category: body.category || 'men',
      main_image: body.main_image || '',
      images: body.images || [],
      colors: body.colors || [],
      sizes: body.sizes || [],
      details: body.details || [],
      stock: Number(body.stock) || 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('Creating product from mobile:', productData.name);
    
    // Insert with retry for mobile networks
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const { data, error } = await supabase
          .from('products')
          .insert([productData])
          .select()
          .single();
        
        if (error) throw error;
        
        console.log('✅ Mobile product created:', data.id);
        
        return NextResponse.json(
          { 
            success: true, 
            product: data,
            message: 'Product created successfully'
          },
          { headers }
        );
        
      } catch (error: any) {
        lastError = error;
        retries--;
        console.log(`Retry ${3 - retries}/3 failed:`, error.message);
        
        if (retries > 0) {
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // All retries failed
    console.error('❌ All retries failed:', lastError);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Network error. Please check connection and try again.',
        details: lastError?.message 
      },
      { status: 500, headers }
    );
    
  } catch (error: any) {
    console.error('Mobile API error:', error);
    
    let errorMessage = 'Server error';
    if (error.message.includes('timeout')) {
      errorMessage = 'Request timeout. Your connection is slow. Try a smaller image.';
    } else if (error.message.includes('network')) {
      errorMessage = 'Network error. Check your internet connection.';
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        type: 'mobile_error'
      },
      { status: 500, headers }
    );
  }
}