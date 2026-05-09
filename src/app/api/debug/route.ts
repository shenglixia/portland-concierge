import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    anthropic: process.env.ANTHROPIC_API_KEY ? process.env.ANTHROPIC_API_KEY.slice(0,15) + "..." : "MISSING",
    tavily: process.env.TAVILY_API_KEY ? process.env.TAVILY_API_KEY.slice(0,10) + "..." : "MISSING",
    firecrawl: process.env.FIRECRAWL_API_KEY ? "SET" : "MISSING",
    sheets: process.env.GOOGLE_SHEET_ID ? "SET" : "MISSING",
    sa: process.env.GOOGLE_SERVICE_ACCOUNT_JSON ? "SET" : "MISSING",
  });
}
