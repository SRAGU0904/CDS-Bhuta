"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

// ─── Configuration ─────────────────────────────────────────────────────────────

const IDLE_TIMEOUT_MS = 10_000;
const SWITCH_THRESHOLD_RAD = Math.PI * 2 * 3; // 3 full rotations worth of absolute movement
const ACTIVITY_THRESHOLD_RAD = 0.002;
const IDLE_LERP_SPEED = 0.02;
const MODEL_POSITION_Y = 0.15;
const PEDESTAL_TOP_RADIUS = 0.6;
const PEDESTAL_BOTTOM_RADIUS = 0.8;

type ControlMode = "phone" | "mouse";

// Each statue needs a rotation that corrects its coordinate system to Y-up,
// and the axis that becomes the vertical (Y) axis after that rotation.
// fixedScale: use an exact scale; omit to auto-size the statue to the viewport.
type StatueConfig = {
  id: string;
  modelRotation: [number, number, number];
  heightAxis: "y" | "z";
  fixedScale?: number;
  autoBaseRadiusFactor?: number;
};

const STATUE_CONFIGS: StatueConfig[] = [
  {
    id: "panjurli",
    // GLB is Z-up; rotating -90° around X maps Z → world Y
    modelRotation: [-Math.PI / 2, Math.PI / 180, 0],
    heightAxis: "z",
    autoBaseRadiusFactor: 0.75,
  },
  {
    id: "deity",
    // Procedural test statue is Y-up by default
    modelRotation: [0, 0, 0],
    heightAxis: "y",
    // no fixedScale → auto-sized to a fraction of pedestal top radius
    autoBaseRadiusFactor: 0.75,
  },
];

// ─── ZigSim Hook ──────────────────────────────────────────────────────────────

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
          if (!cancelled) setTimeout(poll, pollMs);
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

// ─── Material Utilities ───────────────────────────────────────────────────────

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

// ─── Model Pair ───────────────────────────────────────────────────────────────

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

  return { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials };
}

function applyColorProgress(
  frontPair: ModelPair,
  backPair: ModelPair,
  progress: number
) {
  setSceneOpacity(frontPair.fadedScene, frontPair.fadedMaterials, 1 - progress);
  setSceneOpacity(
    frontPair.recoloredScene,
    frontPair.recoloredMaterials,
    progress
  );
  setSceneOpacity(backPair.fadedScene, backPair.fadedMaterials, 1 - progress);
  setSceneOpacity(
    backPair.recoloredScene,
    backPair.recoloredMaterials,
    progress
  );
}

// ─── Procedural Placeholder ───────────────────────────────────────────────────
// Replace this with a real GLTF by adding a new entry to STATUE_CONFIGS.

function buildProceduralScene(color: THREE.ColorRepresentation): THREE.Object3D {
  const group = new THREE.Group();

  const add = (geom: THREE.BufferGeometry, y: number) => {
    const mesh = new THREE.Mesh(
      geom,
      new THREE.MeshStandardMaterial({ color })
    );
    mesh.position.y = y;
    group.add(mesh);
  };

  add(new THREE.CylinderGeometry(0.35, 0.4, 0.12, 12), 0.06);   // base
  add(new THREE.CylinderGeometry(0.18, 0.28, 0.75, 12), 0.495); // torso
  add(new THREE.SphereGeometry(0.16, 16, 16), 1.0);              // head

  return group;
}

function createProceduralPair(): ModelPair {
  const fadedScene = buildProceduralScene("#888888");
  const recoloredScene = buildProceduralScene("#c85a1e");

  fadedScene.traverse((c) => {
    c.renderOrder = 1;
  });
  recoloredScene.traverse((c) => {
    c.renderOrder = 2;
  });

  const fadedMaterials = collectMaterials(fadedScene);
  const recoloredMaterials = collectMaterials(recoloredScene);

  setSceneOpacity(fadedScene, fadedMaterials, 1);
  setSceneOpacity(recoloredScene, recoloredMaterials, 0);

  return { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials };
}

function createBoxPair(): ModelPair {
  const createBoxScene = (color: THREE.ColorRepresentation) => {
    const group = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 2.1, 0.9),
      new THREE.MeshStandardMaterial({ color })
    );
    mesh.position.y = 1.05;
    group.add(mesh);
    return group;
  };

  const fadedScene = createBoxScene("#888888");
  const recoloredScene = createBoxScene("#c85a1e");

  fadedScene.traverse((c) => {
    c.renderOrder = 1;
  });
  recoloredScene.traverse((c) => {
    c.renderOrder = 2;
  });

  const fadedMaterials = collectMaterials(fadedScene);
  const recoloredMaterials = collectMaterials(recoloredScene);

  setSceneOpacity(fadedScene, fadedMaterials, 1);
  setSceneOpacity(recoloredScene, recoloredMaterials, 0);

  return { fadedScene, recoloredScene, fadedMaterials, recoloredMaterials };
}

// ─── Sculpture Metrics ────────────────────────────────────────────────────────
// Computes rendered height and the bottom Y of the model in the outer group's
// local coordinate space, so Pedestal can position itself dynamically.

type SculptureMetrics = {
  renderedHeight: number;        // world Y extent after scale + rotation
  renderedBottomInGroup: number; // bottom Y in the [-1.5/1.5, 0, 0] group space
  renderedBaseRadius: number;    // XZ footprint radius after scale + rotation
};

function computeMetrics(
  scene: THREE.Object3D,
  config: StatueConfig,
  scale: number
): SculptureMetrics {
  // Ensure local matrices are up to date before measuring
  scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene);

  let height: number, bottom: number, baseRadius: number;

  if (config.heightAxis === "z") {
    // Z-up model: after -PI/2 X rotation, Z→worldY, so height axis is raw Z.
    // The world XZ footprint comes from raw model X and Y.
    height = (box.max.z - box.min.z) * scale;
    bottom = box.min.z * scale;
    baseRadius =
      Math.max(
        box.max.x - box.min.x,
        box.max.y - box.min.y
      ) *
      scale *
      0.5;
  } else {
    // Y-up geometry: height axis is raw Y; footprint is raw XZ.
    height = (box.max.y - box.min.y) * scale;
    bottom = box.min.y * scale;
    baseRadius =
      Math.max(
        box.max.x - box.min.x,
        box.max.z - box.min.z
      ) *
      scale *
      0.5;
  }

  return {
    renderedHeight: height,
    renderedBottomInGroup: bottom + MODEL_POSITION_Y,
    renderedBaseRadius: baseRadius,
  };
}

// ─── Components ───────────────────────────────────────────────────────────────

function ModelView({
  pair,
  position,
  baseYaw,
  yaw,
  modelRotation,
  scale,
}: {
  pair: ModelPair;
  position: [number, number, number];
  baseYaw: number;
  yaw: number;
  modelRotation: [number, number, number];
  scale: number;
}) {
  return (
    <group position={position} rotation={[0, baseYaw + yaw, 0]}>
      <group scale={scale} rotation={modelRotation}>
        <primitive object={pair.fadedScene} />
        <primitive object={pair.recoloredScene} />
      </group>
    </group>
  );
}

function Pedestal({ metrics }: { metrics: SculptureMetrics | null }) {
  // Height scales with statue; clamped to a minimum so it always looks like a pedestal.
  const pedestalHeight = metrics
    ? Math.max(0.2, metrics.renderedHeight * 0.15)
    : 0.3;
  // Top of pedestal sits exactly at the statue's bottom.
  const posY = metrics
    ? metrics.renderedBottomInGroup - pedestalHeight / 2
    : -0.35;
  // Pedestal radius is fixed; only pedestal height changes with statue size.
  const topRadius = PEDESTAL_TOP_RADIUS;
  const bottomRadius = PEDESTAL_BOTTOM_RADIUS;

  return (
    <mesh position={[0, posY, 0]}>
      <cylinderGeometry args={[topRadius, bottomRadius, pedestalHeight, 64]} />
      <meshStandardMaterial color="#333333" />
    </mesh>
  );
}

function DualSculpture({
  yaw,
  controlMode,
  statueIndex,
  onSwitchStatue,
}: {
  yaw: number;
  controlMode: ControlMode;
  statueIndex: number;
  onSwitchStatue: () => void;
}) {
  const fadedPanjurli = useGLTF("/models/Panjurli_faded.glb");
  const recoloredPanjurli = useGLTF("/models/Panjurli_recolored.glb");

  const fadedDeity = useGLTF("/models/Deity_faded.glb");
  const recoloredDeity = useGLTF("/models/Deity_recolored.glb");

  const previousAngleRef = useRef<number | null>(null);
  const colorProgressRef = useRef(0);
  const totalRotationRef = useRef(0); // accumulated absolute rotation in radians
  const lastActivityRef = useRef(Date.now());
  const hasSwitchedRef = useRef(false); // prevents double-firing the switch
  const displayYawRef = useRef(0);     // smoothed yaw used for rendering; lerps to 0 on idle
  const [displayYaw, setDisplayYaw] = useState(0);

  // Reset all state whenever the active statue or control mode changes
  useEffect(() => {
    previousAngleRef.current = null;
    colorProgressRef.current = 0;
    totalRotationRef.current = 0;
    hasSwitchedRef.current = false;
    lastActivityRef.current = Date.now();
    displayYawRef.current = 0;
    setDisplayYaw(0);
  }, [statueIndex, controlMode]);

  const { frontPair, backPair, metrics, activeScale, verticalShift } = useMemo(() => {
    const config = STATUE_CONFIGS[statueIndex];

    let frontPair: ModelPair;
    let backPair: ModelPair;
    let sourceScene: THREE.Object3D;

    if (config.id === "panjurli") {
      frontPair = createModelPair(fadedPanjurli.scene, recoloredPanjurli.scene);
      backPair = createModelPair(fadedPanjurli.scene, recoloredPanjurli.scene);
      sourceScene = fadedPanjurli.scene;
    } else if (config.id === "deity") {
      frontPair = createModelPair(fadedDeity.scene, recoloredDeity.scene);
      backPair = createModelPair(fadedDeity.scene, recoloredDeity.scene);
      sourceScene = fadedDeity.scene;
    } else {
      frontPair = createProceduralPair();
      backPair = createProceduralPair();
      sourceScene = frontPair.fadedScene;
    }

    // Use fixedScale if specified; otherwise fit statue footprint against pedestal radius.
    let activeScale: number;
    if (config.fixedScale !== undefined) {
      activeScale = config.fixedScale;
    } else {
      const targetBaseRadius =
        PEDESTAL_TOP_RADIUS *
        (config.autoBaseRadiusFactor ?? 1);
      const baseMetrics = computeMetrics(sourceScene, config, 1.0);
      activeScale = Math.max(
        0.3,
        Math.min(3.0, targetBaseRadius / baseMetrics.renderedBaseRadius)
      );
    }

    const metrics = computeMetrics(sourceScene, config, activeScale);

    // Compute vertical shift: if the statue top would overflow the visible frame,
    // push the entire ensemble downward so the pedestal descends in the frame.
    // Outer group in Scene sits at world y=-0.2; frame top (90vh) in group-local Y:
    const screenH = typeof window !== "undefined" ? window.innerHeight : 1080;
    const frameTopInGroupY = (screenH * 0.9) / 500 + 0.2;
    const statueTopInGroupY = MODEL_POSITION_Y + metrics.renderedHeight;
    const overflow = statueTopInGroupY - frameTopInGroupY;
    const verticalShift = config.fixedScale !== undefined ? 0 : (overflow > 0 ? -(overflow + 0.1) : 0);

    return { frontPair, backPair, metrics, activeScale, verticalShift };
  }, [fadedPanjurli.scene, recoloredPanjurli.scene, fadedDeity.scene, recoloredDeity.scene, statueIndex]);

  useFrame(() => {
    const currentAngle = yaw;
    const now = Date.now();

    if (previousAngleRef.current === null) {
      previousAngleRef.current = currentAngle;
      displayYawRef.current = currentAngle;
      applyColorProgress(frontPair, backPair, colorProgressRef.current);
      return;
    }

    const delta = getShortestAngleDelta(
      currentAngle,
      previousAngleRef.current
    );
    previousAngleRef.current = currentAngle;
    const absDelta = Math.abs(delta);

    const isIdle = absDelta <= ACTIVITY_THRESHOLD_RAD &&
      now - lastActivityRef.current > IDLE_TIMEOUT_MS;

    if (absDelta > ACTIVITY_THRESHOLD_RAD) {
      lastActivityRef.current = now;
      totalRotationRef.current += absDelta;

      // After 3 full rotations, hand off to the next statue
      if (!hasSwitchedRef.current && totalRotationRef.current >= SWITCH_THRESHOLD_RAD) {
        hasSwitchedRef.current = true;
        onSwitchStatue();
        return;
      }

      // Right turn (negative delta) → color progress increases
      const step = -delta / (Math.PI * 2);
      colorProgressRef.current = THREE.MathUtils.clamp(
        colorProgressRef.current + step,
        0,
        1
      );

      // Track yaw for display
      displayYawRef.current += delta;
    } else if (isIdle) {
      // Smoothly return color to faded state
      if (colorProgressRef.current > 0.001) {
        colorProgressRef.current = THREE.MathUtils.lerp(
          colorProgressRef.current,
          0,
          IDLE_LERP_SPEED
        );
      } else {
        colorProgressRef.current = 0;
      }

      // Smoothly return rotation to 0
      if (Math.abs(displayYawRef.current) > 0.001) {
        displayYawRef.current = THREE.MathUtils.lerp(
          displayYawRef.current,
          0,
          IDLE_LERP_SPEED
        );
      } else {
        displayYawRef.current = 0;
      }
    } else {
      // Active but below threshold — just keep tracking input
      displayYawRef.current += delta;
    }

    setDisplayYaw(displayYawRef.current);
    applyColorProgress(frontPair, backPair, colorProgressRef.current);
  });

  const config = STATUE_CONFIGS[statueIndex];

  return (
    <group position={[0, verticalShift, 0]}>
      <group position={[-1.5, 0, 0]}>
        <Pedestal metrics={metrics} />
        <ModelView
          pair={frontPair}
          position={[0, MODEL_POSITION_Y, 0]}
          baseYaw={0}
          yaw={displayYaw}
          modelRotation={config.modelRotation}
          scale={activeScale}
        />
      </group>

      <group position={[1.5, 0, 0]}>
        <Pedestal metrics={metrics} />
        <ModelView
          pair={backPair}
          position={[0, MODEL_POSITION_Y, 0]}
          baseYaw={Math.PI}
          yaw={displayYaw}
          modelRotation={config.modelRotation}
          scale={activeScale}
        />
      </group>
    </group>
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
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
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
  const [statueIndex, setStatueIndex] = useState(0);

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
          <DualSculpture
            yaw={activeYaw}
            controlMode={controlMode}
            statueIndex={statueIndex}
            onSwitchStatue={() =>
              setStatueIndex((prev) => (prev + 1) % STATUE_CONFIGS.length)
            }
          />
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
useGLTF.preload("/models/Deity_faded.glb");
useGLTF.preload("/models/Deity_recolored.glb");
