import { NextResponse } from "next/server";
import { setCustomerStatus } from "@/lib/db/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const c = setCustomerStatus(params.id, body.status);
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ customer: c });
}
