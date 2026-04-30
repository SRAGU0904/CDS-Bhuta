import { NextResponse } from "next/server";
import { extractYawDegrees } from "@/server/websocket";

const globalStore = globalThis as unknown as {
  __setYaw?: (yaw: number) => void;
  __zigSimPackets?: Array<{ raw: unknown; receivedAt: number }>;
};

if (!globalStore.__zigSimPackets) {
  globalStore.__zigSimPackets = [];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const yawDegrees = extractYawDegrees(payload);

    // Store complete packet
    if (!globalStore.__zigSimPackets) {
      globalStore.__zigSimPackets = [];
    }

    globalStore.__zigSimPackets.push({
      raw: payload,
      receivedAt: Date.now(),
    });

    if (globalStore.__zigSimPackets.length > 50) {
      globalStore.__zigSimPackets.shift();
    }

    console.log("[POST /api] Zig Sim data received:", {
      yaw: yawDegrees,
      payloadKeys: Object.keys(
        payload && typeof payload === "object" ? payload : {}
      ),
      timestamp: new Date().toISOString(),
    });

    if (yawDegrees !== null && globalStore.__setYaw) {
      globalStore.__setYaw(yawDegrees);
    }

    return NextResponse.json({
      ok: true,
      yawDegrees,
      receivedAt: Date.now(),
      message: "Data received at /api",
    });
  } catch (err) {
    console.error("[POST /api] Error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON payload",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Zig Sim API endpoint",
    endpoint: "/api or /api/zigsim",
    latestPackets: (globalStore.__zigSimPackets || []).slice(-10),
    totalReceived: globalStore.__zigSimPackets?.length || 0,
  });
}
