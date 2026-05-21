import { NextResponse } from "next/server";
import { getOperatorDebugReport } from "@/lib/reports/service";

function parseDateFilter(rawDate: string | null): string | null {
  if (!rawDate) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw new Error("Formato de data invalido. Use YYYY-MM-DD.");
  }

  return rawDate;
}

function parseYearFilter(rawYear: string | null): number | null {
  if (!rawYear) {
    return null;
  }

  if (!/^\d{4}$/.test(rawYear)) {
    throw new Error("Formato de ano invalido. Use YYYY.");
  }

  return Number(rawYear);
}

function parseMonthFilter(rawMonth: string | null): number | null {
  if (!rawMonth) {
    return null;
  }

  if (!/^\d{1,2}$/.test(rawMonth)) {
    throw new Error("Formato de mes invalido. Use 1-12.");
  }

  const month = Number(rawMonth);
  if (month < 1 || month > 12) {
    throw new Error("Mes invalido. Use um valor de 1 a 12.");
  }

  return month;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const operator = (url.searchParams.get("operator") ?? "").trim();
    if (!operator) {
      throw new Error("Parametro operator e obrigatorio.");
    }

    const date = parseDateFilter(url.searchParams.get("date"));
    const month = parseMonthFilter(url.searchParams.get("month"));
    const year = parseYearFilter(url.searchParams.get("year"));

    const debug = await getOperatorDebugReport(operator, date, month, year);
    return NextResponse.json(debug, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
