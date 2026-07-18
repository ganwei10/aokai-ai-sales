import { seedDB } from "./seed";
import type { Activity, ActivityType, DB } from "./types";

const KV_KEY = "aokai-sales-db";

// 同一实例内的内存缓存（serverless 冷启动间不保证共享）
let memory: DB | null = null;

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function getSeed(): DB {
  return clone(seedDB);
}

function kvConfigured(): boolean {
  return !!(
    process.env.KV_REST_API_URL &&
    process.env.KV_REST_API_TOKEN
  );
}

async function loadFromKV(): Promise<DB | null> {
  if (!kvConfigured()) return null;
  try {
    const { kv } = await import("@vercel/kv");
    const data = await kv.get<DB>(KV_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

async function saveToKV(db: DB): Promise<void> {
  if (!kvConfigured()) return;
  try {
    const { kv } = await import("@vercel/kv");
    await kv.set(KV_KEY, db);
  } catch {
    /* 忽略持久化失败，保证主流程可用 */
  }
}

/** 读取数据库（KV 优先，否则内存/种子） */
export async function getDB(): Promise<DB> {
  if (memory) return memory;
  const kvDb = await loadFromKV();
  memory = kvDb ?? getSeed();
  return memory;
}

/** 写回数据库（内存 + KV 双写） */
export async function saveDB(db: DB): Promise<void> {
  memory = db;
  await saveToKV(db);
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export function logActivity(
  db: DB,
  type: ActivityType,
  message: string
): void {
  const a: Activity = {
    id: uid("A"),
    at: new Date().toISOString(),
    type,
    message,
  };
  db.activities.unshift(a);
  // 仅保留最近 200 条
  if (db.activities.length > 200) db.activities.length = 200;
}

export function persistenceMode(): "vercel-kv" | "in-memory" {
  return kvConfigured() ? "vercel-kv" : "in-memory";
}
