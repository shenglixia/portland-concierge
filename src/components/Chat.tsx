"use client";

import { useState, useRef, useEffect } from "react";
import type { Place } from "@/lib/agent";

type AgentEvent =
  | { type: "text"; content: string }
  | { type: "tool_start"; tool: string; input: unknown }
  | { type: "tool_result"; tool: string; result: string }
  | { type: "places_saved"; places: Place[] }
  | { type: "error"; message: string };

type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; places?: Place[]; steps?: string[] };

const TOOL_LABELS: Record<string, string> = {
  search_web: "Searching the web",
  scrape_website: "Scraping website",
  save_to_sheets: "Saving to Google Sheets",
};

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: Message = { role: "user", text };
    setMessages((prev) => [...prev, userMsg]);

    // Build history for the API
    const history = messages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.text }
        : { role: "assistant" as const, content: m.text }
    );

    // Add a blank assistant message we'll fill in as events stream
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "", steps: [], places: [] },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          const event: AgentEvent = JSON.parse(payload);

          setMessages((prev) => {
            const updated = [...prev];
            const last = { ...updated[updated.length - 1] } as Extract<
              Message,
              { role: "assistant" }
            >;

            if (event.type === "text") {
              last.text += event.content;
            } else if (event.type === "tool_start") {
              const label = TOOL_LABELS[event.tool] ?? event.tool;
              const toolInput = event.input as Record<string, string>;
              const detail =
                toolInput.query ?? toolInput.url ?? "";
              last.steps = [
                ...(last.steps ?? []),
                `${label}${detail ? `: ${detail}` : ""}`,
              ];
            } else if (event.type === "places_saved") {
              last.places = event.places;
            }

            updated[updated.length - 1] = last;
            return updated;
          });
        }
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto p-4">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900">Lead Crawler</h1>
        <p className="text-sm text-gray-500">
          Ask me to find businesses — I'll search the web and save results to
          your Google Sheet.
        </p>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-20">
            <p className="text-lg">Try: "Find barbershops in Austin TX"</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" ? (
              <div className="flex justify-end">
                <div className="bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2 max-w-[75%]">
                  {msg.text}
                </div>
              </div>
            ) : (
              <div className="flex justify-start">
                <div className="max-w-[90%] space-y-2">
                  {/* Tool steps */}
                  {msg.steps && msg.steps.length > 0 && (
                    <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 space-y-1">
                      {msg.steps.map((step, j) => (
                        <div key={j} className="flex items-center gap-2 text-sm text-gray-600">
                          <span className="text-blue-500">•</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text response */}
                  {msg.text && (
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-gray-800 whitespace-pre-wrap">
                      {msg.text}
                    </div>
                  )}

                  {/* Results table */}
                  {msg.places && msg.places.length > 0 && (
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="text-sm w-full">
                        <thead className="bg-gray-100 text-gray-600">
                          <tr>
                            {["Name", "Phone", "Address", "City", "State", "Categories", "Website", "Email"].map((h) => (
                              <th key={h} className="px-3 py-2 text-left whitespace-nowrap font-medium">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {msg.places.map((p, j) => (
                            <tr key={j} className="hover:bg-gray-50">
                              <td className="px-3 py-2 font-medium whitespace-nowrap">{p.name}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.phone}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.street_address}</td>
                              <td className="px-3 py-2 whitespace-nowrap">{p.city}</td>
                              <td className="px-3 py-2">{p.state}</td>
                              <td className="px-3 py-2">{p.categories}</td>
                              <td className="px-3 py-2">
                                {p.website ? (
                                  <a href={p.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                                    Link
                                  </a>
                                ) : "—"}
                              </td>
                              <td className="px-3 py-2">{p.email || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && messages[messages.length - 1]?.role === "assistant" &&
          !messages[messages.length - 1].text &&
          (messages[messages.length - 1] as Extract<Message, { role: "assistant" }>).steps?.length === 0 && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-gray-400 text-sm">
              Thinking...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-2 border-t border-gray-200">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder='e.g. "Find hair salons in Brooklyn NY"'
          disabled={loading}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
