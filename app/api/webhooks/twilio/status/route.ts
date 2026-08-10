import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  void request;
  return NextResponse.json(
    { error: "SMS webhook has been disabled." },
    { status: 410 },
  );
}
