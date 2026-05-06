"use client";

import { useEffect, useMemo, useState } from "react";

type InfoLevel = "home" | "archive" | "interpretation" | "recoloring";
type DetailKey = string | null;

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
  recoloring?: {
    status?: string;
    palette?: string[];
    explanation?: string;
  };
};

const infoLevels: {
  id: Exclude<InfoLevel, "home">;
  title: string;
  subtitle: string;
}[] = [
  {
    id: "archive",
    title: "Archive",
    subtitle: "Object record",
  },
  {
    id: "interpretation",
    title: "Interpretation",
    subtitle: "Cultural reading",
  },
  {
    id: "recoloring",
    title: "Recoloring",
    subtitle: "Color tool",
  },
];

const recolorParts = ["Body", "Head", "Eyes", "Tusks", "Ornaments", "Details"];

const defaultPalette = [
  "#6E1E1E",
  "#4A1A14",
  "#F2F2F2",
  "#000000",
  "#1A0F0A",
  "#C89B3C",
];

function getColorLabel(color: string) {
  const colorMap: Record<string, string> = {
    "#6E1E1E": "Dark red",
    "#4A1A14": "Deep brown-red",
    "#F2F2F2": "White",
    "#000000": "Black",
    "#1A0F0A": "Dark brown",
    "#C89B3C": "Gold",
  };

  return colorMap[color.toUpperCase()] || color;
}

function cleanValue(value?: string) {
  if (!value || value.trim() === "") return "To be added";

  const lower = value.toLowerCase();

  if (
    lower.includes("add ") ||
    lower.includes("from excel") ||
    lower.includes("replace this")
  ) {
    return "To be added";
  }

  return value;
}

function MenuCard({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left transition hover:border-amber-300/70 hover:bg-amber-300/10"
    >
      <p className="text-2xl font-medium text-white">{title}</p>
      {subtitle && (
        <p className="mt-2 text-sm leading-5 text-white/45">{subtitle}</p>
      )}
    </button>
  );
}

function DetailScreen({
  label,
  title,
  value,
  onBack,
}: {
  label: string;
  title: string;
  value?: string;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <button
        onClick={onBack}
        className="mb-5 w-fit rounded-full border border-white/15 px-5 py-3 text-lg text-white/70 transition hover:bg-white/10 hover:text-white"
      >
        ← Back
      </button>

      <div className="flex min-h-0 flex-1 flex-col rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
        <p className="mb-4 text-sm uppercase tracking-[0.3em] text-amber-300/80">
          {label}
        </p>

        <h2 className="text-5xl font-semibold tracking-tight text-white">
          {title}
        </h2>

        <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-4">
          <p className="max-w-5xl text-2xl leading-[1.45] text-white/85">
            {cleanValue(value)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function DataInterface() {
  const [items, setItems] = useState<SculptureMetadata[]>([]);
  const [selectedId, setSelectedId] = useState("panjurli");
  const [level, setLevel] = useState<InfoLevel>("home");
  const [detail, setDetail] = useState<DetailKey>(null);
  const [selectedPart, setSelectedPart] = useState("Body");
  const [selectedColor, setSelectedColor] = useState("#6E1E1E");
  const [showSculptureList, setShowSculptureList] = useState(false);

  useEffect(() => {
    fetch("/metadata/sculptures.json")
      .then((response) => response.json())
      .then((data) => {
        setItems(data);
        if (data?.[0]?.id) {
          setSelectedId(data[0].id);
        }
      })
      .catch((error) => {
        console.error("Could not load metadata:", error);
      });
  }, []);

  const selected = useMemo(() => {
    return items.find((item) => item.id === selectedId) ?? items[0];
  }, [items, selectedId]);

  const palette = selected?.recoloring?.palette?.length
    ? selected.recoloring.palette
    : defaultPalette;

  const dimensions = [
    selected?.dimensions?.height_cm && `Height: ${selected.dimensions.height_cm} cm`,
    selected?.dimensions?.width_cm && `Width: ${selected.dimensions.width_cm} cm`,
    selected?.dimensions?.depth_cm && `Depth: ${selected.dimensions.depth_cm} cm`,
  ]
    .filter(Boolean)
    .join(" · ");

  const archiveDetails: Record<string, { title: string; value?: string }> = {
    description: {
      title: "Description",
      value: selected?.description,
    },
    materials: {
      title: "Materials",
      value: selected?.classification?.materials,
    },
    period: {
      title: "Date / period",
      value: selected?.historical?.dateable_period_ad,
    },
    provenance: {
      title: "Provenance",
      value: selected?.historical?.provenance,
    },
    dimensions: {
      title: "Dimensions",
      value: dimensions,
    },
    function: {
      title: "Function / usage",
      value: selected?.archive_metadata?.function_usage,
    },
  };

  const interpretationDetails: Record<string, { title: string; value?: string }> =
    {
      role: {
        title: "Interpretive role",
        value: selected?.interpretation?.function,
      },
      meaning: {
        title: "Meaning category",
        value: selected?.interpretation?.meaning,
      },
      explanation: {
        title: "Interpretive explanation",
        value: selected?.interpretation?.explanation,
      },
      caution: {
        title: "Curatorial caution",
        value:
          "This interpretation is a guided reading, not a final or universal explanation of the sculpture or of Bhuta worship.",
      },
    };

  if (!selected) {
    return (
      <main className="flex h-screen items-center justify-center bg-black text-white">
        Loading metadata…
      </main>
    );
  }

  return (
    <main className="h-screen overflow-hidden bg-[#050505] p-6 text-white">
      <section className="mx-auto h-full max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl">
        {level === "home" && (
          <div className="flex h-full flex-col">
            <div className="grid flex-1 gap-8 lg:grid-cols-[1fr_360px]">
              <div className="relative flex flex-col justify-center">
                <p className="mb-4 text-sm uppercase tracking-[0.25em] text-white/40">
                  Choose sculpture
                </p>

                <button
                  onClick={() => setShowSculptureList(!showSculptureList)}
                  className="rounded-2xl border border-amber-300/70 bg-amber-300/10 p-5 text-left transition hover:bg-amber-300/15"
                >
                  <span className="block text-2xl font-medium">
                    {selected.object.name}
                  </span>

                  <span className="mt-2 block text-sm text-white/45">
                    {cleanValue(selected.classification?.category)}
                  </span>

                  <span className="mt-4 block text-sm text-amber-300/80">
                    Tap to change sculpture
                  </span>
                </button>

                {showSculptureList && (
                  <div className="absolute right-0 top-[calc(50%+4.5rem)] z-50 max-h-[360px] w-full overflow-y-auto rounded-2xl border border-white/10 bg-[#080808] p-3 shadow-2xl">
                    <div className="grid gap-2">
                      {items.map((item) => {
                        const active = item.id === selected.id;

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedId(item.id);
                              setLevel("home");
                              setDetail(null);
                              setShowSculptureList(false);
                            }}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                              active
                                ? "border-amber-300/70 bg-amber-300/10"
                                : "border-white/10 bg-black/40 hover:bg-white/[0.06]"
                            }`}
                          >
                            <span className="block text-lg font-medium">
                              {item.object.name}
                            </span>

                            <span className="mt-1 block text-xs text-white/45">
                              {cleanValue(item.classification?.category)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-white/10 pt-6">
              <p className="mb-4 text-sm uppercase tracking-[0.25em] text-white/40">
                Information level
              </p>

              <div className="grid gap-4 md:grid-cols-3">
                {infoLevels.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setLevel(item.id);
                      setDetail(null);
                    }}
                    className="rounded-2xl border border-white/10 bg-black/30 p-5 text-left transition hover:border-amber-300/70 hover:bg-amber-300/10"
                  >
                    <span className="block text-2xl font-medium">
                      {item.title}
                    </span>

                    <span className="mt-2 block text-base text-white/45">
                      {item.subtitle}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {level === "archive" && detail && archiveDetails[detail] && (
          <DetailScreen
            label="Archive"
            title={archiveDetails[detail].title}
            value={archiveDetails[detail].value}
            onBack={() => setDetail(null)}
          />
        )}

        {level === "interpretation" &&
          detail &&
          interpretationDetails[detail] && (
            <DetailScreen
              label="Interpretation"
              title={interpretationDetails[detail].title}
              value={interpretationDetails[detail].value}
              onBack={() => setDetail(null)}
            />
          )}

        {level === "archive" && !detail && (
          <div className="flex h-full flex-col">
            <button
              onClick={() => setLevel("home")}
              className="mb-6 w-fit rounded-full border border-white/15 px-5 py-3 text-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ← Back
            </button>

            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.3em] text-amber-300/80">
                Archive
              </p>
              <h1 className="mt-3 text-6xl font-semibold tracking-tight">
                {selected.object.name}
              </h1>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-4">
              <MenuCard
                title="Description"
                subtitle="Short object description"
                onClick={() => setDetail("description")}
              />
              <MenuCard
                title="Materials"
                subtitle="What the object is made from"
                onClick={() => setDetail("materials")}
              />
              <MenuCard
                title="Date / period"
                subtitle="Historical dating"
                onClick={() => setDetail("period")}
              />
              <MenuCard
                title="Provenance"
                subtitle="Known origin or collection history"
                onClick={() => setDetail("provenance")}
              />
              <MenuCard
                title="Dimensions"
                subtitle="Height, width, and depth"
                onClick={() => setDetail("dimensions")}
              />
              <MenuCard
                title="Function / usage"
                subtitle="Documented use or role"
                onClick={() => setDetail("function")}
              />
            </div>
          </div>
        )}

        {level === "interpretation" && !detail && (
          <div className="flex h-full flex-col">
            <button
              onClick={() => setLevel("home")}
              className="mb-6 w-fit rounded-full border border-white/15 px-5 py-3 text-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ← Back
            </button>

            <div className="mb-8">
              <p className="text-sm uppercase tracking-[0.3em] text-amber-300/80">
                Interpretation
              </p>
              <h1 className="mt-3 text-6xl font-semibold tracking-tight">
                {selected.object.name}
              </h1>
            </div>

            <div className="grid flex-1 grid-cols-2 gap-4">
              <MenuCard
                title="Role"
                subtitle="How the figure can be understood"
                onClick={() => setDetail("role")}
              />
              <MenuCard
                title="Meaning"
                subtitle="Simplified interpretive category"
                onClick={() => setDetail("meaning")}
              />
              <MenuCard
                title="Explanation"
                subtitle="Contextual reading"
                onClick={() => setDetail("explanation")}
              />
              <MenuCard
                title="Caution"
                subtitle="Why this is not a definitive decoding"
                onClick={() => setDetail("caution")}
              />
            </div>
          </div>
        )}

        {level === "recoloring" && (
          <div className="flex h-full min-h-0 flex-col">
            <button
              onClick={() => {
                setLevel("home");
                setDetail(null);
              }}
              className="mb-3 w-fit rounded-full border border-white/15 px-4 py-2 text-base text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              ← Back
            </button>

            <div className="mb-4">
              <p className="text-xs uppercase tracking-[0.3em] text-amber-300/80">
                Recoloring
              </p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight">
                {selected.object.name}
              </h1>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-3 gap-3">
              <div className="min-h-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">
                  Part
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {recolorParts.map((part) => (
                    <button
                      key={part}
                      onClick={() => setSelectedPart(part)}
                      className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                        selectedPart === part
                          ? "border-amber-300/70 bg-amber-300/10 text-white"
                          : "border-white/10 bg-black/30 text-white/60 hover:bg-white/[0.06]"
                      }`}
                    >
                      {part}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">
                  Color
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {palette.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                        selectedColor === color
                          ? "border-amber-300/70 bg-amber-300/10"
                          : "border-white/10 bg-black/30 hover:bg-white/[0.06]"
                      }`}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-white/70">{getColorLabel(color)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                <p className="mb-2 text-xs uppercase tracking-[0.22em] text-white/40">
                  Preview
                </p>

                <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-12 w-12 rounded-full border border-white/20"
                      style={{ backgroundColor: selectedColor }}
                    />

                    <div>
                      <p className="mt-3 text-xs text-white/45">Selected color</p>
                      <p className="text-base text-white/85">{getColorLabel(selectedColor)}</p>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-white/45">Selected color</p>
                  <p className="text-base text-white/85">{selectedColor}</p>

                  <button className="mt-4 w-full rounded-xl border border-amber-300/60 bg-amber-300/10 px-4 py-2 text-sm font-medium text-white/90">
                    Apply color
                  </button>

                  <p className="mt-2 text-[11px] leading-4 text-white/35">
                    Prototype layout only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}