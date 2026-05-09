"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { getShortestAngleDelta } from "./modelPair";

export function useZigSimYaw(endpoint: string, pollMs = 100) {
  const [smoothedYaw, setSmoothedYaw] = useState(0);
  const targetYawRef = useRef(0);
  const previousRawYawRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(endpoint, {
          method: "GET",
          cache: "no-store",
        });

        if (!response.ok) {
          console.warn("Failed to fetch Zig Sim data:", response.status);
          if (!cancelled) setTimeout(poll, pollMs);
          return;
        }

        const data = (await response.json()) as {
          latestPackets?: Array<{ raw: unknown; yawExtracted?: number | null }>;
        };

        const latest = data.latestPackets?.[data.latestPackets.length - 1];

        if (latest) {
          let yawDegrees: number | null =
            typeof latest.yawExtracted === "number" ? latest.yawExtracted : null;

          if (yawDegrees === null && latest.raw && typeof latest.raw === "object") {
            const raw = latest.raw as Record<string, unknown>;
            const sensorData = raw.sensordata as Record<string, unknown> | undefined;

            if (sensorData) {
              const q = sensorData.quaternion as Record<string, unknown> | undefined;
              if (q) {
                const w = typeof q.w === "number" ? q.w : null;
                const x = typeof q.x === "number" ? q.x : null;
                const y = typeof q.y === "number" ? q.y : null;
                const z = typeof q.z === "number" ? q.z : null;

                if (w !== null && x !== null && y !== null && z !== null) {
                  const yawRad = Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
                  yawDegrees = THREE.MathUtils.radToDeg(yawRad);
                }
              }
            }
          }

          if (yawDegrees !== null && Number.isFinite(yawDegrees)) {
            const rawYawRad = THREE.MathUtils.degToRad(yawDegrees);
            if (previousRawYawRef.current === null) {
              previousRawYawRef.current = rawYawRad;
              targetYawRef.current = rawYawRad;
            } else {
              const delta = getShortestAngleDelta(rawYawRad, previousRawYawRef.current);
              previousRawYawRef.current = rawYawRad;
              targetYawRef.current += delta;
            }
          }
        }
      } catch (err) {
        console.warn("Zig Sim poll error:", err);
      }

      if (!cancelled) setTimeout(poll, pollMs);
    };

    poll();
    return () => { cancelled = true; };
  }, [endpoint, pollMs]);

  useEffect(() => {
    let frame = 0;
    const animate = () => {
      setSmoothedYaw((current) =>
        THREE.MathUtils.lerp(current, targetYawRef.current, 0.2)
      );
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => { window.cancelAnimationFrame(frame); };
  }, []);

  return smoothedYaw;
}
