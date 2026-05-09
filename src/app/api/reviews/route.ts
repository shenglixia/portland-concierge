import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export type ReviewData = {
  rating: number;
  reviewCount: number;
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

  // Step 2: Get place details (rating + reviews)
  const detailRes = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total,reviews&key=${API_KEY}`
  );
  const detailData = await detailRes.json();
  const result = detailData.result;

  const data: ReviewData = {
    rating: result?.rating ?? 0,
    reviewCount: result?.user_ratings_total ?? 0,
    reviews: (result?.reviews ?? []).slice(0, 3).map((r: {author_name: string; text: string; rating: number}) => ({
      author: r.author_name,
      text: r.text,
      rating: r.rating,
    })),
  };

  return NextResponse.json(data);
}
