import type { NextRequest } from "next/server";
import { searchSecurities } from "@/features/portfolio/server";

export async function GET(request: NextRequest): Promise<Response> {
  return Response.json(await searchSecurities(request.nextUrl.searchParams.get("q") ?? ""));
}
