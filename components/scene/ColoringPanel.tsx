"use client";

import type { ColoringModeState, RegionDef } from "./types";
import { AVAILABLE_COLORS } from "./types";

export function ColoringPanel({
  regions,
  state,
  onSelectRegion,
  onSelectColor,
  onConfirm,
  onCancel,
}: {
  regions: RegionDef[];
  state: ColoringModeState;
  onSelectRegion: (id: string) => void;
  onSelectColor: (regionId: string, hex: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const allSelected = regions.every((r) => state.selections[r.id]);
  const stopProp = (e: React.PointerEvent) => e.stopPropagation();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md px-4 pt-4 pb-6">
      {/* Region list */}
      <div className="flex gap-2 overflow-x-auto pb-3">
        {regions.map((region) => {
          const chosen   = state.selections[region.id];
          const isActive = state.activeRegion === region.id;
          return (
            <button
              key={region.id}
              onPointerDown={stopProp}
              onPointerUp={stopProp}
              onClick={() => onSelectRegion(region.id)}
              className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition border-2 ${
                isActive ? "border-white scale-105" : "border-white/20"
              }`}
              style={{
                backgroundColor: chosen ?? "#444444",
                color: "#ffffff",
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              {region.label}{chosen ? " ✓" : ""}
            </button>
          );
        })}
      </div>

      {/* Color picker — shown when a region is active */}
      {state.activeRegion && (
        <div className="flex gap-3 justify-center mb-3">
          {AVAILABLE_COLORS.map((hex) => {
            const isChosen = state.selections[state.activeRegion!] === hex;
            return (
              <button
                key={hex}
                onPointerDown={stopProp}
                onPointerUp={stopProp}
                onClick={() => onSelectColor(state.activeRegion!, hex)}
                className={`w-9 h-9 rounded-full border-2 transition hover:scale-110 ${
                  isChosen ? "border-white scale-110" : "border-white/30"
                }`}
                style={{ backgroundColor: hex }}
              />
            );
          })}
        </div>
      )}

      {/* Confirm / Cancel */}
      <div className="flex gap-3 justify-center mt-1">
        <button
          onPointerDown={stopProp}
          onPointerUp={stopProp}
          onClick={onCancel}
          className="px-6 py-2 rounded-full bg-white/20 text-white text-sm hover:bg-white/30 transition"
        >
          Cancel
        </button>
        <button
          onPointerDown={stopProp}
          onPointerUp={stopProp}
          onClick={onConfirm}
          disabled={!allSelected}
          className={`px-6 py-2 rounded-full text-sm font-medium transition ${
            allSelected
              ? "bg-white text-black hover:bg-white/90"
              : "bg-white/20 text-white/40 cursor-not-allowed"
          }`}
        >
          Confirm{allSelected ? "" : ` (${Object.keys(state.selections).length}/${regions.length})`}
        </button>
      </div>
    </div>
  );
}
