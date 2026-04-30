import { WebSocketServer } from "ws";
import type { Server } from "http";
import type WebSocket from "ws";
export { extractYawDegrees } from "./zigsim";

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

