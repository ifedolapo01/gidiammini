// app/api/admin/alerts/pending-change-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { verifyAdminAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  if (!(await verifyAdminAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();

    const { count: pendingCount, error: countError } = await supabase
      .from('order_change_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    if (countError) {
      console.error('Error counting pending change requests:', countError);
      return NextResponse.json({ success: false, pendingCount: 0 });
    }

    return NextResponse.json({ success: true, pendingCount: pendingCount || 0 });

  } catch (error: any) {
    console.error('Error fetching pending change requests:', error);
    return NextResponse.json(
      { success: false, pendingCount: 0, error: error.message },
      { status: 500 }
    );
  }
}
