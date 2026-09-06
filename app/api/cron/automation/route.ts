// app/api/cron/automation/route.ts — the one scheduled worker.
//
// Runs every active rule in automation_rules. The point of it is that the next
// automation is a row rather than another file in this directory: there are
// already six crons here, each with its own schedule, its own auth check and
// its own private way of remembering what it did.
//
// failClosed, unlike the promotional jobs. A rule can cancel an order, so an
// unauthenticated call to this URL must not be able to run the set — the worst
// an anonymous call to the discounts job achieves is mail that was going out
// anyway, which is not true here.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin-server';
import { authorizeCron } from '@/lib/api/cron-auth';
import { runAutomationRules } from '@/lib/commerce/automation/engine';

// Rules email and move orders, so a run is bounded by network calls rather
// than by queries. Matches the other sending crons.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const denied = authorizeCron(req, { failClosed: true, jobName: 'the automation worker' });
  if (denied) return denied;

  try {
    const reports = await runAutomationRules(createAdminClient());

    const acted = reports.reduce((sum, report) => sum + report.acted, 0);
    const failed = reports.reduce((sum, report) => sum + report.failed, 0);

    return NextResponse.json({
      // False when anything failed, so a monitoring check on this endpoint
      // notices a rule that has started erroring rather than reading "success"
      // over a run that did nothing but fail.
      success: failed === 0,
      message: `Ran ${reports.length} rule${reports.length === 1 ? '' : 's'}: ${acted} action${acted === 1 ? '' : 's'} taken, ${failed} failed.`,
      reports,
    });
  } catch (error: any) {
    console.error('Automation worker error:', error);
    return NextResponse.json(
      { success: false, error: 'The automation worker could not run.', details: error.message },
      { status: 500 }
    );
  }
}
