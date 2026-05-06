export interface SheetSource {
  name: string;
  spreadsheetId: string;
  gid?: number;
}

function parseSpreadsheetId(url: string): string {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) {
    throw new Error(`URL de planilha invalida: ${url}`);
  }

  return match[1];
}

function parseGid(url: string): number | undefined {
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  if (!gidMatch) {
    return undefined;
  }

  return Number(gidMatch[1]);
}

function makeSheetSource(name: string, url: string): SheetSource {
  return {
    name,
    spreadsheetId: parseSpreadsheetId(url),
    gid: parseGid(url),
  };
}

export const OPERATOR_SOURCES: SheetSource[] = [
  makeSheetSource(
    "Matheus Luan",
    "https://docs.google.com/spreadsheets/d/1vIlT1g_gCk7ueQEuBsbQbu5W6rbD_wV_KhTpT4MQWg8/edit?gid=1541752272#gid=1541752272"
  ),
  makeSheetSource(
    "Isis",
    "https://docs.google.com/spreadsheets/d/1OSmuLFpQIzbwRRQOwVWzrSb_6eBJqhNbNLTDQS-_vJU/edit?gid=141457879#gid=141457879"
  ),
  makeSheetSource(
    "Priscila",
    "https://docs.google.com/spreadsheets/d/14lT0GdxdAJym2wVMROyWrGdfc4wq6IZZXbot4YDjcIg/edit"
  ),
  makeSheetSource(
    "Thiago",
    "https://docs.google.com/spreadsheets/d/1BS5aywPrlr61PqbUDtK7AOKEFjJxe2EIGuPxNC0YuHM/edit"
  ),
  makeSheetSource(
    "Isabelle",
    "https://docs.google.com/spreadsheets/d/1q1qbHkIWSgyzuE95IEABR14ztLkNHOjroy-DOZkJFIM/edit"
  ),
  makeSheetSource(
    "Pedro",
    "https://docs.google.com/spreadsheets/d/1Tt4UJLLDr3mB0RmB63aBMe90U7XgBP4M7j1_tC16dJI/edit?gid=1541752272#gid=1541752272"
  ),
];

export const MOVER_SOURCES: SheetSource[] = [
  makeSheetSource(
    "Gabriel",
    "https://docs.google.com/spreadsheets/d/16fu4jT0hMhyz9a78ftqVdBTbxiNUGwuTMs_OrY1tevY/edit?gid=2116979790#gid=2116979790"
  ),
  makeSheetSource(
    "Ariane",
    "https://docs.google.com/spreadsheets/d/1RVFr6QzPPJnE2R3c_Wqcfbvb2HcuXTOu3eurr8M6Q-o?authuser=otavio.garcia2805%40gmail.com&usp=drive_fs"
  ),
  makeSheetSource(
    "Pietro",
    "https://docs.google.com/spreadsheets/d/1iUlHNLy-e1hXLLjTBJHF9WGhRFYIjzKNvaCZuytz9wM?authuser=otavio.garcia2805%40gmail.com&usp=drive_fs"
  ),
];
