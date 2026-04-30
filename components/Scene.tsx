"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

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

        // Get the most recent packet
        const latest = data.latestPackets?.[data.latestPackets.length - 1];
        if (latest) {
          let yawDegrees: number | null =
            typeof latest.yawExtracted === "number" ? latest.yawExtracted : null;

          // Fallback: parse nested Zig Sim payload on the client.
          if (
            yawDegrees === null &&
            latest.raw &&
            typeof latest.raw === "object"
          ) {
            const raw = latest.raw as Record<string, unknown>;
            const sensorData = raw.sensordata as Record<string, unknown> | undefined;

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

function Sculpture({
  controlsRef,
  externalYaw,
  controlMode,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  externalYaw: number;
  controlMode: ControlMode;
}) {
  const fadedGltf = useGLTF("/models/Panjurli_faded.glb");
  const recoloredGltf = useGLTF("/models/Panjurli_recolored.glb");

  const previousControlAngleRef = useRef<number | null>(null);
  const colorProgressRef = useRef(0);

  useEffect(() => {
    previousControlAngleRef.current = null;
  }, [controlMode]);

  const { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials } =
    useMemo(() => {
      const fadedScene = fadedGltf.scene.clone(true);
      const recoloredScene = recoloredGltf.scene.clone(true);

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
    }, [fadedGltf.scene, recoloredGltf.scene]);

  useFrame(() => {
    const mouseAngle = controlsRef.current?.getAzimuthalAngle() ?? 0;
    // OrbitControls azimuth is camera-centered, opposite to model yaw direction.
    // Invert it so both phone and mouse use the same "model turns right" semantics.
    const normalizedMouseAngle = -mouseAngle;
    const currentAngle =
      controlMode === "phone" ? externalYaw : normalizedMouseAngle;

    if (previousControlAngleRef.current === null) {
      previousControlAngleRef.current = currentAngle;

      setSceneOpacity(fadedScene, fadedMaterials, 1 - colorProgressRef.current);
      setSceneOpacity(recoloredScene, recoloredMaterials, colorProgressRef.current);

      return;
    }

    const delta = getShortestAngleDelta(
      currentAngle,
      previousControlAngleRef.current
    );

    previousControlAngleRef.current = currentAngle;

    // Linear reversible mapping:
    // right turn (negative delta) -> progress increases
    // left turn (positive delta)  -> progress decreases
    const step = -delta / (Math.PI * 2);
    colorProgressRef.current = THREE.MathUtils.clamp(
      colorProgressRef.current + step,
      0,
      1
    );

    setSceneOpacity(fadedScene, fadedMaterials, 1 - colorProgressRef.current);
    setSceneOpacity(recoloredScene, recoloredMaterials, colorProgressRef.current);
  });

  return (
    <group
      position={[0, 0.15, 0]}
      rotation={[0, controlMode === "phone" ? externalYaw : 0, 0]}
    >
      <group scale={1.5} rotation={[-Math.PI / 2, Math.PI / 180, 0]}>
        <primitive object={fadedScene} />
        <primitive object={recoloredScene} />
      </group>
    </group>
  );
}

function Pedestal() {
  return (
    <mesh position={[0, -0.35, 0]}>
      <cylinderGeometry args={[1.0, 1.25, 0.3, 64]} />
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

    const playMusic = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch {
        setIsPlaying(false);
      }
    };

    playMusic();
  }, []);

  const toggleMusic = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!isPlaying) {
      try {
        audio.muted = false;
        await audio.play();
        setIsPlaying(true);
        setIsMuted(false);
      } catch {
        console.log("Audio playback was blocked by the browser.");
      }
      return;
    }

    audio.muted = !audio.muted;
    setIsMuted(audio.muted);
  };

  return (
    <>
      <audio ref={audioRef} src="/audio/bg-2.mp3" preload="auto" />

      <button
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

export default function Scene() {
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const zigSimYaw = useZigSimYaw("/api/zigsim");
  const [controlMode, setControlMode] = useState<ControlMode>("phone");

  return (
    <div className="relative h-screen w-screen bg-black">
      <Canvas camera={{ position: [0, 1.0, 4], fov: 45 }}>
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        <group position={[0, -0.2, 0]}>
          <Pedestal />
          <Sculpture
            controlsRef={controlsRef}
            externalYaw={zigSimYaw}
            controlMode={controlMode}
          />
        </group>

        <OrbitControls
          ref={controlsRef}
          enableRotate={controlMode === "mouse"}
          enablePan={false}
          enableZoom={false}
          enableDamping={false}
          autoRotate={false}
          minPolarAngle={Math.PI / 2}
          maxPolarAngle={Math.PI / 2}
        />
      </Canvas>

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