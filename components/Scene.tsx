"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

import {
  type ControlMode,
  type ColoringModeState,
  INITIAL_COLORING_STATE,
} from "./scene/types";

import { STATUE_CONFIGS } from "./scene/config";
import { useZigSimYaw } from "./scene/useZigSimYaw";
import { DualSculpture } from "./scene/DualSculpture";
import {
  MusicControl,
  ControlModeToggle,
  PanoramaFrames,
  ViewFrames,
} from "./scene/UI";

type SculptureKey = "panjurli" | "nandigona" | "ammanavaru";

type ControlState = {
  sculptureId?: SculptureKey;
  mode?: "archive" | "interpretation" | "recoloring";
  selectedPart?: string | null;
  selectedColor?: string | null;
  colorSelections?: Record<string, string>;
};

export default function Scene() {
  const zigSimYaw = useZigSimYaw("/api/zigsim");
  const [controlMode, setControlMode] = useState<ControlMode>("phone");
  const [activeSculpture, setActiveSculpture] =
    useState<SculptureKey>("panjurli");

  const statueIndex = Math.max(
    0,
    STATUE_CONFIGS.findIndex((config) => config.id === activeSculpture)
  );

  const [mouseYaw, setMouseYaw] = useState(0);
  const isDraggingRef = useRef(false);
  const previousPointerXRef = useRef<number | null>(null);

  const [coloringModeState, setColoringModeState] =
    useState<ColoringModeState>(INITIAL_COLORING_STATE);
  const [confirmedSelections, setConfirmedSelections] =
    useState<Record<string, string> | null>(null);

  const activeYaw = controlMode === "phone" ? zigSimYaw : mouseYaw;
  const [displayYaw, setDisplayYaw] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const pollControl = async () => {
      try {
        const response = await fetch("/api/control", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as ControlState;

        if (
          data.sculptureId === "panjurli" ||
          data.sculptureId === "nandigona" ||
          data.sculptureId === "ammanavaru"
        ) {
          setActiveSculpture(data.sculptureId);
        }

        if (data.mode === "recoloring") {
          const selections = data.colorSelections ?? {};

          setColoringModeState({
            active: true,
            activeRegion: data.selectedPart ?? null,
            selections,
          });

          setConfirmedSelections(selections);
          return;
        }

        setColoringModeState(INITIAL_COLORING_STATE);
        setConfirmedSelections(null);
      } catch (error) {
        console.warn("Could not read screen control state:", error);
      }
    };

    pollControl();
    const interval = window.setInterval(() => {
      if (!cancelled) pollControl();
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    setConfirmedSelections(null);
  }, [statueIndex]);

  useEffect(() => {
    if (controlMode === "mouse") setMouseYaw(zigSimYaw);
  }, [controlMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (controlMode !== "mouse" || coloringModeState.active) return;
    isDraggingRef.current = true;
    previousPointerXRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (controlMode !== "mouse" || coloringModeState.active) return;
    if (!isDraggingRef.current || previousPointerXRef.current === null) return;
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
      <PanoramaFrames yaw={displayYaw} />

      <Canvas
        className="relative z-10"
        orthographic
        gl={{ alpha: true }}
        onCreated={({ gl }) => gl.setClearColor("#000000", 0)}
        camera={{ position: [0, 1.0, 5], zoom: 250 }}
      >
        <ambientLight intensity={1.2} />
        <directionalLight position={[3, 4, 5]} intensity={2} />

        <group position={[0, -0.2, 0]}>
          <DualSculpture
            yaw={activeYaw}
            controlMode={controlMode}
            statueIndex={statueIndex}
            onSwitchStatue={() => {
              const nextIndex = (statueIndex + 1) % STATUE_CONFIGS.length;
              setActiveSculpture(STATUE_CONFIGS[nextIndex].id as SculptureKey);
            }}
            coloringModeState={coloringModeState}
            confirmedSelections={confirmedSelections}
            onIdleReset={() => setConfirmedSelections(null)}
            onDisplayYawChange={setDisplayYaw}
          />
        </group>
      </Canvas>

      <ViewFrames />
      <MusicControl />

      {!coloringModeState.active && (
        <ControlModeToggle
          mode={controlMode}
          onToggle={() =>
            setControlMode((prev) => (prev === "phone" ? "mouse" : "phone"))
          }
        />
      )}
    </div>
  );
}

useGLTF.preload("/models/Panjurli_faded.glb");
useGLTF.preload("/models/Panjurli_recolored.glb");
useGLTF.preload("/models/Nandigona_faded.glb");
useGLTF.preload("/models/Nandigona_recolored.glb");
useGLTF.preload("/models/Ammanavaru_faded.glb");
useGLTF.preload("/models/Ammanavaru_recolored.glb");
