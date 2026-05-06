import { NextResponse } from "next/server";
import { getOperatorsReport } from "@/lib/reports/service";

function parseDateFilter(rawDate: string | null): string | null {
  if (!rawDate) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    throw new Error("Formato de data invalido. Use YYYY-MM-DD.");
  }

  return rawDate;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const date = parseDateFilter(url.searchParams.get("date"));
    const refresh = ["1", "true", "yes"].includes(
      (url.searchParams.get("refresh") ?? "").toLowerCase()
    );

    const report = await getOperatorsReport(date, refresh);

    return NextResponse.json(report, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
