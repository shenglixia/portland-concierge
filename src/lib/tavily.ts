import { tavily } from "@tavily/core";

export async function tavilySearch(query: string): Promise<string> {
  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  const response = await client.search(query, {
    searchDepth: "advanced",
    maxResults: 10,
  });

  return JSON.stringify(response.results.map((r) => ({
    title: r.title,
    url: r.url,
    content: r.content,
  })));
}
