"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
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

const QUICK_ACTIONS = [
  "Find coffee shops",
  "Find bars",
  "Find restaurants",
  "Find outdoor adventures",
  "Find vineyards",
];

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = sessionStorage.getItem("chat_messages");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem("chat_messages", JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  async function sendMessage(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    setLoading(true);

    const userMsg: Message = { role: "user", text: msg };
    setMessages((prev) => [...prev, userMsg]);

    const history = messages.map((m) =>
      m.role === "user"
        ? { role: "user" as const, content: m.text }
        : { role: "assistant" as const, content: m.text }
    );

    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "", steps: [], places: [] },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history }),
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
            const last = { ...updated[updated.length - 1] } as Extract<Message, { role: "assistant" }>;

            if (event.type === "text") {
              last.text += event.content;
            } else if (event.type === "tool_start") {
              const label = TOOL_LABELS[event.tool] ?? event.tool;
              const detail = (event.input as Record<string, string>).query ?? (event.input as Record<string, string>).url ?? "";
              last.steps = [...(last.steps ?? []), `${label}${detail ? `: ${detail}` : ""}`];
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

  const hasMessages = messages.length > 0;

  function restartChat() {
    setMessages([]);
    sessionStorage.removeItem("chat_messages");
  }

  return (
    <div className="min-h-screen bg-[#ede8dc] flex flex-col">
      {/* Sticky top bar — always visible when chatting */}
      {hasMessages && (
        <div className="sticky top-0 z-20 flex justify-end px-4 py-2 bg-[#ede8dc]/80 backdrop-blur">
          <button
            onClick={restartChat}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-300 bg-white/70 rounded-xl px-3 py-1.5 transition-colors shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart Chat
          </button>
        </div>
      )}

      {/* Conversation area */}
      <div className="flex-1 overflow-y-auto">
        {!hasMessages ? (
          /* Empty state — centered hero */
          <div className="flex flex-col items-center justify-center min-h-screen px-4 pb-48">
            {/* Portland image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/porland.jpg"
              alt="Portland"
              className="w-[26rem] h-[26rem] rounded-3xl object-cover shadow-lg mb-6"
            />

            <h1 className="text-4xl font-bold text-gray-900 text-center leading-snug" style={{ fontFamily: "'Playfair Display', serif" }}>
              Welcome to Portland
              <br />
              <span className="text-[#4a5c3a]">How May I Be of Service?</span>
            </h1>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
{messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="bg-[#4a5c3a] text-white rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] text-sm leading-relaxed">
                      {msg.text}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-start">
                    <div className="max-w-[90%] space-y-3">
                      {/* Tool steps — hide once results are in */}
                      {msg.steps && msg.steps.length > 0 && (!msg.places || msg.places.length === 0) && (
                        <div className="bg-white/70 backdrop-blur border border-gray-200 rounded-2xl px-4 py-3 space-y-1.5">
                          {msg.steps.map((step, j) => (
                            <div key={j} className="flex items-center gap-2 text-xs text-gray-500">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#6b7c52] shrink-0" />
                              {step}
                            </div>
                          ))}
                          {loading && i === messages.length - 1 && (
                            <div className="flex items-center gap-2 text-xs text-[#6b7c52]">
                              <svg className="w-3 h-3 animate-spin shrink-0" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
                              </svg>
                              Working...
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text */}
                      {msg.text && (
                        <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm">
                          {msg.text.split("\n").map((line, i) => (
                            <p key={i} className={i > 0 ? "mt-1" : ""}>
                              {line.split(/(\*\*.*?\*\*)/).map((part, j) =>
                                part.startsWith("**") && part.endsWith("**")
                                  ? <strong key={j}>{part.slice(2, -2)}</strong>
                                  : part
                              )}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Results cards */}
                      {msg.places && msg.places.length > 0 && (
                        <PlacesCards places={msg.places} onRestart={restartChat} />
                      )}

                      {/* Thinking state */}
                      {loading && i === messages.length - 1 && !msg.text && (!msg.steps || msg.steps.length === 0) && (
                        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 text-xs text-gray-400 shadow-sm">
                          Thinking...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Fixed input bar at bottom */}
      <div className={`${hasMessages ? "sticky bottom-0" : "fixed bottom-0 left-0 right-0"} px-4 pb-6 pt-2`}>
        <div className="max-w-2xl mx-auto">
          {/* Quick action chips — only show before first message */}
          {!hasMessages && (
            <div className="flex flex-wrap gap-2 justify-center mb-3">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action}
                  onClick={() => sendMessage(action)}
                  className="text-xs bg-white border border-gray-200 text-gray-600 rounded-full px-3 py-1.5 hover:border-[#8a9a6a] hover:text-[#4a5c3a] transition-colors shadow-sm"
                >
                  {action}
                </button>
              ))}
            </div>
          )}

          {/* Input box */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md flex items-center gap-2 px-4 py-3">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="What may I arrange for you this evening?"
              disabled={loading}
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none disabled:opacity-50 leading-relaxed"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-xl bg-[#4a5c3a] flex items-center justify-center shrink-0 hover:bg-[#344231] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

const AVATAR_COLORS = [
  "bg-[#e8edd8] text-[#4a5c3a]",
  "bg-emerald-100 text-emerald-600",
  "bg-orange-100 text-orange-600",
  "bg-pink-100 text-pink-600",
  "bg-blue-100 text-blue-600",
  "bg-yellow-100 text-yellow-600",
];

function PlaceLogo({ name, photoUrl, colorClass }: { name: string; photoUrl?: string | null; colorClass: string }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  if (photoUrl && !imgFailed) {
    return (
      <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 shadow-sm bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-bold shrink-0 ${colorClass}`}>
      {initials}
    </div>
  );
}

type ReviewData = {
  rating: number;
  reviewCount: number;
  photoUrl: string | null;
  reviews: { author: string; text: string; rating: number }[];
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-yellow-400 text-sm">★</span>
      <span className="text-sm font-semibold text-gray-800">{rating.toFixed(1)}</span>
    </div>
  );
}

function PlaceCard({ p, colorClass }: { p: Place; colorClass: string }) {
  const router = useRouter();
  const [review, setReview] = useState<ReviewData | null>(null);
  const [loadingReview, setLoadingReview] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const address = [p.street_address, p.city, p.state, p.zip].filter(Boolean).join(", ");

  useEffect(() => {
    fetch(`/api/reviews?name=${encodeURIComponent(p.name)}&address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => { if (d.rating) setReview(d); })
      .catch(() => {})
      .finally(() => setLoadingReview(false));
  }, [p.name, address]);

  function goToDetail() {
    const qs = new URLSearchParams({
      name: p.name ?? "",
      street_address: p.street_address ?? "",
      city: p.city ?? "",
      state: p.state ?? "",
      zip: p.zip ?? "",
      phone: p.phone ?? "",
      website: p.website ?? "",
      categories: p.categories ?? "",
      email: p.email ?? "",
    });
    router.push(`/place?${qs.toString()}`);
  }

  return (
    <div
      onClick={goToDetail}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm px-4 py-4 hover:shadow-md transition-shadow cursor-pointer"
    >
      <div className="flex gap-4">
        {/* Logo */}
        {loadingReview && !review ? (
          <div className="w-16 h-16 rounded-2xl bg-gray-100 shrink-0 flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-300 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
            </svg>
          </div>
        ) : (
          <PlaceLogo name={p.name} photoUrl={review?.photoUrl} colorClass={colorClass} />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-gray-900 leading-tight">{p.name}</h3>
            {p.website && (
              <a href={normalizeUrl(p.website)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 text-[#6b7c52] hover:text-[#344231]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            )}
          </div>

          {p.categories && <p className="text-xs text-[#4a5c3a] mt-0.5">{p.categories}</p>}
          {address && <p className="text-xs text-gray-400 mt-0.5 truncate">{address}</p>}

          {/* Rating */}
          {loadingReview && !review && (
            <div className="flex items-center gap-2 mt-1.5">
              <div className="h-3 w-20 bg-gray-100 rounded-full animate-pulse" />
              <div className="h-3 w-16 bg-gray-100 rounded-full animate-pulse" />
            </div>
          )}
          {review && (
            <div className="flex items-center gap-2 mt-1.5">
              <StarRating rating={review.rating} />
              <span className="text-xs text-gray-400">({review.reviewCount.toLocaleString()} reviews)</span>
              {review.reviews.length > 0 && (
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
                  className="text-xs text-[#6b7c52] hover:text-[#344231] ml-auto"
                >
                  {expanded ? "Hide reviews" : "See reviews"}
                </button>
              )}
            </div>
          )}

          {/* Chips */}
          <div className="flex flex-wrap gap-2 mt-2.5">
            {p.phone && (
              <a href={`tel:${p.phone}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 hover:bg-gray-200">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {p.phone}
              </a>
            )}
            {p.email && (
              <a href={`mailto:${p.email}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-1 text-xs bg-gray-100 text-gray-600 rounded-full px-2.5 py-1 hover:bg-gray-200">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {p.email}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Expanded reviews */}
      {expanded && review && review.reviews.length > 0 && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          {review.reviews.map((r, i) => (
            <div key={i} className="text-xs text-gray-600">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-gray-800">{r.author}</span>
                <span className="text-yellow-400">{"★".repeat(r.rating)}</span>
              </div>
              <p className="text-gray-500 leading-relaxed line-clamp-3">{r.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlacesCards({ places, onRestart }: { places: Place[]; onRestart: () => void }) {
  const [showEmail, setShowEmail] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function sendEmail() {
    if (!emailTo.trim()) return;
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: emailTo.trim(), places }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEmailStatus("sent");
      setTimeout(() => { setShowEmail(false); setEmailStatus("idle"); setEmailTo(""); }, 2000);
    } catch {
      setEmailStatus("error");
    }
  }

  return (
    <div className="w-full space-y-2">
      {places.map((p, i) => (
        <PlaceCard key={i} p={p} colorClass={AVATAR_COLORS[i % AVATAR_COLORS.length]} />
      ))}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1 px-1">
        <span className="text-xs text-gray-400">
          {places.length} place{places.length !== 1 ? "s" : ""} saved to Google Sheets
        </span>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowEmail(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#4a5c3a] hover:text-[#344231] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Send via Email
          </button>
          <button
            onClick={onRestart}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restart Chat
          </button>
        </div>
      </div>

      {/* Email Modal */}
      {showEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Send list via Email</h3>
            <p className="text-xs text-gray-500 mb-4">
              We'll send {places.length} result{places.length !== 1 ? "s" : ""} as a formatted email.
            </p>
            <input
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendEmail()}
              placeholder="you@example.com"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a9a6a] mb-4"
              autoFocus
            />
            {emailStatus === "error" && (
              <p className="text-xs text-red-500 mb-3">Failed to send. Check the address and try again.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowEmail(false); setEmailStatus("idle"); setEmailTo(""); }}
                className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={sendEmail}
                disabled={!emailTo.trim() || emailStatus === "sending" || emailStatus === "sent"}
                className="flex-1 bg-[#4a5c3a] text-white rounded-xl py-2.5 text-sm font-medium hover:bg-[#344231] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {emailStatus === "sending" ? "Sending..." : emailStatus === "sent" ? "Sent!" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
