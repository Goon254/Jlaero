import { NextResponse } from "next/server";
import { processInbound } from "@/lib/sourcing/engine";

// Postmark inbound webhook. Configure the inbound stream's webhook URL as
// https://<host>/api/rfq/inbound?secret=<RFQ_INBOUND_SECRET> and point the
// reply domain's MX at Postmark. Payloads are stored raw before any parsing.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.RFQ_INBOUND_SECRET;
  const given = new URL(req.url).searchParams.get("secret");
  if (!secret || given !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  try {
    const result = await processInbound(payload);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("inbound rfq failed", e);
    // 200 so Postmark does not retry a poison message forever; the raw
    // payload is already stored when we reached parsing.
    return NextResponse.json({ ok: false, error: String(e) }, { status: 200 });
  }
}
