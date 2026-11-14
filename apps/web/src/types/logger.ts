import type { LOG_LEVELS } from "@/shared/logger";

export type LogLevel = (typeof LOG_LEVELS)[number];

export type LogFields = Record<string, unknown>;
