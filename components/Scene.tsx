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
import { ColoringPanel } from "./scene/ColoringPanel";
import { MusicControl, ControlModeToggle, ViewFrames } from "./scene/UI";

export default function Scene() {
  const zigSimYaw = useZigSimYaw("/api/zigsim");
  const [controlMode, setControlMode] = useState<ControlMode>("phone");
  const [statueIndex, setStatueIndex] = useState(0);

  const [mouseYaw, setMouseYaw] = useState(0);
  const isDraggingRef = useRef(false);
  const previousPointerXRef = useRef<number | null>(null);

  const [coloringModeState, setColoringModeState] =
    useState<ColoringModeState>(INITIAL_COLORING_STATE);
  const [confirmedSelections, setConfirmedSelections] =
    useState<Record<string, string> | null>(null);

  const currentConfig = STATUE_CONFIGS[statueIndex];
  const canColor = !!currentConfig.regions;
  const activeYaw = controlMode === "phone" ? zigSimYaw : mouseYaw;

  // Exit coloring mode when switching to a statue that doesn't support it
  useEffect(() => {
    if (coloringModeState.active && !currentConfig.regions) {
      setColoringModeState(INITIAL_COLORING_STATE);
    }
  }, [statueIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync mouse yaw when switching control modes
  useEffect(() => {
    if (controlMode === "mouse") setMouseYaw(zigSimYaw);
  }, [controlMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Mouse / pointer handlers ──────────────────────────────────────────────

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

  // ─── Coloring handlers ─────────────────────────────────────────────────────

  const handleEnterColoringMode = () =>
    setColoringModeState({ active: true, selections: {}, activeRegion: null });

  const handleSelectRegion = (id: string) =>
    setColoringModeState((prev) => ({ ...prev, activeRegion: id }));

  const handleSelectColor = (regionId: string, hex: string) =>
    setColoringModeState((prev) => ({
      ...prev,
      selections: { ...prev.selections, [regionId]: hex },
    }));

  const handleConfirm = () => {
    setConfirmedSelections({ ...coloringModeState.selections });
    setColoringModeState(INITIAL_COLORING_STATE);
  };

  const handleCancel = () => setColoringModeState(INITIAL_COLORING_STATE);

  return (
    <div
      className="relative h-screen w-screen touch-none bg-black"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
      onPointerCancel={stopDragging}
      onPointerLeave={stopDragging}
    >
      <Canvas orthographic camera={{ position: [0, 1.0, 5], zoom: 250 }}>
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
            coloringModeState={coloringModeState}
            confirmedSelections={confirmedSelections}
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

      {!coloringModeState.active && canColor && (
        <button
          onPointerDown={(e) => e.stopPropagation()}
          onPointerUp={(e) => e.stopPropagation()}
          onClick={handleEnterColoringMode}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-black/50 px-4 py-2 text-sm text-white backdrop-blur-md transition hover:bg-black/70"
        >
          {confirmedSelections ? "Repaint" : "Paint"}
        </button>
      )}

      {coloringModeState.active && currentConfig.regions && (
        <ColoringPanel
          regions={currentConfig.regions}
          state={coloringModeState}
          onSelectRegion={handleSelectRegion}
          onSelectColor={handleSelectColor}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </div>
  );
}

useGLTF.preload("/models/Panjurli_faded.glb");
useGLTF.preload("/models/Panjurli_recolored.glb");
useGLTF.preload("/models/Deity_faded.glb");
useGLTF.preload("/models/Deity_recolored.glb");
