// Phase 2 数据存储（模块级缓存，确定性种子，刷新即恢复）
import { generateDatabase } from "./generate";
import type { Customer, Partner } from "./types";

interface Db {
  customers: Customer[];
  partners: Partner[];
}

let cache: Db | null = null;

export function getDb(): Db {
  if (!cache) cache = generateDatabase();
  return cache;
}

export function setCustomerStatus(id: string, status: Customer["status"]): Customer | null {
  const db = getDb();
  const c = db.customers.find((x) => x.id === id);
  if (c) {
    c.status = status;
    c.lastActivity = new Date().toISOString().slice(0, 10);
  }
  return c ?? null;
}

export function getPartner(id: string | null): Partner | undefined {
  if (!id) return undefined;
  return getDb().partners.find((p) => p.id === id);
}
