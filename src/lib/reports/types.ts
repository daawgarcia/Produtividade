export type OperatorMetricKey = "preparo" | "liberacao" | "scanner" | "mio" | "air";

export interface OperatorTotals {
  preparo: number;
  liberacao: number;
  scanner: number;
  mio: number;
  air: number;
  total: number;
}

export interface OperatorReportItem extends OperatorTotals {
  operator: string;
}

export interface OperatorsReport {
  generatedAt: string;
  dateFilter: string | null;
  yearFilter: number | null;
  totals: OperatorTotals;
  operators: OperatorReportItem[];
}

export interface MoverReportItem {
  movimentador: string;
  movimentacoes: number;
}

export interface MoversReport {
  generatedAt: string;
  dateFilter: string | null;
  yearFilter: number | null;
  totalMovimentacoes: number;
  movimentadores: MoverReportItem[];
}
