import Anthropic from "@anthropic-ai/sdk";
import { tavilySearch } from "./tavily";
import { firecrawlScrape } from "./firecrawl";
import { appendToSheet } from "./sheets";


const SYSTEM_PROMPT = `You are a lead research assistant. When given a search request, use the search_web tool to find relevant businesses.

Extract structured data for each place found directly from search results. Each place must include:
- name
- phone
- street_address
- city
- state
- zip
- categories (comma-separated string, e.g. "Barbershop, Hair Salon")
- website
- email

Do NOT use scrape_website. Extract all information from search results only.

Once you have gathered all the places, call save_to_sheets with the complete list.

IMPORTANT: After calling save_to_sheets, respond with ONE short sentence only, like "Found 5 barbershops in Austin, TX — saved to your sheet." Do NOT include markdown tables, bullet lists, numbered lists, or any other formatting. Just the single sentence.`;

const tools: Anthropic.Tool[] = [
  {
    name: "search_web",
    description: "Search the web using Tavily for business information",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "save_to_sheets",
    description: "Save the list of extracted places to Google Sheets",
    input_schema: {
      type: "object",
      properties: {
        places: {
          type: "array",
          description: "Array of place objects to save",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              phone: { type: "string" },
              street_address: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              zip: { type: "string" },
              categories: { type: "string" },
              website: { type: "string" },
              email: { type: "string" },
            },
          },
        },
      },
      required: ["places"],
    },
  },
];

export type Place = {
  name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  categories: string;
  website: string;
  email: string;
};

export type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; result: string }
  | { type: "places_saved"; places: Place[] }
  | { type: "error"; message: string };

export async function* runAgent(
  userMessage: string,
  history: Anthropic.MessageParam[]
): AsyncGenerator<AgentEvent> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: "user", content: userMessage },
  ];

  let iterations = 0;
  const maxIterations = 20;

  while (iterations < maxIterations) {
    iterations++;

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools,
      messages,
    });

    // Emit text content
    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        yield { type: "text", content: block.text };
      }
    }

    // If no tool use, we're done
    if (response.stop_reason === "end_turn") {
      break;
    }

    // Process tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) break;

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      yield { type: "tool_start", tool: toolUse.name, input: toolUse.input };

      let result = "";

      try {
        if (toolUse.name === "search_web") {
          const { query } = toolUse.input as { query: string };
          result = await tavilySearch(query);
        } else if (toolUse.name === "save_to_sheets") {
          const { places } = toolUse.input as { places: Place[] };
          await appendToSheet(places);
          result = `Successfully saved ${places.length} places to Google Sheets.`;
          yield { type: "places_saved", places };
        }
      } catch (err) {
        result = `Error: ${err instanceof Error ? err.message : String(err)}`;
        yield { type: "error", message: result };
      }

      yield { type: "tool_result", tool: toolUse.name, result };

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    messages.push({ role: "user", content: toolResults });
  }
}
