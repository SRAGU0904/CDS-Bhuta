import { WebSocketServer } from "ws";
import type { Server } from "http";
import type WebSocket from "ws";

type YawStore = {
  yawDegrees: number;
  updatedAt: number;
};

let yawStore: YawStore = {
  yawDegrees: 0,
  updatedAt: Date.now(),
};

const clients = new Set<WebSocket>();

export function initWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/zigsim" });

  wss.on("connection", (ws) => {
    clients.add(ws);

    // Send current state immediately on connect
    ws.send(
      JSON.stringify({
        type: "sync",
        ...yawStore,
      })
    );

    ws.on("close", () => {
      clients.delete(ws);
    });

    ws.on("error", () => {
      clients.delete(ws);
    });
  });

  return { wss, setYaw };
}

function setYaw(yawDegrees: number) {
  yawStore = {
    yawDegrees,
    updatedAt: Date.now(),
  };

  // Broadcast to all connected clients
  const message = JSON.stringify({
    type: "update",
    ...yawStore,
  });

  clients.forEach((ws) => {
    if (ws.readyState === 1) {
      // WebSocket.OPEN
      ws.send(message);
    }
  });
}

export function extractYawDegrees(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;

  const getNumber = (value: unknown): number | null => {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const directYaw = getNumber(source.yaw);
  if (directYaw !== null) return directYaw;

  const attitudeYaw = (source.attitude as Record<string, unknown> | undefined)
    ?.yaw;
  const attitudeYawNumber = getNumber(attitudeYaw);
  if (attitudeYawNumber !== null) return attitudeYawNumber;

  const rotationY = (source.rotation as Record<string, unknown> | undefined)
    ?.y;
  const rotationYNumber = getNumber(rotationY);
  if (rotationYNumber !== null) return rotationYNumber;

  const dataYaw = (source.data as Record<string, unknown> | undefined)?.yaw;
  const dataYawNumber = getNumber(dataYaw);
  if (dataYawNumber !== null) return dataYawNumber;

  // Zig Sim style nested payload: sensordata.quaternion / sensordata.gravity
  const sensorData = source.sensordata as Record<string, unknown> | undefined;
  if (sensorData) {
    const sensorYaw = getNumber(sensorData.yaw);
    if (sensorYaw !== null) return sensorYaw;

    const q = sensorData.quaternion as Record<string, unknown> | undefined;
    if (q) {
      const w = getNumber(q.w);
      const x = getNumber(q.x);
      const y = getNumber(q.y);
      const z = getNumber(q.z);

      if (w !== null && x !== null && y !== null && z !== null) {
        const yawRad = Math.atan2(
          2 * (w * z + x * y),
          1 - 2 * (y * y + z * z)
        );
        return (yawRad * 180) / Math.PI;
      }
    }

    const gravity = sensorData.gravity as Record<string, unknown> | undefined;
    if (gravity) {
      const gx = getNumber(gravity.x);
      const gz = getNumber(gravity.z);
      if (gx !== null && gz !== null) {
        const yawRad = Math.atan2(gx, -gz);
        return (yawRad * 180) / Math.PI;
      }
    }
  }

  return null;
}
