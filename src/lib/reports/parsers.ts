import type {
  MoverReportItem,
  MoversReport,
  OperatorDuplicateItem,
  OperatorMetricKey,
  OperatorReportItem,
  OperatorsReport,
} from "@/lib/reports/types";

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseNumber(value: string): number {
  const cleaned = value
    .replace(/\s/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^0-9.-]/g, "");

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

const DEDUP_START_DATE = "2026-05-22";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const UI_DATE_TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function formatTimestampForUi(timestamp: number): string {
  return UI_DATE_TIME_FORMATTER.format(new Date(timestamp));
}

function parseExcelSerialToLocalDate(serial: number): Date {
  const excelEpochLocal = new Date(1899, 11, 30, 0, 0, 0, 0);
  return new Date(excelEpochLocal.getTime() + Math.round(serial * 86400 * 1000));
}

function toIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const dateWithSlash = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (dateWithSlash) {
    const day = dateWithSlash[1].padStart(2, "0");
    const month = dateWithSlash[2].padStart(2, "0");
    const year = dateWithSlash[3].length === 2 ? `20${dateWithSlash[3]}` : dateWithSlash[3];
    return `${year}-${month}-${day}`;
  }

  const dateWithDash = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (dateWithDash) {
    const day = dateWithDash[1].padStart(2, "0");
    const month = dateWithDash[2].padStart(2, "0");
    const year = dateWithDash[3].length === 2 ? `20${dateWithDash[3]}` : dateWithDash[3];
    return `${year}-${month}-${day}`;
  }

  const maybeNumber = Number(trimmed);
  if (Number.isFinite(maybeNumber) && maybeNumber > 20000) {
    const date = parseExcelSerialToLocalDate(maybeNumber);
    if (!Number.isNaN(date.getTime())) {
      const year = String(date.getFullYear());
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function toTimestamp(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const isoDateTime = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (isoDateTime) {
    const year = Number(isoDateTime[1]);
    const month = Number(isoDateTime[2]);
    const day = Number(isoDateTime[3]);
    const hour = Number(isoDateTime[4] ?? "0");
    const minute = Number(isoDateTime[5] ?? "0");
    const second = Number(isoDateTime[6] ?? "0");
    const parsed = new Date(year, month - 1, day, hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const direct = new Date(trimmed);
  if (!Number.isNaN(direct.getTime())) {
    return direct.getTime();
  }

  const slashDateTime = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (slashDateTime) {
    const day = slashDateTime[1].padStart(2, "0");
    const month = slashDateTime[2].padStart(2, "0");
    const year =
      slashDateTime[3].length === 2 ? `20${slashDateTime[3]}` : slashDateTime[3];
    const hour = Number((slashDateTime[4] ?? "0").padStart(2, "0"));
    const minute = Number((slashDateTime[5] ?? "0").padStart(2, "0"));
    const second = Number((slashDateTime[6] ?? "0").padStart(2, "0"));
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const dashDateTime = trimmed.match(
    /^(\d{1,2})-(\d{1,2})-(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (dashDateTime) {
    const day = dashDateTime[1].padStart(2, "0");
    const month = dashDateTime[2].padStart(2, "0");
    const year =
      dashDateTime[3].length === 2 ? `20${dashDateTime[3]}` : dashDateTime[3];
    const hour = Number((dashDateTime[4] ?? "0").padStart(2, "0"));
    const minute = Number((dashDateTime[5] ?? "0").padStart(2, "0"));
    const second = Number((dashDateTime[6] ?? "0").padStart(2, "0"));
    const parsed = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, second);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  const maybeNumber = Number(trimmed);
  if (Number.isFinite(maybeNumber) && maybeNumber > 20000) {
    const parsed = parseExcelSerialToLocalDate(maybeNumber);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.getTime();
    }
  }

  return null;
}

function findDateColumn(headers: string[]): number {
  const index = headers.findIndex((header) => /(data|dia|date)/.test(normalizeText(header)));
  return index >= 0 ? index : 0;
}

function findCaseColumn(headers: string[]): number | null {
  const index = headers.findIndex((header) => /(caso|case)/.test(normalizeText(header)));
  return index >= 0 ? index : null;
}

function findTimeColumn(headers: string[]): number | null {
  const index = headers.findIndex((header) => {
    const normalized = normalizeText(header);
    return /(hora|horario|time)/.test(normalized) && !/(data|date|dia)/.test(normalized);
  });
  return index >= 0 ? index : null;
}

function normalizeTimePart(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const serial = Number(trimmed);
  if (Number.isFinite(serial) && serial >= 0 && serial < 1) {
    const totalSeconds = Math.round(serial * 24 * 60 * 60);
    const hours = String(Math.floor(totalSeconds / 3600) % 24).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  const hm = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (hm) {
    const hour = hm[1].padStart(2, "0");
    const minute = hm[2];
    const second = (hm[3] ?? "00").padStart(2, "0");
    return `${hour}:${minute}:${second}`;
  }

  return null;
}

function combineDateAndTime(dateCell: string, timeCell: string | null): string {
  if (!timeCell || /\d{1,2}:\d{2}/.test(dateCell)) {
    return dateCell;
  }

  const normalizedTime = normalizeTimePart(timeCell);
  if (!normalizedTime) {
    return dateCell;
  }

  return `${dateCell} ${normalizedTime}`;
}

function normalizeCaseId(value: string): string | null {
  const normalized = value.trim().replace(/\s/g, "").replace(/[^a-zA-Z0-9-]/g, "");
  return normalized ? normalized.toLowerCase() : null;
}

function findHeaderAndDataRows(
  rows: string[][],
  keywords: string[]
): { headers: string[]; dataRows: string[][] } {
  const scanLimit = Math.min(rows.length, 12);
  let bestIndex = 0;
  let bestScore = -1;

  for (let rowIndex = 0; rowIndex < scanLimit; rowIndex++) {
    const row = rows[rowIndex] ?? [];
    const normalized = row.map((cell) => normalizeText(String(cell ?? "")));
    const nonEmptyCells = normalized.filter(Boolean).length;
    const keywordMatches = normalized.reduce((acc, cell) => {
      if (!cell) {
        return acc;
      }
      return acc + (keywords.some((keyword) => cell.includes(keyword)) ? 1 : 0);
    }, 0);

    const score = keywordMatches * 10 + nonEmptyCells;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = rowIndex;
    }
  }

  const headers = (rows[bestIndex] ?? []).map(String);
  const dataRows = rows.slice(bestIndex + 1);

  return { headers, dataRows };
}

function shouldIncludeRow(
  rowDate: string | null,
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): boolean {
  if (!rowDate) {
    return !dateFilter && !monthFilter && !yearFilter;
  }

  if (dateFilter && rowDate !== dateFilter) {
    return false;
  }

  if (monthFilter) {
    const month = Number(rowDate.split("-")[1]);
    if (month !== monthFilter) {
      return false;
    }
  }

  if (yearFilter && !rowDate.startsWith(`${yearFilter}-`)) {
    return false;
  }

  return true;
}

function matchColumns(headers: string[], patterns: string[]): number[] {
  return headers
    .map((header, index) => ({ header: normalizeText(header), index }))
    .filter((item) => patterns.some((pattern) => item.header.includes(pattern)))
    .map((item) => item.index);
}

export function buildOperatorsReport(
  input: Array<{ operator: string; rows: string[][] }>,
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): OperatorsReport {
  const metricsByOperator = new Map<
    string,
    { preparo: number; liberacao: number; scanner: number; mio: number; air: number }
  >();

  type CaseEvent = {
    operator: string;
    metric: OperatorMetricKey;
    caseId: string;
    timestamp: number;
  };

  const dedupEvents: CaseEvent[] = [];
  const duplicates: OperatorDuplicateItem[] = [];

  function getOperatorMetrics(operator: string) {
    const existing = metricsByOperator.get(operator);
    if (existing) {
      return existing;
    }

    const created = {
      preparo: 0,
      liberacao: 0,
      scanner: 0,
      mio: 0,
      air: 0,
    };
    metricsByOperator.set(operator, created);
    return created;
  }

  for (const { operator, rows } of input) {
    const { headers, dataRows } = findHeaderAndDataRows(rows, [
      "data",
      "scanner",
      "prepar",
      "libera",
      "mio",
      "air",
    ]);

    const dateColumn = findDateColumn(headers);
    const preparoColumns = matchColumns(headers, ["prepar"]);
    const liberacaoColumns = matchColumns(headers, ["libera"]);
    const scannerColumns = matchColumns(headers, ["scanner"]);
    const mioColumns = matchColumns(headers, ["mio"]);
    const airColumns = matchColumns(headers, ["air"]);

    const metrics = getOperatorMetrics(operator);
    const caseColumn = findCaseColumn(headers);
    const timeColumn = findTimeColumn(headers);

    for (const row of dataRows) {
      const rawDateCell = row[dateColumn] ?? "";
      const rawTimeCell = timeColumn !== null ? String(row[timeColumn] ?? "") : null;
      const rowDateTime = combineDateAndTime(String(rawDateCell), rawTimeCell);
      const rowDate = toIsoDate(rawDateCell);
      if (!shouldIncludeRow(rowDate, dateFilter, monthFilter, yearFilter)) {
        continue;
      }

      const applyDedupRule = Boolean(
        rowDate && rowDate >= DEDUP_START_DATE && caseColumn !== null
      );

      const caseId = applyDedupRule
        ? normalizeCaseId(String(row[caseColumn ?? -1] ?? ""))
        : null;

      const rowTimestamp = toTimestamp(rowDateTime) ?? toTimestamp(String(rawDateCell)) ?? 0;

      const metricColumns: Array<{ metric: OperatorMetricKey; columns: number[] }> = [
        { metric: "preparo", columns: preparoColumns },
        { metric: "liberacao", columns: liberacaoColumns },
        { metric: "scanner", columns: scannerColumns },
        { metric: "mio", columns: mioColumns },
        { metric: "air", columns: airColumns },
      ];

      for (const metricColumn of metricColumns) {
        const rawValue = metricColumn.columns.reduce(
          (acc, column) => acc + parseNumber(row[column] ?? "0"),
          0
        );

        if (rawValue <= 0) {
          continue;
        }

        if (applyDedupRule && caseId) {
          dedupEvents.push({
            operator,
            metric: metricColumn.metric,
            caseId,
            timestamp: rowTimestamp,
          });
          continue;
        }

        metrics[metricColumn.metric] += rawValue;
      }
    }
  }

  dedupEvents.sort((a, b) => {
    if (a.timestamp !== b.timestamp) {
      return a.timestamp - b.timestamp;
    }
    return a.operator.localeCompare(b.operator);
  });

  const lastAcceptedByCaseAndMetric = new Map<
    string,
    { timestamp: number; operator: string }
  >();
  for (const event of dedupEvents) {
    const dedupKey = `${event.metric}:${event.caseId}`;
    const lastAccepted = lastAcceptedByCaseAndMetric.get(dedupKey);

    if (
      lastAccepted !== undefined &&
      event.timestamp - lastAccepted.timestamp < THIRTY_DAYS_MS
    ) {
      duplicates.push({
        caseId: event.caseId,
        metric: event.metric,
        firstOperator: lastAccepted.operator,
        duplicateOperator: event.operator,
        firstTimestamp: formatTimestampForUi(lastAccepted.timestamp),
        duplicateTimestamp: formatTimestampForUi(event.timestamp),
      });
      continue;
    }

    const metrics = getOperatorMetrics(event.operator);
    metrics[event.metric] += 1;
    lastAcceptedByCaseAndMetric.set(dedupKey, {
      timestamp: event.timestamp,
      operator: event.operator,
    });
  }

  duplicates.sort((a, b) => {
    const tsA = new Date(a.duplicateTimestamp).getTime();
    const tsB = new Date(b.duplicateTimestamp).getTime();
    return tsB - tsA;
  });

  const operators: OperatorReportItem[] = input.map(({ operator }) => {
    const metrics = getOperatorMetrics(operator);
    const total =
      metrics.preparo + metrics.liberacao + metrics.scanner + metrics.mio + metrics.air;

    return {
      operator,
      ...metrics,
      total,
    };
  });

  const totals = operators.reduce(
    (acc, item) => {
      acc.preparo += item.preparo;
      acc.liberacao += item.liberacao;
      acc.scanner += item.scanner;
      acc.mio += item.mio;
      acc.air += item.air;
      acc.total += item.total;
      return acc;
    },
    {
      preparo: 0,
      liberacao: 0,
      scanner: 0,
      mio: 0,
      air: 0,
      total: 0,
    }
  );

  return {
    generatedAt: new Date().toISOString(),
    dateFilter,
    monthFilter,
    yearFilter,
    totals,
    operators,
    duplicates,
  };
}

export function buildMoversReport(
  input: Array<{ movimentador: string; rows: string[][] }>,
  dateFilter: string | null,
  monthFilter: number | null,
  yearFilter: number | null
): MoversReport {
  const movimentadores: MoverReportItem[] = [];

  for (const { movimentador, rows } of input) {
    const { headers, dataRows } = findHeaderAndDataRows(rows, [
      "data",
      "moviment",
      "quant",
      "qtd",
      "total",
    ]);

    const dateColumn = findDateColumn(headers);
    const movementColumns = matchColumns(headers, [
      "moviment",
      "quantidade",
      "qtd",
      "total",
    ]).filter((column) => column !== dateColumn);

    let movimentacoes = 0;

    for (const row of dataRows) {
      const rowDate = toIsoDate(row[dateColumn] ?? "");
      if (!shouldIncludeRow(rowDate, dateFilter, monthFilter, yearFilter)) {
        continue;
      }

      const columnsToUse = movementColumns.length
        ? movementColumns
        : row.map((_, index) => index).filter((index) => index !== dateColumn);

      for (const column of columnsToUse) {
        movimentacoes += parseNumber(row[column] ?? "0");
      }
    }

    movimentadores.push({ movimentador, movimentacoes });
  }

  const totalMovimentacoes = movimentadores.reduce(
    (acc, item) => acc + item.movimentacoes,
    0
  );

  return {
    generatedAt: new Date().toISOString(),
    dateFilter,
    monthFilter,
    yearFilter,
    totalMovimentacoes,
    movimentadores,
  };
}
