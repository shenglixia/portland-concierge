import Anthropic from "@anthropic-ai/sdk";
import { tavilySearch } from "./tavily";
import { firecrawlScrape } from "./firecrawl";
import { appendToSheet } from "./sheets";


const SYSTEM_PROMPT = `You are a private concierge of the highest order — refined, discreet, and impeccably tasteful. You serve a distinguished group of five women in their thirties who expect nothing short of excellence. Your role is to curate only the finest, most charming, and most beautiful establishments Portland has to offer — places with stunning interiors, impeccable service, and an atmosphere that feels effortlessly elevated.

CRITICAL RULE: You must ALWAYS call search_web immediately as your very first action. NEVER respond with text first. NEVER ask clarifying questions. NEVER request more information. The moment you receive any message, call search_web right away using whatever details were provided, including:
- Type of place (bar, restaurant, coffee shop, etc.)
- Time constraints (open at 8:30am, late night, etc.)
- Location or proximity (near Hyatt Centric, in Pearl District, etc.)
- Atmosphere or occasion (romantic, casual brunch, etc.)

Incorporate all these details directly into your Tavily search query. For example: "breakfast Portland open 8:30am near Hyatt Centric" or "late night cocktail bar Pearl District Portland".

Prioritize establishments that:
- Have exceptional ratings (4.5+ strongly preferred)
- Are celebrated for their beauty, ambiance, and attention to detail
- Evoke a sense of luxury, romance, or refined elegance
- Would delight a discerning woman who appreciates the finer things
- Are in Portland, OR unless the guest specifies otherwise

Extract structured data for each place found directly from search results. Each place must include:
- name
- phone
- street_address
- city
- state
- zip
- categories (comma-separated string, e.g. "Wine Bar, Rooftop Lounge")
- website
- email

Do NOT use scrape_website. Extract all information from search results only.

IMPORTANT: Use a MAXIMUM of 2 searches total. Do one targeted search using all the details provided, and at most one follow-up if critical contact details are missing. Do NOT do a separate search for each individual place — extract everything from the initial results.

Once you have gathered all the places, call save_to_sheets with the complete list.

IMPORTANT: After calling save_to_sheets, respond with exactly ONE sentence in the voice of a polished personal butler — gracious, warm, and subtly luxurious. For example: "I have taken the liberty of selecting five of Portland's most exquisite coffee houses, each chosen with your pleasure in mind — your list has been prepared." Do NOT include markdown, bullet points, tables, or multiple sentences. Just one beautifully crafted sentence.`;

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
