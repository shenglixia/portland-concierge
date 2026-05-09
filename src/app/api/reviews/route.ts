import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export type ReviewData = {
  rating: number;
  reviewCount: number;
  photoUrl: string | null;
  photos: string[];
  placeId: string | null;
  openNow: boolean | null;
  hours: string[];
  reviews: { author: string; text: string; rating: number }[];
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = searchParams.get("name");
  const address = searchParams.get("address");

  if (!name) return NextResponse.json({ error: "Missing name" }, { status: 400 });

  // Step 1: Find place ID via Text Search
  const query = [name, address].filter(Boolean).join(" ");
  const searchRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id&key=${API_KEY}`
  );
  const searchData = await searchRes.json();
  const placeId = searchData.candidates?.[0]?.place_id;

  if (!placeId) return NextResponse.json({ error: "Place not found" }, { status: 404 });

  // Step 2: Get place details (rating + reviews + photo + hours)
  const detailRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,reviews,photos,opening_hours&key=${API_KEY}`
  );
  const detailData = await detailRes.json();
  const result = detailData.result;

  // Build photo URLs from all available photo references (up to 8)
  const rawPhotos: { photo_reference: string }[] = result?.photos ?? [];
  const photos = rawPhotos.slice(0, 8).map(
    (p) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${p.photo_reference}&key=${API_KEY}`
  );
  const photoUrl = photos[0] ?? null;

  const data: ReviewData = {
    rating: result?.rating ?? 0,
    reviewCount: result?.user_ratings_total ?? 0,
    photoUrl,
    photos,
    placeId: placeId ?? null,
    openNow: result?.opening_hours?.open_now ?? null,
    hours: result?.opening_hours?.weekday_text ?? [],
    reviews: (result?.reviews ?? []).slice(0, 5).map((r: {author_name: string; text: string; rating: number}) => ({
      author: r.author_name,
      text: r.text,
      rating: r.rating,
    })),
  };

  return NextResponse.json(data);
}
