// Outbound RFQ email and inbound reply parsing via Postmark.
// Env: POSTMARK_SERVER_TOKEN, RFQ_FROM_EMAIL ("Jlaero Charter Desk <charter@jlaero.com>"),
// RFQ_REPLY_DOMAIN (the inbound domain, e.g. "reply.jlaero.com"),
// RFQ_POSTAL_ADDRESS (CAN-SPAM physical address for the footer).

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  replyToken: string;
  tag?: string;
};

export function replyAddress(token: string) {
  const domain = process.env.RFQ_REPLY_DOMAIN ?? "reply.jlaero.com";
  return `rfq+${token}@${domain}`;
}

export function complianceFooter() {
  const address = process.env.RFQ_POSTAL_ADDRESS ?? "Jlaero, address on file";
  return [
    "",
    "--",
    "Jlaero is an air charter broker and not a direct air carrier. Flights are operated by FAA Part 135 certificated carriers.",
    address,
    "To stop receiving charter requests from Jlaero, reply with UNSUBSCRIBE and we will remove you within 10 business days.",
  ].join("\n");
}

export async function sendRfqEmail(msg: OutboundEmail): Promise<{ messageId: string }> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) throw new Error("POSTMARK_SERVER_TOKEN is not set");
  const from = process.env.RFQ_FROM_EMAIL ?? "Jlaero Charter Desk <charter@jlaero.com>";
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
    body: JSON.stringify({
      From: from,
      To: msg.to,
      ReplyTo: replyAddress(msg.replyToken),
      Subject: msg.subject,
      TextBody: msg.text + complianceFooter(),
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM ?? "outbound",
      Tag: msg.tag ?? "rfq",
      TrackOpens: false,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ErrorCode) {
    throw new Error(`Postmark send failed: ${res.status} ${body.Message ?? ""}`);
  }
  return { messageId: body.MessageID as string };
}

// Postmark inbound webhook payload, reduced to what we store.
export type InboundEmail = {
  providerMessageId: string;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  text: string;
  strippedReply: string;
  html: string;
  inReplyTo: string | null;
  references: string | null;
  mailboxHash: string | null;
  receivedAt: string;
  headers: Record<string, string>;
};

export function parsePostmarkInbound(payload: Record<string, unknown>): InboundEmail {
  const headers: Record<string, string> = {};
  for (const h of (payload.Headers as { Name: string; Value: string }[] | undefined) ?? []) {
    headers[h.Name.toLowerCase()] = h.Value;
  }
  const fromFull = payload.FromFull as { Email?: string; Name?: string } | undefined;
  // Token from rfq+<token>@domain; Postmark exposes it as MailboxHash.
  let mailboxHash = (payload.MailboxHash as string | undefined) || null;
  if (!mailboxHash) {
    const m = /rfq\+([a-z0-9]+)@/i.exec(String(payload.OriginalRecipient ?? payload.To ?? ""));
    mailboxHash = m?.[1] ?? null;
  }
  return {
    providerMessageId: String(payload.MessageID ?? ""),
    from: (fromFull?.Email ?? String(payload.From ?? "")).toLowerCase(),
    fromName: fromFull?.Name ?? "",
    to: String(payload.OriginalRecipient ?? payload.To ?? ""),
    subject: String(payload.Subject ?? ""),
    text: String(payload.TextBody ?? ""),
    strippedReply: String(payload.StrippedTextReply ?? "") || String(payload.TextBody ?? ""),
    html: String(payload.HtmlBody ?? ""),
    inReplyTo: headers["in-reply-to"] ?? null,
    references: headers["references"] ?? null,
    mailboxHash,
    receivedAt: String(payload.Date ?? new Date().toISOString()),
    headers,
  };
}

// Client and staff notifications (not RFQs): no CAN-SPAM footer, no reply
// token. Env: NOTIFY_FROM_EMAIL, falls back to RFQ_FROM_EMAIL.
export async function sendTransactionalEmail(msg: { to: string; subject: string; text: string; html?: string; tag?: string }): Promise<{ messageId: string }> {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  if (!token) throw new Error("POSTMARK_SERVER_TOKEN is not set");
  const from = process.env.NOTIFY_FROM_EMAIL ?? process.env.RFQ_FROM_EMAIL ?? "Jlaero <charter@jlaero.com>";
  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json", "X-Postmark-Server-Token": token },
    body: JSON.stringify({
      From: from,
      To: msg.to,
      Subject: msg.subject,
      TextBody: msg.text,
      HtmlBody: msg.html,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM ?? "outbound",
      Tag: msg.tag ?? "notification",
      TrackOpens: false,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ErrorCode) throw new Error(`Postmark send failed: ${res.status} ${body.Message ?? ""}`);
  return { messageId: body.MessageID as string };
}
