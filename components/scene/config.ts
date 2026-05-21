import type { RegionDef, StatueConfig } from "./types";

export const PANJURLI_REGIONS: RegionDef[] = [
  { id: "necklace_anklets",   label: "Necklace & Anklets",   grayMin: 0.000,  grayMax: 0.0625, focus: {position: [0, 3, 3.2], target: [0, -0.45, 0], zoom: 400,}},
  { id: "body",               label: "Body",                 grayMin: 0.0625, grayMax: 0.1875 },
  { id: "pupils_nostril",     label: "Pupils & Nostril",     grayMin: 0.1875, grayMax: 0.3125 },
  { id: "eye_whites_teeth",   label: "Eye Whites & Teeth",   grayMin: 0.3125, grayMax: 0.4375 },
  { id: "nose",               label: "Nose",                 grayMin: 0.4375, grayMax: 0.5625 },
  { id: "face_motif_outline", label: "Face Motif Outline",   grayMin: 0.5625, grayMax: 0.6875 },
  { id: "face_motif_filling", label: "Face Motif Filling",   grayMin: 0.6875, grayMax: 0.8125 },
  { id: "lips",               label: "Lips",                 grayMin: 0.8125, grayMax: 1.001  },
];

export const AMMANAVARU_REGIONS: RegionDef[] = [
  { id: "body",           label: "Body",           grayMin: 0.000,  grayMax: 0.0625 },
  { id: "ornaments",      label: "Ornaments",      grayMin: 0.0625, grayMax: 0.1875 },
  { id: "hair_pupils",    label: "Hair & Pupils",  grayMin: 0.1875, grayMax: 0.3125 },
  { id: "eye_whites",     label: "Eye Whites",     grayMin: 0.3125, grayMax: 0.4375 },
  { id: "upper_garment",  label: "Upper Garment",  grayMin: 0.4375, grayMax: 0.5625 },
  { id: "lower_garment",  label: "Lower Garment",  grayMin: 0.5625, grayMax: 0.6875 },
  { id: "front_apron",    label: "Front Apron",    grayMin: 0.6875, grayMax: 0.8125 },
  { id: "bull_horns",     label: "Bull Horns",     grayMin: 0.8125, grayMax: 0.9375 },
  { id: "bull_wings",     label: "Bull Wings",     grayMin: 0.9375, grayMax: 1.001  },
];

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
    partIDTexturePath: "/models/Panjurli_MaskColorMap.png",
    regions: PANJURLI_REGIONS,
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
  {
    id: "ammanavaru",
    modelRotation: [Math.PI / 2, Math.PI, 0],
    heightAxis: "z",
    autoBaseRadiusFactor: 0.9,
    baseYaw: 0,
    partIDTexturePath: "/models/Ammanavaru_MaskColorMap.png",
    regions: AMMANAVARU_REGIONS,
  },
];


