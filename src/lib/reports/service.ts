import { MOVER_SOURCES, OPERATOR_SOURCES } from "@/lib/reports/config";
import { getSheetRows } from "@/lib/reports/googleSheets";
import { buildMoversReport, buildOperatorsReport } from "@/lib/reports/parsers";
import type { MoversReport, OperatorsReport } from "@/lib/reports/types";

const TWO_MINUTES_MS = 2 * 60 * 1000;

const cache = new Map<string, { createdAt: number; data: unknown }>();

async function withCache<T>(
  key: string,
  loader: () => Promise<T>,
  forceRefresh = false
): Promise<T> {
  const now = Date.now();

  if (!forceRefresh) {
    const cached = cache.get(key);
    if (cached && now - cached.createdAt < TWO_MINUTES_MS) {
      return cached.data as T;
    }
  }

  const data = await loader();
  cache.set(key, { createdAt: now, data });
  return data;
}

export async function getOperatorsReport(
  dateFilter: string | null,
  forceRefresh = false
): Promise<OperatorsReport> {
  const cacheKey = `operators:${dateFilter ?? "all"}`;

  return withCache(
    cacheKey,
    async () => {
      const rowsByOperator = await Promise.all(
        OPERATOR_SOURCES.map(async (source) => {
          const rows = await getSheetRows(source.spreadsheetId, source.gid);
          return { operator: source.name, rows };
        })
      );

      return buildOperatorsReport(rowsByOperator, dateFilter);
    },
    forceRefresh
  );
}

export async function getMoversReport(
  dateFilter: string | null,
  forceRefresh = false
): Promise<MoversReport> {
  const cacheKey = `movers:${dateFilter ?? "all"}`;

  return withCache(
    cacheKey,
    async () => {
      const rowsByMovimentador = await Promise.all(
        MOVER_SOURCES.map(async (source) => {
          const rows = await getSheetRows(source.spreadsheetId, source.gid);
          return { movimentador: source.name, rows };
        })
      );

      return buildMoversReport(rowsByMovimentador, dateFilter);
    },
    forceRefresh
  );
}
