import FirecrawlApp from "@mendable/firecrawl-js";

export async function firecrawlScrape(url: string): Promise<string> {
  const client = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY! });
  const result = await client.scrape(url, { formats: ["markdown"] });
  const text = (result as { markdown?: string }).markdown ?? "";
  return text.slice(0, 8000);
}
