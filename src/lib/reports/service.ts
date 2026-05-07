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

function resolveMonthName(dateFilter: string | null): string {
  if (dateFilter) {
    const parts = dateFilter.split("-");
    const monthNumber = Number(parts[1]);
    const monthName = MONTH_NAMES_PT_BR[monthNumber - 1];
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
  yearFilter: number | null,
  forceRefresh = false
): Promise<OperatorsReport> {
  const monthName = resolveMonthName(dateFilter);
  const cacheKey = `operators:${dateFilter ?? "all"}:${yearFilter ?? "all"}:${monthName}`;

  return withCache(
    cacheKey,
    async () => {
      const rowsByOperator = await Promise.all(
        OPERATOR_SOURCES.map(async (source) => {
          const rows = await getSheetRowsByName(
            source.spreadsheetId,
            monthName,
            source.gid,
            false
          );
          return { operator: source.name, rows };
        })
      );

      const report = buildOperatorsReport(rowsByOperator, dateFilter, yearFilter);
      return ensureRequiredOperators(report);
    },
    forceRefresh
  );
}

export async function getMoversReport(
  dateFilter: string | null,
  yearFilter: number | null,
  forceRefresh = false
): Promise<MoversReport> {
  const cacheKey = `movers:${dateFilter ?? "all"}:${yearFilter ?? "all"}`;

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

      return buildMoversReport(rowsByMovimentador, dateFilter, yearFilter);
    },
    forceRefresh
  );
}
