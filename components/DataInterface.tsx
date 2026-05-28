"use client";

import { useEffect, useMemo, useState } from "react";

type InfoLevel = "archive" | "interpretation" | "recoloring";
type SculptureKey = "panjurli" | "nandigona" | "ammanavaru";

type SculptureMetadata = {
  id: string;
  object: {
    name: string;
    accession_number?: string;
    deprecated_accession_number?: string;
  };
  description?: string;
  dimensions?: {
    height_cm?: string;
    width_cm?: string;
    depth_cm?: string;
  };
  historical?: {
    dateable_period_ad?: string;
    provenance?: string;
    acquisition_method?: string;
    current_location?: string;
  };
  classification?: {
    category?: string;
    materials?: string;
  };
  archive_metadata?: {
    function_usage?: string;
    inscriptions_markers?: string;
    curatorial_note?: string;
    condition_assessment?: string;
  };
  interpretation?: {
    type?: string;
    heads?: string;
    function?: string;
    meaning?: string;
    explanation?: string;
  };
};

type FinalSculpture = {
  key: SculptureKey;
  name: string;
  accession: string;
  aliases: string[];
};

type RecolorComponent = {
  id: string;
  label: string;
  grey: string;
  hex: string;
  rgb: string;
};

const finalSculptures: FinalSculpture[] = [
  {
    key: "panjurli",
    name: "Panjurli",
    accession: "11243173",
    aliases: ["panjurli", "11243173"],
  },
  {
    key: "nandigona",
    name: "Nandigona",
    accession: "5ae1306f",
    aliases: ["nandigona", "5ae1306f"],
  },
  {
    key: "ammanavaru",
    name: "Ammanavaru",
    accession: "a2cd8e10",
    aliases: ["ammanavaru", "a2cd8e10"],
  },
];

const infoLevels: { id: InfoLevel; title: string }[] = [
  { id: "archive", title: "Archive" },
  { id: "interpretation", title: "Interpretation" },
  { id: "recoloring", title: "Recoloring" },
];

const diyPalette = ["#500C06", "#CB9A1B", "#08422B", "#000000", "#CFC4AA", "#1C3A7C"];

const recolorComponentsBySculpture: Record<SculptureKey, RecolorComponent[]> = {
  panjurli: [
    { id: "necklace_anklets", label: "Necklace & Anklets", grey: "0.000", hex: "#000000", rgb: "0, 0, 0" },
    { id: "body", label: "Body", grey: "0.125", hex: "#202020", rgb: "32, 32, 32" },
    { id: "pupils_nostril", label: "Pupils & Nostril", grey: "0.250", hex: "#404040", rgb: "64, 64, 64" },
    { id: "eye_whites_teeth", label: "Eye Whites & Teeth", grey: "0.375", hex: "#606060", rgb: "96, 96, 96" },
    { id: "nose", label: "Nose", grey: "0.500", hex: "#808080", rgb: "128, 128, 128" },
    { id: "face_motif_outline", label: "Face Motif Outline", grey: "0.625", hex: "#A0A0A0", rgb: "160, 160, 160" },
    { id: "face_motif_filling", label: "Face Motif Filling", grey: "0.750", hex: "#C0C0C0", rgb: "192, 192, 192" },
    { id: "lips", label: "Lips", grey: "1.000", hex: "#FFFFFF", rgb: "255, 255, 255" },
  ],
  nandigona: [
    { id: "necklace", label: "Necklace", grey: "0.000", hex: "#000000", rgb: "0, 0, 0" },
    { id: "body", label: "Body", grey: "0.125", hex: "#202020", rgb: "32, 32, 32" },
    { id: "eyeliner", label: "Eyeliner & Pupils", grey: "0.250", hex: "#404040", rgb: "64, 64, 64" },
    { id: "eye_whites", label: "Eye Whites & Teeth", grey: "0.375", hex: "#606060", rgb: "96, 96, 96" },
    { id: "lower_garment", label: "Lower Garment", grey: "0.500", hex: "#808080", rgb: "128, 128, 128" },
    { id: "waist_ornament", label: "Waist Ornament", grey: "0.625", hex: "#A0A0A0", rgb: "160, 160, 160" },
    { id: "waist_details", label: "Waist Details", grey: "0.750", hex: "#C0C0C0", rgb: "192, 192, 192" },
    { id: "chest_sash", label: "Chest Sash", grey: "0.875", hex: "#E0E0E0", rgb: "224, 224, 224" },
    { id: "anklets", label: "Anklets", grey: "1.000", hex: "#FFFFFF", rgb: "255, 255, 255" },
  ],
  ammanavaru: [
    { id: "body", label: "Body", grey: "0.000", hex: "#000000", rgb: "0, 0, 0" },
    { id: "ornaments", label: "Ornaments", grey: "0.125", hex: "#202020", rgb: "32, 32, 32" },
    { id: "hair_pupils", label: "Hair & Pupils", grey: "0.250", hex: "#404040", rgb: "64, 64, 64" },
    { id: "eye_whites", label: "Eye Whites", grey: "0.375", hex: "#606060", rgb: "96, 96, 96" },
    { id: "upper_garment", label: "Upper Garment", grey: "0.500", hex: "#808080", rgb: "128, 128, 128" },
    { id: "lower_garment", label: "Lower Garment", grey: "0.625", hex: "#A0A0A0", rgb: "160, 160, 160" },
    { id: "front_apron", label: "Front Apron", grey: "0.750", hex: "#C0C0C0", rgb: "192, 192, 192" },
    { id: "bull_horns", label: "Bull Horns", grey: "0.875", hex: "#E0E0E0", rgb: "224, 224, 224" },
    { id: "bull_wings", label: "Bull Wings", grey: "1.000", hex: "#FFFFFF", rgb: "255, 255, 255" },
  ],
};

async function updateScreenControl(update: {
  sculptureId?: SculptureKey;
  mode?: InfoLevel;
  selectedPart?: string | null;
  selectedColor?: string | null;
  colorSelections?: Record<string, string>;
}) {
  await fetch("/api/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
}

function getColorLabel(color: string) {
  const colorMap: Record<string, string> = {
    "#500C06": "Deep red",
    "#CB9A1B": "Gold ochre",
    "#08422B": "Dark green",
    "#000000": "Black",
    "#CFC4AA": "Warm ivory",
    "#1C3A7C": "Indigo blue",
  };

  return colorMap[color.toUpperCase()] || color;
}

function cleanValue(value?: string) {
  if (!value || value.trim() === "") return "To be added";

  const lower = value.toLowerCase();
  if (lower.includes("add ") || lower.includes("from excel") || lower.includes("replace this")) {
    return "To be added";
  }

  return value;
}

function matchesFinalSculpture(item: SculptureMetadata, target: FinalSculpture) {
  const text = [
    item.id,
    item.object?.name,
    item.object?.accession_number,
    item.object?.deprecated_accession_number,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return target.aliases.some((alias) => text.includes(alias.toLowerCase()));
}

function getSculptureKey(item?: SculptureMetadata): SculptureKey {
  if (!item) return "panjurli";

  const match = finalSculptures.find((target) => matchesFinalSculpture(item, target));
  return match?.key ?? "panjurli";
}

function InfoSection({ title, value }: { title: string; value?: string }) {
  return (
    <section className="border-b border-white/10 pb-5 last:border-b-0">
      <h3 className="text-base font-medium text-white">{title}</h3>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-white/60">{cleanValue(value)}</p>
    </section>
  );
}

export default function DataInterface() {
  const [items, setItems] = useState<SculptureMetadata[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [level, setLevel] = useState<InfoLevel>("archive");
  const [selectedPart, setSelectedPart] = useState("");
  const [selectedColor, setSelectedColor] = useState(diyPalette[0]);
  const [colorChoices, setColorChoices] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/metadata/sculptures.json")
      .then((response) => response.json())
      .then((data: SculptureMetadata[]) => {
        setItems(data);

        const firstFinal = finalSculptures
          .map((target) => data.find((item) => matchesFinalSculpture(item, target)))
          .find(Boolean);

        if (firstFinal?.id) setSelectedId(firstFinal.id);
        else if (data?.[0]?.id) setSelectedId(data[0].id);
      })
      .catch((error) => console.error("Could not load metadata:", error));
  }, []);

  const displayItems = useMemo(() => {
    const matched = finalSculptures
      .map((target) => items.find((item) => matchesFinalSculpture(item, target)))
      .filter(Boolean) as SculptureMetadata[];

    return matched.length > 0 ? matched : items.slice(0, 3);
  }, [items]);

  const selected = useMemo(() => {
    return displayItems.find((item) => item.id === selectedId) ?? displayItems[0] ?? items[0];
  }, [displayItems, items, selectedId]);

  const sculptureKey = getSculptureKey(selected);
  const recolorComponents = recolorComponentsBySculpture[sculptureKey];
  const activeComponent = recolorComponents.find((part) => part.id === selectedPart) ?? recolorComponents[0];

  useEffect(() => {
    if (!selected) return;

    const key = getSculptureKey(selected);
    const firstPart = recolorComponentsBySculpture[key][0];

    setSelectedPart(firstPart.id);
    setSelectedColor(diyPalette[0]);
    setColorChoices({});
  }, [selected?.id]);

  const dimensions = [
    selected?.dimensions?.height_cm && `Height: ${selected.dimensions.height_cm} cm`,
    selected?.dimensions?.width_cm && `Width: ${selected.dimensions.width_cm} cm`,
    selected?.dimensions?.depth_cm && `Depth: ${selected.dimensions.depth_cm} cm`,
  ]
    .filter(Boolean)
    .join(" · ");

  const archiveDetails: Record<string, { title: string; value?: string }> = {
    description: { title: "Description", value: selected?.description },
    materials: { title: "Materials", value: selected?.classification?.materials },
    period: { title: "Date / period", value: selected?.historical?.dateable_period_ad },
    provenance: { title: "Provenance", value: selected?.historical?.provenance },
    dimensions: { title: "Dimensions", value: dimensions },
    function: { title: "Function / usage", value: selected?.archive_metadata?.function_usage },
  };

  const interpretationDetails: Record<string, { title: string; value?: string }> = {
    role: { title: "Role", value: selected?.interpretation?.function },
    meaning: { title: "Meaning", value: selected?.interpretation?.meaning },
    explanation: { title: "Explanation", value: selected?.interpretation?.explanation },
    caution: {
      title: "Caution",
      value:
        "This is a guided reading, not a final or universal explanation. Meanings can vary depending on community, performance, and use.",
    },
  };

  if (!selected) {
    return <main className="flex h-screen items-center justify-center bg-black text-white">Loading metadata…</main>;
  }

  const resetCurrentSculptureColors = () => {
    const firstPart = recolorComponents[0];

    setSelectedPart(firstPart.id);
    setSelectedColor(diyPalette[0]);
    setColorChoices({});

    updateScreenControl({
      sculptureId: sculptureKey,
      mode: "recoloring",
      selectedPart: null,
      selectedColor: null,
      colorSelections: {},
    });
  };

  const allRegionsColored =
    recolorComponents.length > 0 &&
    recolorComponents.every((part) => !!colorChoices[part.id]);

  const saveCurrentSculptureColors = () => {
    if (!allRegionsColored) return;

    const payload = {
      sculptureId: sculptureKey,
      mode: "archive" as const,
      selectedPart: null,
      selectedColor: null,
      colorSelections: colorChoices,
    };

    updateScreenControl(payload);

    const channel = new BroadcastChannel("screen-control");
    channel.postMessage(payload);
    channel.close();

    setLevel("archive");
  };

  const cancelCurrentSculptureColors = () => {
    const firstPart = recolorComponents[0];

    setSelectedPart(firstPart.id);
    setSelectedColor(diyPalette[0]);
    setColorChoices({});

    updateScreenControl({
      sculptureId: sculptureKey,
      mode: "archive",
      selectedPart: null,
      selectedColor: null,
      colorSelections: {},
    });

    setLevel("archive");
  };

  return (
    <main className="h-screen overflow-hidden bg-[#050505] p-3 text-white">
      <section className="mx-auto grid h-full max-w-7xl grid-cols-[280px_1fr] overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] shadow-2xl">
        <aside className="flex min-h-0 flex-col border-r border-white/10 bg-black/20 p-5">
          <p className="text-xs uppercase tracking-[0.35em] text-amber-300">iPad navigator</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">Bhuta sculpture interface</h1>

          <div className="mt-8">
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-white/40">Sculpture</p>

            <div className="grid gap-3">
              {displayItems.map((item) => {
                const active = item.id === selected.id;
                const nextKey = getSculptureKey(item);

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      const firstPart = recolorComponentsBySculpture[nextKey][0];

                      setSelectedId(item.id);
                      setSelectedPart(firstPart.id);
                      setSelectedColor(diyPalette[0]);
                      setColorChoices({});

                      updateScreenControl({
                        sculptureId: nextKey,
                        mode: level,
                        selectedPart: null,
                        selectedColor: null,
                        colorSelections: {},
                      });
                    }}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-amber-300/80 bg-amber-300/10"
                        : "border-white/10 bg-black/25 hover:border-white/25 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className="block text-base font-medium text-white">{item.object.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        <section className="min-h-0 p-5">
          <div className="flex h-full min-h-0 flex-col">
            <header className="mb-5 border-b border-white/10 pb-5">
              <div className="mb-6 flex flex-wrap gap-2">
                {infoLevels.map((item) => {
                  const active = item.id === level;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setLevel(item.id);

                        updateScreenControl({
                          sculptureId: sculptureKey,
                          mode: item.id,
                          selectedPart: item.id === "recoloring" ? activeComponent.id : null,
                          selectedColor: item.id === "recoloring" ? colorChoices[activeComponent.id] ?? null : null,
                          colorSelections: item.id === "recoloring" ? colorChoices : {},
                        });
                      }}
                      className={`rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                        active
                          ? "border-amber-300/80 bg-amber-300/15 text-white"
                          : "border-white/10 bg-black/25 text-white/55 hover:border-white/25 hover:bg-white/[0.06] hover:text-white"
                      }`}
                    >
                      {item.title}
                    </button>
                  );
                })}
              </div>

              <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80">{level}</p>
              <h2 className="mt-2 text-4xl font-semibold tracking-tight">{selected.object.name}</h2>
            </header>

            {level === "archive" && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-6">
                <div className="max-w-4xl space-y-5">
                  {Object.entries(archiveDetails).map(([key, item]) => (
                    <InfoSection key={key} title={item.title} value={item.value} />
                  ))}
                </div>
              </div>
            )}

            {level === "interpretation" && (
              <div className="min-h-0 flex-1 overflow-y-auto pr-6">
                <div className="max-w-4xl space-y-5">
                  {Object.entries(interpretationDetails).map(([key, item]) => (
                    <InfoSection key={key} title={item.title} value={item.value} />
                  ))}
                </div>
              </div>
            )}

            {level === "recoloring" && (
              <div className="grid min-h-0 flex-1 grid-cols-[1fr_330px] gap-4">
                <div className="flex min-h-0 flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-white/40">Color regions</p>
                    <p className="text-xs text-white/45">
                      {Object.keys(colorChoices).length}/{recolorComponents.length} colored
                    </p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-2">
                    <div className="grid gap-2">
                      {recolorComponents.map((part) => {
                        const chosenColor = colorChoices[part.id];
                        const active = activeComponent.id === part.id;

                        return (
                          <button
                            key={part.id}
                            onClick={() => {
                              setSelectedPart(part.id);
                              setSelectedColor(chosenColor ?? diyPalette[0]);

                              updateScreenControl({
                                sculptureId: sculptureKey,
                                mode: "recoloring",
                                selectedPart: part.id,
                                selectedColor: chosenColor ?? null,
                                colorSelections: colorChoices,
                              });
                            }}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                              active
                                ? "border-amber-300/80 bg-amber-300/10 text-white"
                                : "border-white/10 bg-black/30 text-white/70 hover:bg-white/[0.06]"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-base font-medium">{part.label}</p>
                                <p className="mt-1 text-xs text-white/35">Choose color for this part</p>
                              </div>

                              <span
                                className="h-7 w-7 shrink-0 rounded-full border border-white/20"
                                style={{ backgroundColor: chosenColor ?? "#777777" }}
                              />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col rounded-[1.75rem] border border-white/10 bg-white/[0.04] p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-white/40">Color palette</p>

                  <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {diyPalette.map((color) => (
                        <button
                          key={color}
                          onClick={() => {
                            const nextChoices = { ...colorChoices, [activeComponent.id]: color };

                            setSelectedColor(color);
                            setColorChoices(nextChoices);

                            updateScreenControl({
                              sculptureId: sculptureKey,
                              mode: "recoloring",
                              selectedPart: activeComponent.id,
                              selectedColor: color,
                              colorSelections: nextChoices,
                            });
                          }}
                          className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${
                            selectedColor === color
                              ? "border-amber-300/80 bg-amber-300/10"
                              : "border-white/10 bg-black/30 hover:bg-white/[0.06]"
                          }`}
                        >
                          <span className="h-7 w-7 rounded-full border border-white/20" style={{ backgroundColor: color }} />
                          <span>
                            <span className="block text-sm text-white/85">{getColorLabel(color)}</span>
                            <span className="block text-xs text-white/35">{color}</span>
                          </span>
                        </button>
                      ))}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-[0.24em] text-white/35">Selected region</p>

                      <div className="mt-3 flex items-center gap-3">
                        <div
                          className="h-12 w-12 rounded-full border border-white/20"
                          style={{ backgroundColor: colorChoices[activeComponent.id] ?? "#777777" }}
                        />

                        <div>
                          <p className="text-base font-medium text-white">{activeComponent.label}</p>
                          <p className="text-xs text-white/45">
                            Current color:{" "}
                            {colorChoices[activeComponent.id]
                              ? getColorLabel(colorChoices[activeComponent.id])
                              : "None"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 shrink-0 space-y-2 border-t border-white/10 pt-3">
                    {!allRegionsColored && (
                      <p className="text-xs leading-5 text-white/45">
                        Color all regions to save, or cancel to return without coloring.
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={saveCurrentSculptureColors}
                        disabled={!allRegionsColored}
                        className={`rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          allRegionsColored
                            ? "bg-amber-300 text-black hover:bg-amber-200"
                            : "cursor-not-allowed bg-white/10 text-white/35"
                        }`}
                      >
                        Save colors
                      </button>

                      <button
                        onClick={cancelCurrentSculptureColors}
                        className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06]"
                      >
                        Cancel
                      </button>
                    </div>

                    <button
                      onClick={resetCurrentSculptureColors}
                      className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/70 transition hover:bg-white/[0.06]"
                    >
                      Reset colors
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}