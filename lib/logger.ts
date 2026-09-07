/**
 * CORE layer — the one way server code says something.
 *
 * Everything was console.log / console.error, which gives a platform log
 * collector a wall of unstructured strings: no level to filter on, no request
 * to group by, and — because several of those lines interpolated order numbers
 * and customer names — personal data sitting in a log nobody meant to keep.
 *
 * WHAT THIS IS AND IS NOT
 *
 * It is a structured console writer: one JSON object per line in production,
 * something readable in development. It is not a log shipper and not an error
 * tracker. `lib/report-error.ts` remains the seam for a tracker (Sentry or
 * otherwise) — installing one is a dependency, an account and a cost, and that
 * is a decision for whoever owns the bill.
 *
 * WHY JSON IN PRODUCTION
 *
 * Vercel, CloudWatch and every hosted collector parse a JSON line into
 * queryable fields. That is what turns "my order failed yesterday evening"
 * into a filter on requestId, and it costs nothing to emit.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Anything worth attaching to a line. Keep it small and keep it non-personal. */
export type LogFields = Record<string, unknown>;

const isProduction = process.env.NODE_ENV === 'production';

/**
 * LOG_LEVEL, or a sensible default per environment. Debug lines stay in
 * development, where they are useful, and never reach a production collector.
 */
function threshold(): number {
  const configured = process.env.LOG_LEVEL as LogLevel | undefined;
  if (configured && configured in LEVEL_ORDER) return LEVEL_ORDER[configured];
  return isProduction ? LEVEL_ORDER.info : LEVEL_ORDER.debug;
}

/**
 * Errors do not survive JSON.stringify — `{}` is what you get. This pulls out
 * the three fields that are actually useful, including `digest`, which is how
 * an opaque production error shown to a visitor is matched to its stack here.
 */
function describeError(error: unknown): LogFields {
  if (error instanceof Error) {
    return {
      error: error.message,
      errorName: error.name,
      digest: (error as Error & { digest?: string }).digest,
      stack: isProduction ? undefined : error.stack,
    };
  }
  return { error: String(error) };
}

function write(level: LogLevel, message: string, fields: LogFields = {}): void {
  if (LEVEL_ORDER[level] < threshold()) return;

  const line = { level, message, time: new Date().toISOString(), ...fields };

  // console is the transport on every platform this deploys to; the point of
  // this module is the shape of what goes into it, not the sink.
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (isProduction) {
    sink(JSON.stringify(line));
    return;
  }
  // Development: one readable line, fields only when there are any.
  const extra = Object.keys(fields).length > 0 ? ' ' + JSON.stringify(fields) : '';
  sink(`[${level}] ${message}${extra}`);
}

export const logger = {
  debug: (message: string, fields?: LogFields) => write('debug', message, fields),
  info: (message: string, fields?: LogFields) => write('info', message, fields),
  warn: (message: string, fields?: LogFields) => write('warn', message, fields),
  /** `error` may be an Error, and is unpacked into message/name/digest/stack. */
  error: (message: string, error?: unknown, fields?: LogFields) =>
    write('error', message, { ...fields, ...(error === undefined ? {} : describeError(error)) }),

  /**
   * A logger that stamps every line with the same fields — a request id, most
   * often. `logger.child({ requestId }).error(...)` groups a whole request's
   * output without threading the id through every call.
   */
  child(bound: LogFields) {
    return {
      debug: (message: string, fields?: LogFields) => write('debug', message, { ...bound, ...fields }),
      info: (message: string, fields?: LogFields) => write('info', message, { ...bound, ...fields }),
      warn: (message: string, fields?: LogFields) => write('warn', message, { ...bound, ...fields }),
      error: (message: string, error?: unknown, fields?: LogFields) =>
        write('error', message, {
          ...bound,
          ...fields,
          ...(error === undefined ? {} : describeError(error)),
        }),
    };
  },
};

export type Logger = ReturnType<typeof logger.child>;
