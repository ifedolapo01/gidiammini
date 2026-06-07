import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const revalidate = 60; // Cache for 60 seconds

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // We use anon key for public data
    const supabase = createClient(supabaseUrl, supabaseAnonKey, { 
      auth: { persistSession: false } 
    });
    
    // Fetch all active discounts. We let the client decide if they are upcoming, current, or expired.
    // Expired discounts where end_date < now() could be filtered out here, but we'll fetch them and filter on the client
    // or filter out ones that ended more than 2 days ago to be safe.
    
    const { data, error } = await supabase
      .from('discounts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const now = new Date();
    
    // Filter out discounts that ended more than 1 day ago
    const relevantDiscounts = data.filter(d => {
      if (!d.end_date) return true;
      const endDate = new Date(d.end_date);
      // Give a 24 hour buffer just in case
      endDate.setHours(endDate.getHours() + 24);
      return endDate >= now;
    });
    
    return NextResponse.json({ success: true, discounts: relevantDiscounts });
  } catch (error: any) {
    console.error('Error fetching public discounts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch discounts' },
      { status: 500 }
    );
  }
}
