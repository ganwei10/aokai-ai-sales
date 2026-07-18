import { NextResponse } from "next/server";
import {
  getConfig,
  saveConfig,
  resetConfig,
  addItem,
  updateItem,
  removeItem,
  persistenceMode,
  uid,
  type ConfigCollection,
} from "@/lib/db/config";

export const dynamic = "force-dynamic";

const COLLECTIONS: ConfigCollection[] = ["searchSites", "watchSites", "recruitKeywords", "signalKeywords"];

function ok(config: any) {
  return NextResponse.json({ config, mode: persistenceMode() });
}
function bad(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 });
}

// GET：返回全量配置 + 持久化模式
export async function GET() {
  const config = await getConfig();
  return ok(config);
}

// POST：新增一项  body: { collection, item }
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !COLLECTIONS.includes(body.collection)) return bad("collection 必须为 searchSites/watchSites/recruitKeywords/signalKeywords");
  if (!body.item || typeof body.item !== "object") return bad("缺少 item");
  const item = { ...body.item, id: body.item.id || uid(body.collection.slice(0, 2)) };
  const config = await addItem(body.collection, item);
  return ok(config);
}

// PATCH：修改一项  body: { collection, id, patch }
export async function PATCH(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !COLLECTIONS.includes(body.collection)) return bad("collection 不合法");
  if (!body.id) return bad("缺少 id");
  const config = await updateItem(body.collection, body.id, body.patch || {});
  return ok(config);
}

// DELETE：删除一项  body: { collection, id }
export async function DELETE(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !COLLECTIONS.includes(body.collection)) return bad("collection 不合法");
  if (!body.id) return bad("缺少 id");
  const config = await removeItem(body.collection, body.id);
  return ok(config);
}

// PUT：整体替换或重置  body: { reset?: true } | { config: MonitorConfig }
export async function PUT(req: Request) {
  const body = await req.json().catch(() => null);
  if (body?.reset) {
    const config = await resetConfig();
    return ok(config);
  }
  if (body?.config && COLLECTIONS.every((c) => Array.isArray(body.config[c]))) {
    const config = await saveConfig(body.config);
    return ok(config);
  }
  return bad("PUT 需提供 { reset: true } 或完整 { config }");
}
