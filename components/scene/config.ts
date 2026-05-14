import type { RegionDef, StatueConfig } from "./types";

export const NANDIGONA_REGIONS: RegionDef[] = [
  { id: "necklace",       label: "Necklace",           grayMin: 0.000,  grayMax: 0.0625 },
  { id: "body",           label: "Body",               grayMin: 0.0625, grayMax: 0.1875 },
  { id: "eyeliner",       label: "Eyeliner & Pupils",  grayMin: 0.1875, grayMax: 0.3125 },
  { id: "eye_whites",     label: "Eye Whites & Teeth", grayMin: 0.3125, grayMax: 0.4375 },
  { id: "lower_garment",  label: "Lower Garment",      grayMin: 0.4375, grayMax: 0.5625 },
  { id: "waist_ornament", label: "Waist Ornament",     grayMin: 0.5625, grayMax: 0.6875 },
  { id: "waist_details",  label: "Waist Details",      grayMin: 0.6875, grayMax: 0.8125 },
  { id: "chest_sash",     label: "Chest Sash",         grayMin: 0.8125, grayMax: 0.9375 },
  { id: "anklets",        label: "Anklets",            grayMin: 0.9375, grayMax: 1.001  },
];

export const STATUE_CONFIGS: StatueConfig[] = [
  {
    id: "panjurli",
    modelRotation: [-Math.PI / 2, Math.PI / 180, 0],
    heightAxis: "z",
    autoBaseRadiusFactor: 0.75,
    baseYaw: 0,
    // no partIDTexturePath — coloring not yet available for panjurli
  },
  {
    id: "nandigona",
    modelRotation: [0, 0, 0],
    heightAxis: "y",
    autoBaseRadiusFactor: 0.75,
    baseYaw: 0,
    partIDTexturePath: "/models/Nandigona_MaskColorMap.png",
    regions: NANDIGONA_REGIONS,
  },
];
