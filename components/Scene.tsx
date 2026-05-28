"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { Canvas } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";

import {
  type ControlMode,
  type ColoringModeState,
  type RegionFocus,
  INITIAL_COLORING_STATE,
} from "./scene/types";
import { STATUE_CONFIGS } from "./scene/config";
import { useZigSimYaw } from "./scene/useZigSimYaw";
import { DualSculpture } from "./scene/DualSculpture";
import { ColoringPanel } from "./scene/ColoringPanel";
import { PaintingSplitView } from "./scene/PaintingSplitView";
import {
  MusicControl,
  ControlModeToggle,
  PanoramaFrames,
  ViewFrames,
} from "./scene/UI";

type ControlState = {
  sculptureId?: string;
  mode?: "archive" | "interpretation" | "recoloring";
  selectedPart?: string | null;
  selectedColor?: string | null;
  colorSelections?: Record<string, string>;
};

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
  const activeRegionFocus: RegionFocus | null =
    coloringModeState.active && currentConfig.regions
      ? currentConfig.regions.find(
          (region) => region.id === coloringModeState.activeRegion
        )?.focus ?? null
      : null;
  const activeYaw = controlMode === "phone" ? zigSimYaw : mouseYaw;
  const [displayYaw, setDisplayYaw] = useState(0);
  const [paintingYawStart, setPaintingYawStart] = useState({
    activeYaw: 0,
    displayYaw: 0,
  });
  const panoramaYaw = coloringModeState.active
    ? paintingYawStart.displayYaw + (activeYaw - paintingYawStart.activeYaw)
    : displayYaw;

  // Exit coloring mode and clear painted colors when switching statues
  useEffect(() => {
    setConfirmedSelections(null);
  }, [statueIndex]);

  useEffect(() => {
    let cancelled = false;

    // Snapshot of the last polled payload — only when one of these fields actually
    // changes do we push new state into React. Prevents 500ms polling from creating
    // new `confirmedSelections` references that would otherwise re-fire effects in
    // DualSculpture and break its idle-reset state machine.
    type PolledSnapshot = {
      sculptureId: string | null;
      mode: NonNullable<ControlState["mode"]> | null;
      selectedPart: string | null;
      colorSelectionsKey: string;
    };
    const lastSnapshotRef: { current: PolledSnapshot } = {
      current: {
        sculptureId: null,
        mode: null,
        selectedPart: null,
        colorSelectionsKey: "__init__",
      },
    };

    const pollControl = async () => {
      try {
        const response = await fetch("/api/control", { cache: "no-store" });
        if (!response.ok) return;

        const data = (await response.json()) as ControlState;

        if (cancelled) return;

        const colorSelectionsKey = JSON.stringify(data.colorSelections ?? {});
        const snap = lastSnapshotRef.current;
        const sculptureChanged    = (data.sculptureId   ?? null) !== snap.sculptureId;
        const modeChanged         = (data.mode          ?? null) !== snap.mode;
        const selectedPartChanged = (data.selectedPart  ?? null) !== snap.selectedPart;
        const colorsChanged       = colorSelectionsKey !== snap.colorSelectionsKey;

        if (!sculptureChanged && !modeChanged && !selectedPartChanged && !colorsChanged) {
          return;
        }

        lastSnapshotRef.current = {
          sculptureId: data.sculptureId ?? null,
          mode: data.mode ?? null,
          selectedPart: data.selectedPart ?? null,
          colorSelectionsKey,
        };

        if (data.sculptureId) {
          const nextIndex = STATUE_CONFIGS.findIndex(
            (config) => config.id === data.sculptureId
          );

          if (nextIndex >= 0) {
            setStatueIndex(nextIndex);
          }
        }

        console.log(
          "[DIAG][POLL-PUSH]",
          "mode→", data.mode,
          "| colors keys=", Object.keys(data.colorSelections ?? {}).length,
          "| sculpture=", sculptureChanged, "mode=", modeChanged,
          "part=", selectedPartChanged, "colors=", colorsChanged,
        );

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
        setConfirmedSelections(data.colorSelections && Object.keys(data.colorSelections).length > 0 ? data.colorSelections : null);
      } catch (error) {
        console.warn("Could not read screen control state:", error);
      }
    };

    pollControl();

    const interval = window.setInterval(pollControl, 500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const channel = new BroadcastChannel("screen-control");
    channel.onmessage = (event) => {
      const data = event.data as {
        sculptureId?: string;
        mode?: "archive" | "interpretation" | "recoloring";
        colorSelections?: Record<string, string>;
      };
      if (data.mode === "archive" && data.colorSelections && Object.keys(data.colorSelections).length > 0) {
        setColoringModeState(INITIAL_COLORING_STATE);
        setConfirmedSelections(data.colorSelections);
      }
    };
    return () => channel.close();
  }, []);

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

  // ─── Coloring handlers ─────────────────────────────────────────────────────

  const handleEnterColoringMode = () => {
    setPaintingYawStart({ activeYaw, displayYaw });
    setColoringModeState({ active: true, selections: {}, activeRegion: null });
  };

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
      <PanoramaFrames yaw={panoramaYaw} />

      {coloringModeState.active ? (
        <PaintingSplitView
          statueIndex={statueIndex}
          coloringModeState={coloringModeState}
          focus={activeRegionFocus}
        />
      ) : (
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
              onSwitchStatue={() =>
                setStatueIndex((prev) => (prev + 1) % STATUE_CONFIGS.length)
              }
              coloringModeState={coloringModeState}
              confirmedSelections={confirmedSelections}
              onIdleReset={() => setConfirmedSelections(null)}
              onDisplayYawChange={setDisplayYaw}
            />
          </group>
        </Canvas>
      )}

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
