"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

type DetailData = {
  rating: number;
  reviewCount: number;
  photoUrl: string | null;
  photos: string[];
  placeId: string | null;
  reviews: { author: string; text: string; rating: number }[];
};

function normalizeUrl(url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

function StarRating({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`${size === "lg" ? "text-xl" : "text-sm"} ${i <= Math.round(rating) ? "text-yellow-400" : "text-gray-200"}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function PlaceDetailContent() {
  const params = useSearchParams();
  const router = useRouter();

  const name = params.get("name") ?? "";
  const street_address = params.get("street_address") ?? "";
  const city = params.get("city") ?? "";
  const state = params.get("state") ?? "";
  const zip = params.get("zip") ?? "";
  const phone = params.get("phone") ?? "";
  const website = params.get("website") ?? "";
  const categories = params.get("categories") ?? "";
  const email = params.get("email") ?? "";

  const address = [street_address, city, state, zip].filter(Boolean).join(", ");

  const [data, setData] = useState<DetailData | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    fetch(`/api/reviews?name=${encodeURIComponent(name)}&address=${encodeURIComponent(address)}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoadingData(false));
  }, [name, address]);

  const photos = data?.photos ?? (data?.photoUrl ? [data.photoUrl] : []);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#ede8dc]">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-[#4a5c3a] transition-colors shrink-0"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <span className="text-gray-300 shrink-0">|</span>
        <h1 className="text-sm font-semibold text-gray-900 truncate">{name}</h1>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Photo carousel */}
        <div className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-100">
          {loadingData ? (
            <div className="flex">
              <div className="hidden md:flex flex-col gap-2 p-3 w-24 shrink-0">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="w-full aspect-square rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
              <div className="flex-1 aspect-[4/3] bg-gray-100 animate-pulse" />
            </div>
          ) : photos.length > 0 ? (
            <div className="flex flex-col md:flex-row">
              {/* Thumbnails — desktop only, vertical strip on left */}
              {photos.length > 1 && (
                <div className="hidden md:flex flex-col gap-2 p-3 w-24 shrink-0 overflow-y-auto max-h-[500px]">
                  {photos.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setActivePhoto(i)}
                      className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                        i === activePhoto
                          ? "border-[#4a5c3a] shadow-md opacity-100"
                          : "border-transparent opacity-50 hover:opacity-80"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`${name} photo ${i + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Main photo */}
              <div className="relative flex-1 bg-gray-100" style={{ minHeight: "320px" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photos[activePhoto]}
                  alt={name}
                  className="w-full h-full object-cover"
                  style={{ maxHeight: "500px" }}
                />

                {/* Prev / Next */}
                {photos.length > 1 && (
                  <>
                    <button
                      onClick={() => setActivePhoto((p) => (p - 1 + photos.length) % photos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setActivePhoto((p) => (p + 1) % photos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 backdrop-blur shadow flex items-center justify-center hover:bg-white transition-colors"
                    >
                      <svg className="w-4 h-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Dot indicators */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {photos.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setActivePhoto(i)}
                          className={`rounded-full transition-all ${
                            i === activePhoto ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="h-64 bg-gradient-to-br from-[#e8edd8] to-[#dde3c8] flex items-center justify-center">
              <span className="text-6xl font-bold text-indigo-200">{initials}</span>
            </div>
          )}
        </div>

        {/* Place info */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 leading-tight">{name}</h2>
              {categories && <p className="text-sm text-[#4a5c3a] mt-1">{categories}</p>}
            </div>
            {data && data.rating > 0 && (
              <div className="text-right shrink-0">
                <div className="flex items-center gap-1.5 justify-end">
                  <StarRating rating={data.rating} size="lg" />
                  <span className="text-xl font-bold text-gray-900">{data.rating.toFixed(1)}</span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">{data.reviewCount.toLocaleString()} reviews</p>
              </div>
            )}
          </div>

          <div className="space-y-3 border-t border-gray-50 pt-4">
            {address && (
              <div className="flex items-start gap-3 text-sm text-gray-600">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {address}
              </div>
            )}
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-3 text-sm text-gray-600 hover:text-[#4a5c3a] transition-colors">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {phone}
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="flex items-center gap-3 text-sm text-gray-600 hover:text-[#4a5c3a] transition-colors">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {email}
              </a>
            )}
            {website && (
              <a
                href={normalizeUrl(website)}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 text-sm text-[#4a5c3a] hover:text-[#344231] transition-colors"
              >
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                Visit website
              </a>
            )}
          </div>

          {/* WhatsApp share */}
          <div className="border-t border-gray-50 pt-4">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(
                [
                  `✨ ${name}`,
                  categories && `📍 ${categories}`,
                  address && address,
                  phone && `📞 ${phone}`,
                  website && normalizeUrl(website),
                  data?.placeId
                    ? `🗺️ https://www.google.com/maps/place/?q=place_id:${data.placeId}`
                    : address
                    ? `🗺️ https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + address)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join("\n")
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-medium rounded-2xl px-5 py-2.5 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Share on WhatsApp
            </a>
          </div>
        </div>

        {/* Reviews */}
        {(loadingData || (data && data.reviews.length > 0)) && (
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-base font-bold text-gray-900">Reviews</h3>
              {data && data.rating > 0 && (
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl font-bold text-gray-900">{data.rating.toFixed(1)}</span>
                  <div>
                    <StarRating rating={data.rating} size="lg" />
                    <p className="text-xs text-gray-400 mt-0.5">{data.reviewCount.toLocaleString()} total</p>
                  </div>
                </div>
              )}
            </div>

            {loadingData ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2 animate-pulse">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100" />
                      <div className="space-y-1.5">
                        <div className="h-3 w-28 bg-gray-100 rounded-full" />
                        <div className="h-3 w-20 bg-gray-100 rounded-full" />
                      </div>
                    </div>
                    <div className="h-3 w-full bg-gray-100 rounded-full" />
                    <div className="h-3 w-4/5 bg-gray-100 rounded-full" />
                  </div>
                ))}
              </div>
            ) : data?.reviews.length ? (
              <div className="space-y-6">
                {data.reviews.map((r, i) => (
                  <div
                    key={i}
                    className={i < data.reviews.length - 1 ? "pb-6 border-b border-gray-50" : ""}
                  >
                    <div className="flex items-center gap-3 mb-2.5">
                      <div className="w-9 h-9 rounded-full bg-[#e8edd8] flex items-center justify-center text-sm font-bold text-[#4a5c3a] shrink-0">
                        {r.author.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{r.author}</p>
                        <StarRating rating={r.rating} />
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No reviews available.</p>
            )}
          </div>
        )}

        <div className="h-6" />
      </div>
    </div>
  );
}

export default function PlacePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#ede8dc] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#6b7c52] animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        </div>
      }
    >
      <PlaceDetailContent />
    </Suspense>
  );
}
