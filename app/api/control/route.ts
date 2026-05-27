import { NextResponse } from "next/server";

type ControlState = {
  sculptureId: "panjurli" | "nandigona" | "ammanavaru";
  mode: "archive" | "interpretation" | "recoloring";
  selectedPart: string | null;
  selectedColor: string | null;
  colorSelections: Record<string, string>;
};

let controlState: ControlState = {
  sculptureId: "panjurli",
  mode: "archive",
  selectedPart: null,
  selectedColor: null,
  colorSelections: {},
};

export async function GET() {
  return NextResponse.json(controlState);
}

export async function POST(request: Request) {
  const body = await request.json();

  controlState = {
    ...controlState,
    ...body,
  };

  return NextResponse.json(controlState);
}
