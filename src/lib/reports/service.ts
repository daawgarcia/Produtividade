import { MOVER_SOURCES, OPERATOR_SOURCES } from "@/lib/reports/config";
import { getSheetRows, getSheetRowsByName } from "@/lib/reports/googleSheets";
import { buildMoversReport, buildOperatorsReport } from "@/lib/reports/parsers";
import type { MoversReport, OperatorsReport } from "@/lib/reports/types";

const TEN_MINUTES_MS = 10 * 60 * 1000;

const cache = new Map<string, { createdAt: number; data: unknown }>();

const MONTH_NAMES_PT_BR = [
  "Janeiro",
  "Fevereiro",
  "Marco",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const REQUIRED_OPERATORS = ["Marcos", "Mariana"];

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isoToBrDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function scoreRowsSignal(rows: string[][], dateFilter: string | null): number {
  if (!rows.length) {
    return -1;
  }

  const sampleRows = rows.slice(0, 250);
  const headerRows = rows.slice(0, 12);
  let score = 0;

  // Prefer datasets that look like the expected report headers.
  for (const row of headerRows) {
    for (const cell of row) {
      const text = normalizeText(String(cell ?? ""));
      if (
        text.includes("data") ||
        text.includes("caso") ||
        text.includes("prepar") ||
        text.includes("libera") ||
        text.includes("scanner") ||
        text.includes("mio") ||
        text.includes("air")
      ) {
        score += 2;
      }
    }
  }

  // Prefer datasets with more useful rows.
  score += Math.min(rows.length, 300) / 10;

  if (dateFilter) {
    const brDate = isoToBrDate(dateFilter);
    const compactBrDate = brDate.replace(/^0/, "").replace("/0", "/");

    for (const row of sampleRows) {
      for (const cell of row) {
        const text = String(cell ?? "");
        if (text.includes(brDate) || text.includes(compactBrDate) || text.includes(dateFilter)) {
          score += 8;
        }
      }
    }
  }

  return score;
}

function ensureRequiredOperators(report: OperatorsReport): OperatorsReport {
  const present = new Set(report.operators.map((item) => item.operator));
  const missing = REQUIRED_OPERATORS.filter((name) => !present.has(name));

  if (!missing.length) {
    return report;
  }

  return {
    ...report,
    operators: [
      ...report.operators,
      ...missing.map((operator) => ({
        operator,
        preparo: 0,
        liberacao: 0,
        scanner: 0,
        mio: 0,
        air: 0,
        total: 0,
      })),
    ],
  };
}

function resolveMonthName(dateFilter: string | null, monthFilter: number | null): string {
  if (dateFilter) {
    const parts = dateFilter.split("-");
    const monthNumber = Number(parts[1]);
    const monthName = MONTH_NAMES_PT_BR[monthNumber - 1];
    if (monthName) {
      return monthName;
    }
  }

  if (monthFilter) {
    const monthName = MONTH_NAMES_PT_BR[monthFilter - 1];
    if (monthName) {
      return monthName;
    }
  }

  return MONTH_NAMES_PT_BR[new Date().getMonth()];
}

async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  forceRefresh = false
): Promise<T> {
  const now = Date.now();

  if (!forceRefresh) {
    const cached = cache.get(key);
    if (cached && now - cached.createdAt < TEN_MINUTES_MS) {
      return cached.data as T;
    }
  }

  const data = await loader();
  cache.set(key, { createdAt: now, data });
  return data;
}

export async function getOperatorsReport(
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null,
  forceRefresh = false
): Promise<OperatorsReport> {
  const monthName = resolveMonthName(dateFilter, monthFilter);
  const cacheKey = `operators:${dateFilter ?? "all"}:${monthFilter ?? "all"}:${yearFilter ?? "all"}:${monthName}`;

  return withCache(
    cacheKey,
    async () => {
      const rowsByOperator = await Promise.all(
        OPERATOR_SOURCES.map(async (source) => {
          const monthRows = await getSheetRowsByName(
            source.spreadsheetId,
            monthName,
            source.gid,
            false
          );

          const fallbackRows = await getSheetRows(source.spreadsheetId, source.gid);

          const monthScore = scoreRowsSignal(monthRows, dateFilter);
          const fallbackScore = scoreRowsSignal(fallbackRows, dateFilter);
          const rows = fallbackScore > monthScore ? fallbackRows : monthRows;

          return { operator: source.name, rows };
        })
      );

      const report = buildOperatorsReport(rowsByOperator, dateFilter, monthFilter, yearFilter);
      return ensureRequiredOperators(report);
    },
    forceRefresh
  );
}

export async function getMoversReport(
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null,
  forceRefresh = false
): Promise<MoversReport> {
  const cacheKey = `movers:${dateFilter ?? "all"}:${monthFilter ?? "all"}:${yearFilter ?? "all"}`;

  return withCache(
    cacheKey,
    async () => {
      const rowsByMovimentador = await Promise.all(
        MOVER_SOURCES.map(async (source) => {
          const rows = source.sheetName
            ? await getSheetRowsByName(
                source.spreadsheetId,
                source.sheetName,
                source.gid,
                true
              )
            : await getSheetRows(source.spreadsheetId, source.gid);
          return { movimentador: source.name, rows };
        })
      );

      return buildMoversReport(rowsByMovimentador, dateFilter, monthFilter, yearFilter);
    },
    forceRefresh
  );
}
