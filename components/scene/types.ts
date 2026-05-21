// ─── Rotation / animation constants ───────────────────────────────────────────

export const IDLE_TIMEOUT_MS = 10_000;
export const SWITCH_THRESHOLD_RAD = Math.PI * 2 * 3;
export const ACTIVITY_THRESHOLD_RAD = 0.002;
export const IDLE_LERP_SPEED = 0.02;

// ─── Layout constants ──────────────────────────────────────────────────────────

export const MODEL_POSITION_Y = 0.15;
export const PEDESTAL_TOP_RADIUS = 0.6;
export const PEDESTAL_BOTTOM_RADIUS = 0.8;

// ─── Coloring constants ────────────────────────────────────────────────────────

export const AVAILABLE_COLORS = [
  "#500C06",
  "#CB9A1B",
  "#CFC4AA",
  "#08422B",
  "#1C3A7C",
  "#000000",
] as const;

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ControlMode = "phone" | "mouse";

export type RegionDef = {
  id: string;
  label: string;
  grayMin: number;
  grayMax: number;
  focus?: RegionFocus;
};

export type RegionFocus = {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
};

export type ColoringModeState = {
  active: boolean;
  selections: Record<string, string>;
  activeRegion: string | null;
};

export const INITIAL_COLORING_STATE: ColoringModeState = {
  active: false,
  selections: {},
  activeRegion: null,
};

// Extended with optional coloring support via partIDTexturePath + regions
export type StatueConfig = {
  id: string;
  modelRotation: [number, number, number];
  heightAxis: "y" | "z";
  fixedScale?: number;
  autoBaseRadiusFactor?: number;
  baseYaw?: number;
  partIDTexturePath?: string;
  regions?: RegionDef[];
};

export type SculptureMetrics = {
  renderedHeight: number;
  renderedBottomInGroup: number;
  renderedBaseRadius: number;
};
