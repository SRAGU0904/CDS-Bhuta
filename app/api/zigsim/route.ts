import { NextResponse } from "next/server";
import { extractYawDegrees } from "@/server/websocket";

type DataPacket = {
  raw: unknown;
  receivedAt: number;
  yawExtracted: number | null;
};

const globalStore = globalThis as unknown as {
  __setYaw?: (yaw: number) => void;
  __zigSimPackets?: DataPacket[];
};

if (!globalStore.__zigSimPackets) {
  globalStore.__zigSimPackets = [];
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as unknown;
    const yawDegrees = extractYawDegrees(payload);

    // Store complete packet (keep last 50)
    const packet: DataPacket = {
      raw: payload,
      receivedAt: Date.now(),
      yawExtracted: yawDegrees,
    };

    if (!globalStore.__zigSimPackets) {
      globalStore.__zigSimPackets = [];
    }

    globalStore.__zigSimPackets.push(packet);
    if (globalStore.__zigSimPackets.length > 50) {
      globalStore.__zigSimPackets.shift();
    }

    if (yawDegrees === null) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing yaw value. Accepted fields: yaw, attitude.yaw, rotation.y, data.yaw",
          receivedPayload: payload,
        },
        { status: 400 }
      );
    }

    // Notify WebSocket server to broadcast to clients
    if (globalStore.__setYaw) {
      globalStore.__setYaw(yawDegrees);
    }

    return NextResponse.json({
      ok: true,
      yawDegrees,
      receivedAt: packet.receivedAt,
    });
  } catch (err) {
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
    latestPackets: (globalStore.__zigSimPackets || []).slice(-10),
    totalReceived: globalStore.__zigSimPackets?.length || 0,
  });
}