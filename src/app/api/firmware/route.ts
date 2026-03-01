/**
 * Server-side proxy for ArduPilot firmware binary downloads.
 *
 * Bypasses CORS restrictions when the browser fetches .apj files
 * from firmware.ardupilot.org.
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HOSTS = [
  "firmware.ardupilot.org",
  "build.betaflight.com",
  "github.com",
  "objects.githubusercontent.com",
];

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: `Only ${ALLOWED_HOSTS.join(", ")} URLs allowed` }, { status: 403 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${res.status}` },
        { status: 502 },
      );
    }

    const body = await res.arrayBuffer();
    return new NextResponse(body, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
