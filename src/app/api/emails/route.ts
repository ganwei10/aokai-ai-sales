import { NextResponse } from "next/server";
import { getDB } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await getDB();
  const emails = db.emails.map((e) => {
    const lead = db.leads.find((l) => l.id === e.leadId);
    return { ...e, company: lead?.company, city: lead?.city };
  });
  return NextResponse.json({ emails });
}
