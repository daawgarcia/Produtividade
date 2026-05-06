import type {
  MoverReportItem,
  MoversReport,
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

  const maybeNumber = Number(trimmed);
  if (Number.isFinite(maybeNumber) && maybeNumber > 20000) {
    const unixMs = Math.round((maybeNumber - 25569) * 86400 * 1000);
    const date = new Date(unixMs);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString().slice(0, 10);
    }
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function findDateColumn(headers: string[]): number {
  const index = headers.findIndex((header) => /(data|dia|date)/.test(normalizeText(header)));
  return index >= 0 ? index : 0;
}

function matchColumns(headers: string[], patterns: string[]): number[] {
  return headers
    .map((header, index) => ({ header: normalizeText(header), index }))
    .filter((item) => patterns.some((pattern) => item.header.includes(pattern)))
    .map((item) => item.index);
}

export function buildOperatorsReport(
  input: Array<{ operator: string; rows: string[][] }>,
  dateFilter: string | null
): OperatorsReport {
  const operators: OperatorReportItem[] = [];

  for (const { operator, rows } of input) {
    const [headerRow = [], ...dataRows] = rows;
    const headers = headerRow.map(String);

    const dateColumn = findDateColumn(headers);
    const preparoColumns = matchColumns(headers, ["preparo"]);
    const liberacaoColumns = matchColumns(headers, ["liberacao"]);
    const scannerColumns = matchColumns(headers, ["scanner"]);
    const mioColumns = matchColumns(headers, ["mio"]);
    const airColumns = matchColumns(headers, ["air"]);

    const metrics = {
      preparo: 0,
      liberacao: 0,
      scanner: 0,
      mio: 0,
      air: 0,
    };

    for (const row of dataRows) {
      const rowDate = toIsoDate(row[dateColumn] ?? "");
      if (dateFilter && rowDate !== dateFilter) {
        continue;
      }

      for (const column of preparoColumns) {
        metrics.preparo += parseNumber(row[column] ?? "0");
      }
      for (const column of liberacaoColumns) {
        metrics.liberacao += parseNumber(row[column] ?? "0");
      }
      for (const column of scannerColumns) {
        metrics.scanner += parseNumber(row[column] ?? "0");
      }
      for (const column of mioColumns) {
        metrics.mio += parseNumber(row[column] ?? "0");
      }
      for (const column of airColumns) {
        metrics.air += parseNumber(row[column] ?? "0");
      }
    }

    const total =
      metrics.preparo + metrics.liberacao + metrics.scanner + metrics.mio + metrics.air;

    operators.push({
      operator,
      ...metrics,
      total,
    });
  }

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
    totals,
    operators,
  };
}

export function buildMoversReport(
  input: Array<{ movimentador: string; rows: string[][] }>,
  dateFilter: string | null
): MoversReport {
  const movimentadores: MoverReportItem[] = [];

  for (const { movimentador, rows } of input) {
    const [headerRow = [], ...dataRows] = rows;
    const headers = headerRow.map(String);

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
      if (dateFilter && rowDate !== dateFilter) {
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
    totalMovimentacoes,
    movimentadores,
  };
}
