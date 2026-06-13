import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Legacy label scan endpoint is disabled. Use the authenticated /api/label/scan endpoint instead.",
    },
    { status: 410 }
  );
}
