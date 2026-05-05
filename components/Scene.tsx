"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

type ControlMode = "phone" | "mouse";

function useZigSimYaw(endpoint: string, pollMs = 100) {
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
          if (!cancelled) {
            setTimeout(poll, pollMs);
          }
          return;
        }

        const data = (await response.json()) as {
          latestPackets?: Array<{ raw: unknown; yawExtracted?: number | null }>;
        };

        const latest = data.latestPackets?.[data.latestPackets.length - 1];

        if (latest) {
          let yawDegrees: number | null =
            typeof latest.yawExtracted === "number"
              ? latest.yawExtracted
              : null;

          if (
            yawDegrees === null &&
            latest.raw &&
            typeof latest.raw === "object"
          ) {
            const raw = latest.raw as Record<string, unknown>;
            const sensorData = raw.sensordata as
              | Record<string, unknown>
              | undefined;

            if (sensorData) {
              const q = sensorData.quaternion as
                | Record<string, unknown>
                | undefined;

              if (q) {
                const w = typeof q.w === "number" ? q.w : null;
                const x = typeof q.x === "number" ? q.x : null;
                const y = typeof q.y === "number" ? q.y : null;
                const z = typeof q.z === "number" ? q.z : null;

                if (w !== null && x !== null && y !== null && z !== null) {
                  const yawRad = Math.atan2(
                    2 * (w * z + x * y),
                    1 - 2 * (y * y + z * z)
                  );

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
              const delta = getShortestAngleDelta(
                rawYawRad,
                previousRawYawRef.current
              );

              previousRawYawRef.current = rawYawRad;

              // Keep a continuous yaw signal to avoid +-PI wrap jumps.
              targetYawRef.current += delta;
            }
          }
        }
      } catch (err) {
        console.warn("Zig Sim poll error:", err);
      }

      if (!cancelled) {
        setTimeout(poll, pollMs);
      }
    };

    poll();

    return () => {
      cancelled = true;
    };
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

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return smoothedYaw;
}

function collectMaterials(object: THREE.Object3D) {
  const materials: THREE.Material[] = [];

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.frustumCulled = false;

    if (Array.isArray(child.material)) {
      child.material = child.material.map((mat) => {
        const cloned = mat.clone();
        cloned.transparent = true;
        cloned.depthWrite = false;
        cloned.needsUpdate = true;
        return cloned;
      });

      materials.push(...child.material);
    } else if (child.material) {
      const cloned = child.material.clone();
      cloned.transparent = true;
      cloned.depthWrite = false;
      cloned.needsUpdate = true;

      child.material = cloned;
      materials.push(cloned);
    }
  });

  return materials;
}

function setSceneOpacity(
  scene: THREE.Object3D,
  materials: THREE.Material[],
  opacity: number
) {
  const safeOpacity = THREE.MathUtils.clamp(opacity, 0, 1);

  scene.visible = safeOpacity > 0.01;

  materials.forEach((mat) => {
    mat.transparent = true;
    mat.depthWrite = false;
    mat.opacity = safeOpacity;
    mat.needsUpdate = true;
  });
}

function getShortestAngleDelta(current: number, previous: number) {
  let delta = current - previous;

  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;

  return delta;
}

type ModelPair = {
  fadedScene: THREE.Object3D;
  recoloredScene: THREE.Object3D;
  fadedMaterials: THREE.Material[];
  recoloredMaterials: THREE.Material[];
};

function createModelPair(
  fadedSource: THREE.Object3D,
  recoloredSource: THREE.Object3D
): ModelPair {
  const fadedScene = fadedSource.clone(true);
  const recoloredScene = recoloredSource.clone(true);

  fadedScene.traverse((child) => {
    child.renderOrder = 1;
  });

  recoloredScene.traverse((child) => {
    child.renderOrder = 2;
  });

  const fadedMaterials = collectMaterials(fadedScene);
  const recoloredMaterials = collectMaterials(recoloredScene);

  setSceneOpacity(fadedScene, fadedMaterials, 1);
  setSceneOpacity(recoloredScene, recoloredMaterials, 0);

  return {
    fadedScene,
    recoloredScene,
    fadedMaterials,
    recoloredMaterials,
  };
}

function ModelView({
  pair,
  position,
  baseYaw,
  yaw,
}: {
  pair: ModelPair;
  position: [number, number, number];
  baseYaw: number;
  yaw: number;
}) {
  return (
    <group position={position} rotation={[0, baseYaw + yaw, 0]}>
      <group scale={1.5} rotation={[-Math.PI / 2, Math.PI / 180, 0]}>
        <primitive object={pair.fadedScene} />
        <primitive object={pair.recoloredScene} />
      </group>
    </group>
  );
}

function DualSculpture({
  yaw,
  controlMode,
}: {
  yaw: number;
  controlMode: ControlMode;
}) {
  const fadedGltf = useGLTF("/models/Panjurli_faded.glb");
  const recoloredGltf = useGLTF("/models/Panjurli_recolored.glb");

  const previousControlAngleRef = useRef<number | null>(null);
  const colorProgressRef = useRef(0);

  useEffect(() => {
    previousControlAngleRef.current = null;
  }, [controlMode]);

  const { frontPair, backPair } = useMemo(() => {
    const frontPair = createModelPair(fadedGltf.scene, recoloredGltf.scene);
    const backPair = createModelPair(fadedGltf.scene, recoloredGltf.scene);

    return {
      frontPair,
      backPair,
    };
  }, [fadedGltf.scene, recoloredGltf.scene]);

  useFrame(() => {
    const currentAngle = yaw;

    if (previousControlAngleRef.current === null) {
      previousControlAngleRef.current = currentAngle;

      const progress = colorProgressRef.current;

      setSceneOpacity(
        frontPair.fadedScene,
        frontPair.fadedMaterials,
        1 - progress
      );
      setSceneOpacity(
        frontPair.recoloredScene,
        frontPair.recoloredMaterials,
        progress
      );

      setSceneOpacity(
        backPair.fadedScene,
        backPair.fadedMaterials,
        1 - progress
      );
      setSceneOpacity(
        backPair.recoloredScene,
        backPair.recoloredMaterials,
        progress
      );

      return;
    }

    const delta = getShortestAngleDelta(
      currentAngle,
      previousControlAngleRef.current
    );

    previousControlAngleRef.current = currentAngle;

    // Keep the original color logic:
    // right turn, negative delta -> progress increases
    // left turn, positive delta -> progress decreases
    const step = -delta / (Math.PI * 2);

    colorProgressRef.current = THREE.MathUtils.clamp(
      colorProgressRef.current + step,
      0,
      1
    );

    const progress = colorProgressRef.current;

    setSceneOpacity(
      frontPair.fadedScene,
      frontPair.fadedMaterials,
      1 - progress
    );
    setSceneOpacity(
      frontPair.recoloredScene,
      frontPair.recoloredMaterials,
      progress
    );

    setSceneOpacity(
      backPair.fadedScene,
      backPair.fadedMaterials,
      1 - progress
    );
    setSceneOpacity(
      backPair.recoloredScene,
      backPair.recoloredMaterials,
      progress
    );
  });

  return (
    <>
      <group position={[-1.5, 0, 0]}>
        <Pedestal position={[0, -0.35, 0]} />
        <ModelView
          pair={frontPair}
          position={[0, 0.15, 0]}
          baseYaw={0}
          yaw={yaw}
        />
      </group>

      <group position={[1.5, 0, 0]}>
        <Pedestal position={[0, -0.35, 0]} />
        <ModelView
          pair={backPair}
          position={[0, 0.15, 0]}
          baseYaw={Math.PI}
          yaw={yaw}
        />
      </group>
    </>
  );
}

function Pedestal({ position }: { position: [number, number, number] }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.6, 0.8, 0.3, 64]} />
      <meshStandardMaterial color="#333333" />
    </mesh>
  );
}

function MusicControl() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;
    audio.loop = true;
  }, []);

  const toggleMusic = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    const audio = audioRef.current;
    if (!audio) return;

    try {
      if (!isPlaying) {
        audio.muted = false;
        audio.currentTime = audio.currentTime || 0;
        await audio.play();

        setIsPlaying(true);
        setIsMuted(false);
        return;
      }

      audio.muted = !audio.muted;
      setIsMuted(audio.muted);
    } catch (error) {
      console.log("Audio playback failed:", error);
      setIsPlaying(false);
    }
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bg-2.mp3" preload="auto" />

      <button
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.stopPropagation();
        }}
        onClick={toggleMusic}
        className="fixed right-6 top-6 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl text-white backdrop-blur-md transition hover:bg-black/70"
        aria-label="Toggle music"
      >
        {isPlaying && !isMuted ? "🔊" : "🔇"}
      </button>
    </>
  );
}

function ControlModeToggle({
  mode,
  onToggle,
}: {
  mode: ControlMode;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="fixed left-6 top-6 z-50 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-black/70"
      aria-label="Toggle rotation control mode"
    >
      {mode === "phone" ? "Phone Control" : "Mouse Control"}
    </button>
  );
}

function ViewFrames() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10">
      <div className="absolute left-[15vw] top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 rounded-3xl border border-white/25" />
      <div className="absolute right-[15vw] top-1/2 aspect-[9/16] h-[90vh] -translate-y-1/2 rounded-3xl border border-white/25" />
    </div>
  );
}

export default function Scene() {
  const zigSimYaw = useZigSimYaw("/api/zigsim");
  const [controlMode, setControlMode] = useState<ControlMode>("phone");

  const [mouseYaw, setMouseYaw] = useState(0);
  const isDraggingRef = useRef(false);
  const previousPointerXRef = useRef<number | null>(null);

  const activeYaw = controlMode === "phone" ? zigSimYaw : mouseYaw;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (controlMode !== "mouse") return;

    isDraggingRef.current = true;
    previousPointerXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (controlMode !== "mouse") return;
    if (!isDraggingRef.current) return;
    if (previousPointerXRef.current === null) return;

    const deltaX = event.clientX - previousPointerXRef.current;
    previousPointerXRef.current = event.clientX;

    // Drag right -> sculpture turns right.
    // This only changes the sculpture yaw, not the camera or pedestal.
    setMouseYaw((current) => current - deltaX * 0.01);
  };

  const stopDragging = (event: PointerEvent<HTMLDivElement>) => {
    if (controlMode !== "mouse") return;

    isDraggingRef.current = false;
    previousPointerXRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      className="relative h-screen w-screen touch-none bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      <Canvas
        orthographic
        camera={{
          position: [0, 1.0, 5],
          zoom: 250,
        }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        <group position={[0, -0.2, 0]}>
          <DualSculpture yaw={activeYaw} controlMode={controlMode} />
        </group>
      </Canvas>

      <ViewFrames />

      <MusicControl />

      <ControlModeToggle
        mode={controlMode}
        onToggle={() =>
          setControlMode((prev) => (prev === "phone" ? "mouse" : "phone"))
        }
      />
    </div>
  );
}

useGLTF.preload("/models/Panjurli_faded.glb");
useGLTF.preload("/models/Panjurli_recolored.glb");