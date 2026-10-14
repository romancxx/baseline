export const LOG_LEVELS = ["debug", "info", "warn", "error", "silent"] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogFields = Record<string, unknown>;

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

function isLevel(value: string | undefined): value is LogLevel {
  return value !== undefined && (LOG_LEVELS as readonly string[]).includes(value);
}

// Read lazily: the ingest script sets nothing up before importing this.
function threshold(): number {
  const configured = process.env.LOG_LEVEL;
  return RANK[isLevel(configured) ? configured : "info"];
}

// Written straight to stdout rather than through `console`, so every line is one JSON
// object a log collector can parse without guessing.
function emit(level: LogLevel, event: string, fields: LogFields) {
  if (RANK[level] < threshold()) return;

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });

  if (level === "error" || level === "warn") {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
}

export const logger = {
  debug: (event: string, fields: LogFields = {}) => emit("debug", event, fields),
  info: (event: string, fields: LogFields = {}) => emit("info", event, fields),
  warn: (event: string, fields: LogFields = {}) => emit("warn", event, fields),
  error: (event: string, fields: LogFields = {}) => emit("error", event, fields),
};
