import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import type { Place } from "@/lib/agent";

function buildEmailHTML(places: Place[]): string {
  const rows = places.map((p, i) => {
    const addr = [p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ");
    return `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"}">
        <td style="padding:12px 16px;font-weight:600;color:#111827">${p.name}</td>
        <td style="padding:12px 16px;color:#6b7280">${addr || "—"}</td>
        <td style="padding:12px 16px;color:#6b7280">${p.phone || "—"}</td>
        <td style="padding:12px 16px;color:#6b7280">${p.categories || "—"}</td>
        <td style="padding:12px 16px">
          ${p.website ? `<a href="${p.website}" style="color:#6366f1;text-decoration:none">Visit</a>` : "—"}
        </td>
        <td style="padding:12px 16px;color:#6b7280">${p.email || "—"}</td>
      </tr>`;
  }).join("");

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:900px;margin:0 auto;padding:32px 16px;background:#f4f4f8">
      <div style="background:white;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
        <div style="background:linear-gradient(135deg,#6366f1,#818cf8);padding:24px 32px">
          <h1 style="margin:0;color:white;font-size:20px;font-weight:700">Lead Crawler Results</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:14px">${places.length} place${places.length !== 1 ? "s" : ""} found</p>
        </div>
        <div style="overflow-x:auto">
          <table style="width:100%;border-collapse:collapse;font-size:14px">
            <thead>
              <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb">
                <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Name</th>
                <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Address</th>
                <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Phone</th>
                <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Categories</th>
                <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Website</th>
                <th style="padding:12px 16px;text-align:left;color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:0.05em">Email</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div style="padding:16px 32px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:12px">
          Sent by Lead Crawler — results also saved to your Google Sheet.
        </div>
      </div>
    </div>`;
}

export async function POST(req: NextRequest) {
  const { to, places } = await req.json() as { to: string; places: Place[] };

  if (!to || !places?.length) {
    return NextResponse.json({ error: "Missing email or places" }, { status: 400 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  const { error } = await resend.emails.send({
    from: "Lead Crawler <onboarding@resend.dev>",
    to,
    subject: `Lead Crawler: ${places.length} result${places.length !== 1 ? "s" : ""} found`,
    html: buildEmailHTML(places),
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
