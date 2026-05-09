import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import type { Place } from "@/lib/agent";

function formatPlacesForSMS(places: Place[]): string {
  const lines: string[] = [];
  lines.push(`Lead Crawler: ${places.length} result${places.length !== 1 ? "s" : ""}`);
  lines.push("---");

  places.forEach((p, i) => {
    lines.push(`${i + 1}. ${p.name}`);
    const addr = [p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ");
    if (addr) lines.push(`   ${addr}`);
    if (p.phone) lines.push(`   ${p.phone}`);
    if (p.categories) lines.push(`   ${p.categories}`);
    if (p.website) lines.push(`   ${p.website}`);
    if (p.email) lines.push(`   ${p.email}`);
  });

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const { to, places } = await req.json() as { to: string; places: Place[] };

  if (!to || !places?.length) {
    return NextResponse.json({ error: "Missing phone number or places" }, { status: 400 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !from) {
    return NextResponse.json({ error: "Twilio not configured" }, { status: 500 });
  }

  const client = twilio(accountSid, authToken);
  const body = formatPlacesForSMS(places);

  // Twilio SMS max is 1600 chars; split into chunks if needed
  const MAX = 1550;
  const chunks: string[] = [];
  if (body.length <= MAX) {
    chunks.push(body);
  } else {
    const placesLines = places.map((p, i) => {
      const addr = [p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ");
      return [`${i + 1}. ${p.name}`, addr && `   ${addr}`, p.phone && `   ${p.phone}`]
        .filter(Boolean).join("\n");
    });
    let current = `Lead Crawler (${places.length} results)\n---\n`;
    for (const block of placesLines) {
      if ((current + "\n" + block).length > MAX) {
        chunks.push(current.trim());
        current = block + "\n";
      } else {
        current += "\n" + block;
      }
    }
    if (current.trim()) chunks.push(current.trim());
  }

  await Promise.all(
    chunks.map((chunk, i) =>
      client.messages.create({
        body: chunks.length > 1 ? `(${i + 1}/${chunks.length})\n${chunk}` : chunk,
        from,
        to,
      })
    )
  );

  return NextResponse.json({ ok: true, messages: chunks.length });
}
