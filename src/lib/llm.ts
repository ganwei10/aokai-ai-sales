import type { ColdEmail, Lead, RecruitmentSignal, RoiReport } from "./types";
import { buildRoi, formatUSD, resolveProduct } from "./roi";
import { uid } from "./store";

interface EmailInput {
  lead: Lead;
  signal?: RecruitmentSignal;
  roi: RoiReport;
}

function templateEmail({ lead, signal, roi }: EmailInput): { subject: string; body: string } {
  const name = lead.plantManager.name ?? "there";
  const wage = lead.wagePerHour ?? 23;
  const packCount =
    signal?.roles.filter((r) => /pack|packer/i.test(r.role)).reduce((s, r) => s + r.count, 0) ?? 0;
  const packLine =
    packCount > 0
      ? `you're actively recruiting ${packCount} packing-line operators at ~$${wage}/hr`
      : `your back-of-house bagging line is running near capacity`;

  const subject = `Helping ${lead.company} close ${lead.city}'s packing-line labor gap — ${roi.paybackMonths}-month ROI`;

  const body = `Hi ${name},

I'm reaching out because we've been tracking hiring activity at ${lead.company} in ${lead.city}, and noticed ${packLine}. That's a clear signal your bagging/packaging operation is at capacity — and the labor gap is only widening.

We're AOKAI Machinery, a packaging-automation specialist for protein and prepared-food plants. For operations like yours, our ${roi.product} typically replaces ${roi.laborSavedHeadcount} roles on the bagging line. At your loaded labor cost that's about ${formatUSD(
    roi.annualLaborSaving
  )}/year in savings, with a payback of roughly ${roi.paybackMonths} months — well inside a single budget cycle.

Why this fits a ${lead.city} plant specifically:
• ${roi.compliance.join(" / ")} are built in — no retrofitting for CFIA or FSMA audits.
• Our Toronto technical center is about 30 minutes from your plant, so commissioning and service are truly local.
• We deliver a personalized 10-month payback simulation before any commitment.

I've attached a short ROI brief tailored to ${lead.company}. If it's useful, a local channel partner (七三开 model — they carry the margin, you get the white-glove support) can stop by within 90 minutes for a 1.5-hour on-site diagnosis. No slideware — just a look at your line and a hard number.

Worth a 20-minute call this week?

Best,
AOKAI Machinery · North America Team`;

  return { subject, body };
}

async function callLLM(lead: Lead, signal: RecruitmentSignal | undefined, roi: RoiReport): Promise<{ subject: string; body: string } | null> {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || "https://api.openai.com/v1";
  const model = process.env.LLM_MODEL || "gpt-4o-mini";
  if (!apiKey) return null;

  const wage = lead.wagePerHour ?? 23;
  const packCount =
    signal?.roles.filter((r) => /pack|packer/i.test(r.role)).reduce((s, r) => s + r.count, 0) ?? 0;

  const system = `You are a senior B2B outbound copywriter for AOKAI Machinery, a Chinese packaging-automation vendor entering the North American protein/meat processing market. Write a concise, confident, NON-spammy cold email in English to a plant manager. Reference their city, the labor gap, AOKAI's product and ROI, CFIA/FSMA compliance, the Toronto technical center 30 min away, and the 七三开 local channel partner who can visit within 90 minutes. Return ONLY valid JSON: {"subject": string, "body": string}. Body under 260 words.`;

  const user = `Company: ${lead.company}
City: ${lead.city}, ${lead.region}
Product: ${roi.product}
Labor saved: ${roi.laborSavedHeadcount} roles
Annual labor saving: ${formatUSD(roi.annualLaborSaving)}
Payback: ${roi.paybackMonths} months
Compliance: ${roi.compliance.join(", ")}
Detected packing-line openings: ${packCount} at ~$${wage}/hr
Recruitment severity: ${signal?.severity ?? "unknown"}
Plant manager: ${lead.plantManager.name ?? "Plant Manager"}`;

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    if (parsed?.subject && parsed?.body) return { subject: parsed.subject, body: parsed.body };
    return null;
  } catch {
    return null;
  }
}

/** 生成千人千面冷邮件：优先调用大模型，失败回退内置模板 */
export async function generateColdEmail(lead: Lead, signal?: RecruitmentSignal): Promise<ColdEmail> {
  const roi = buildRoi(lead.productInterest);
  const llmResult = await callLLM(lead, signal, roi);
  const usedLLM = !!llmResult;
  const { subject, body } = llmResult ?? templateEmail({ lead, signal, roi });

  return {
    id: uid("E"),
    leadId: lead.id,
    subject,
    body,
    roi,
    generatedBy: usedLLM ? "llm" : "template",
    createdAt: new Date().toISOString(),
    status: "draft",
  };
}

export { resolveProduct };
