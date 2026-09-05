// app/api/admin/worklist/[task]/route.ts — the items behind one worklist
// count.
//
// Called when somebody expands a row in the dashboard's Today panel, and not
// before. The counts arrive with the page (six cheap head-only queries); the
// rows behind them are nine more queries that nobody has asked for yet, so
// they are fetched per task, on demand.
//
// One endpoint rather than nine, because the shape of the answer is the same
// for every task — see types/worklist.ts. Which query a task name means is
// lib/commerce/worklist.ts's table, so a task added there is served here
// without this file changing.
import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/api/with-admin-auth';
import { resolveWorklistTask, WORKLIST_PAGE_SIZE } from '@/lib/commerce/worklist';
import { isWorklistTask } from '@/types/worklist';

const MAX_LIMIT = 25;

export const GET = withAdminAuth(async (request, { supabase, params }) => {
  const { task } = await params;

  // The task comes straight off the URL, so it is checked against the known
  // vocabulary rather than looked up optimistically.
  if (!isWorklistTask(task)) {
    return NextResponse.json({ success: false, error: 'Unknown worklist task' }, { status: 404 });
  }

  const requested = Number(new URL(request.url).searchParams.get('limit'));
  const limit = Math.min(requested > 0 ? requested : WORKLIST_PAGE_SIZE, MAX_LIMIT);

  try {
    const result = await resolveWorklistTask(supabase, task, limit);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error(`Could not resolve worklist task ${task}:`, error);
    return NextResponse.json(
      { success: false, error: 'Could not load these items.' },
      { status: 500 }
    );
  }
});
