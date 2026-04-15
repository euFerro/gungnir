type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const LEVEL_CONFIG: Record<Exclude<LogLevel, 'silent'>, { label: string; color: string }> = {
  debug: { label: 'DEBUG', color: COLORS.magenta },
  info:  { label: 'INFO ', color: COLORS.green },
  warn:  { label: 'WARN ', color: COLORS.yellow },
  error: { label: 'ERROR', color: COLORS.red },
};

const isProduction = () => process.env.NODE_ENV === 'production';

const resolveLevel = (): LogLevel => {
  const envLevel = process.env.APP_DEBUG_LEVEL?.toLowerCase() as LogLevel | undefined;
  if (envLevel && envLevel in LOG_LEVELS) return envLevel;
  if (process.env.NODE_ENV === 'test') return 'silent';
  return isProduction() ? 'info' : 'debug';
};

const formatTimestamp = (): string => {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
};

const formatJson = (data: Record<string, unknown>): string => {
  const entries = Object.entries(data);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${COLORS.dim}${k}=${COLORS.reset}${String(v)}`).join(' ');
};

export class BardLogger {
  private readonly level: number;
  private readonly context: string;

  constructor(context = 'App') {
    this.level = LOG_LEVELS[resolveLevel()];
    this.context = context;
  }

  child(context: string): BardLogger {
    return new BardLogger(context);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.log('error', message, meta);
  }

  private log(level: Exclude<LogLevel, 'silent'>, message: string, meta?: Record<string, unknown>): void {
    if (LOG_LEVELS[level] < this.level) return;

    const { label, color } = LEVEL_CONFIG[level];
    const ts = `${COLORS.dim}${formatTimestamp()}${COLORS.reset}`;
    const lvl = `${color}${COLORS.bold}${label}${COLORS.reset}`;
    const ctx = `${COLORS.cyan}[${this.context}]${COLORS.reset}`;
    const metaStr = meta ? ` ${formatJson(meta)}` : '';

    const output = `${ts} ${lvl} ${ctx} ${message}${metaStr}`;
    const stream = level === 'error' ? process.stderr : process.stdout;
    stream.write(output + '\n');
  }
}

/** Global framework logger instance */
export const logger = new BardLogger('Bard');
