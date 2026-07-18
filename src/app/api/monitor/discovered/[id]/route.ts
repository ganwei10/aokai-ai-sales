import { NextResponse } from "next/server";
import { setDiscoveredStatus } from "@/lib/db/store";
import type { DiscoveredStatus } from "@/lib/db/types";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const status = body.status as DiscoveredStatus;
  const note = body.note as string | undefined;
  if (!["new", "qualifying", "converted", "rejected"].includes(status))
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  const d = setDiscoveredStatus(params.id, status, note);
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ discovered: d });
}
