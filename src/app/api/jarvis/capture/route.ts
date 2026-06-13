import { NextResponse } from "next/server";
import { createJarvisCapture } from "@/lib/jarvis/mutations";
import { getJarvisAccess, isJarvisLiveAccess } from "@/lib/jarvis/server";
import { jarvisCaptureSchema } from "@/lib/jarvis/validators";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        message: "The capture payload could not be parsed.",
      },
      { status: 400 },
    );
  }

  const parsed = jarvisCaptureSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        message: "Please review the highlighted fields.",
        errors: parsed.error.flatten().fieldErrors,
      },
      { status: 422 },
    );
  }

  const normalizedInput = {
    ...parsed.data,
    participants: Array.from(
      new Set(parsed.data.participants.map((participant) => participant.trim()).filter(Boolean)),
    ).slice(0, 12),
    happenedAt: null as string | null,
  };

  if (parsed.data.happenedAt) {
    const parsedDate = new Date(parsed.data.happenedAt);

    if (Number.isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        {
          message: "Please provide a valid happened-at timestamp.",
          errors: {
            happenedAt: ["Please provide a valid happened-at timestamp."],
          },
        },
        { status: 422 },
      );
    }

    normalizedInput.happenedAt = parsedDate.toISOString();
  }

  const access = await getJarvisAccess();

  if (access.kind === "anonymous") {
    return NextResponse.json(
      {
        success: false,
        mode: "degraded",
        message: "You need to sign in before JARVIS can write captures.",
        echo: normalizedInput,
      },
      { status: 401 },
    );
  }

  if (access.kind === "demo") {
    return NextResponse.json({
      success: false,
      mode: access.status.mode,
      message:
        "Supabase is not configured, so this submission is returning a typed preview instead of persisting data.",
      echo: normalizedInput,
    });
  }

  if (access.kind === "degraded") {
    return NextResponse.json(
      {
        success: false,
        mode: access.status.mode,
        message: access.status.detail,
        echo: normalizedInput,
      },
      { status: 503 },
    );
  }

  if (!isJarvisLiveAccess(access)) {
    return NextResponse.json(
      {
        success: false,
        mode: access.status.mode,
        message: access.status.detail,
        echo: normalizedInput,
      },
      { status: 503 },
    );
  }

  const result = await createJarvisCapture(access, normalizedInput);

  return NextResponse.json(result, {
    status: result.success ? 201 : 503,
  });
}
