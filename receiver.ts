import http from "http";
import dgram from "dgram";

const UDP_PORT = 3333;
const STATUS_PORT = 3334;
const FORWARD_URLS = process.env.FORWARD_URL
  ? [process.env.FORWARD_URL]
  : ["http://127.0.0.1:3000/api/zigsim", "http://127.0.0.1:3001/api/zigsim"];

let lastSuccessfulForwardUrl: string | null = null;

type Packet = {
  raw: unknown;
  receivedAt: number;
  sourceIp: string;
  sourcePort: number;
  forwarded: boolean;
};

const packets: Packet[] = [];

const statusServer = http.createServer((_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "Zig Sim UDP receiver is running",
      udpPort: UDP_PORT,
      forwardCandidates: FORWARD_URLS,
      lastSuccessfulForwardUrl,
      totalReceived: packets.length,
      latestPackets: packets.slice(-10),
    })
  );
});

const udpServer = dgram.createSocket("udp4");

async function forwardToApp(payload: unknown): Promise<boolean> {
  for (const url of FORWARD_URLS) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        lastSuccessfulForwardUrl = url;
        return true;
      }
    } catch {
      // Try the next candidate URL.
    }
  }

  return false;
}

udpServer.on("message", async (buffer, rinfo) => {
  const rawText = buffer.toString("utf8").trim();

  try {
    const payload = JSON.parse(rawText) as unknown;
    const forwarded = await forwardToApp(payload);

    const packet: Packet = {
      raw: payload,
      receivedAt: Date.now(),
      sourceIp: rinfo.address,
      sourcePort: rinfo.port,
      forwarded,
    };

    packets.push(packet);
    if (packets.length > 200) {
      packets.shift();
    }

    const keys =
      payload && typeof payload === "object"
        ? Object.keys(payload as Record<string, unknown>)
        : [];

    console.log(`\n[UDP ${new Date().toISOString()}] ${rinfo.address}:${rinfo.port}`);
    console.log("keys:", keys);
    console.log("forwarded to app:", forwarded ? "yes" : "no");
  } catch (err) {
    console.error("\n[UDP] Failed to parse JSON payload");
    console.error("error:", err);
    console.error("raw:", rawText);
  }
});

udpServer.on("error", (err) => {
  console.error("[UDP] server error:", err);
});

udpServer.bind(UDP_PORT, () => {
  console.log(`\n✓ UDP receiver listening on udp://0.0.0.0:${UDP_PORT}`);
  console.log(`✓ Set Zig Sim to UDP -> 172.20.10.2:${UDP_PORT}`);
  console.log(`✓ Status API: http://localhost:${STATUS_PORT}`);
  console.log(`✓ Forwarding packets to app: ${FORWARD_URLS.join(" | ")}\n`);
});

statusServer.listen(STATUS_PORT, () => {
  // Keep this silent to avoid duplicate startup noise.
});
