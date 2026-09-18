import { format } from "date-fns";
import { formatInr, monthKey, monthTotals } from "./money";
import type { Snapshot } from "./backup";
import type { Note, Plan, RecurringSpend, Task, Transaction } from "./types";

function xml(s: string) {
  return s
    .replace(/&/g, "\u0026amp;")
    .replace(/</g, "\u0026lt;")
    .replace(/>/g, "\u0026gt;")
    .replace(/"/g, "\u0026quot;");
}

function sheet(name: string, headers: string[], rows: string[][]) {
  const head = headers
    .map((h) => `<Cell><Data ss:Type="String">${xml(h)}</Data></Cell>`)
    .join("");
  const body = rows
    .map(
      (row) =>
        `<Row>${row.map((c) => `<Cell><Data ss:Type="String">${xml(c)}</Data></Cell>`).join("")}</Row>`,
    )
    .join("");
  return `<Worksheet ss:Name="${xml(name)}"><Table><Row>${head}</Row>${body}</Table></Worksheet>`;
}

function when(ms: number | null | undefined) {
  if (!ms) return "";
  try {
    return format(ms, "d MMM yyyy, h:mm a");
  } catch {
    return "";
  }
}

export function buildExcelXml(snap: Snapshot): string {
  const money = monthTotals(snap.transactions ?? []);
  const open = (snap.tasks ?? []).filter((t) => t.status !== "completed");
  const done = (snap.tasks ?? []).filter((t) => t.status === "completed");
  const rec = snap.recurringSpends ?? [];
  const sheets = [
    sheet(
      "Summary",
      ["Field", "Value"],
      [
        ["Exported", when(Date.now())],
        ["Open tasks", String(open.length)],
        ["Done tasks", String(done.length)],
        ["Completions log", String((snap.completions ?? []).length)],
        ["This month in", formatInr(money.income)],
        ["This month out", formatInr(money.expense)],
        ["Net", formatInr(money.net)],
        ["Notes", String((snap.notes ?? []).length)],
        ["Plans", String((snap.plans ?? []).length)],
        ["Repeating spends", String(rec.length)],
        ["Removed tasks", String((snap.trashTasks ?? []).length)],
        ["Removed paisa", String((snap.trashTx ?? []).length)],
      ],
    ),
    sheet(
      "Tasks",
      ["Title", "Status", "Due", "Priority", "Created", "Completed"],
      (snap.tasks ?? []).map((t: Task) => [
        t.title,
        t.status,
        when(t.dueAt),
        t.priority,
        when(t.createdAt),
        when(t.completedAt),
      ]),
    ),
    sheet(
      "Done log",
      ["Title", "Finished at", "Undone"],
      (snap.completions ?? []).map((c) => [c.title, when(c.completedAt), c.undoneAt ? when(c.undoneAt) : ""]),
    ),
    sheet(
      "Paisa",
      ["Type", "Amount", "Category", "Note", "When", "Account"],
      (snap.transactions ?? []).map((t: Transaction) => [
        t.type,
        String(Math.round(t.amount)),
        t.category,
        t.note,
        when(t.at),
        t.account,
      ]),
    ),
    sheet(
      "Repeat paisa",
      ["Type", "Amount", "Note", "Time", "Enabled"],
      rec.map((r: RecurringSpend) => [
        r.type,
        String(Math.round(r.amount)),
        r.note,
        `${String(r.hour).padStart(2, "0")}:${String(r.minute).padStart(2, "0")}`,
        r.enabled ? "yes" : "no",
      ]),
    ),
    sheet(
      "Notes",
      ["Title", "Body", "Updated"],
      (snap.notes ?? []).map((n: Note) => [n.title, n.body, when(n.updatedAt)]),
    ),
    sheet(
      "Plans",
      ["Title", "When", "Cost"],
      (snap.plans ?? []).map((p: Plan) => [p.title, when(p.when ?? undefined), p.cost != null ? String(p.cost) : ""]),
    ),
    sheet(
      "Removed",
      ["Kind", "Title"],
      [
        ...(snap.trashTasks ?? []).map((t) => ["task", t.title]),
        ...(snap.trashTx ?? []).map((t) => ["paisa", `${t.note} ${t.amount}`]),
        ...(snap.trashNotes ?? []).map((n) => ["note", n.title]),
        ...(snap.trashPlans ?? []).map((p) => ["plan", p.title]),
      ],
    ),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.join("\n")}
</Workbook>`;
}

export function downloadExcel(snap: Snapshot) {
  const xmlDoc = buildExcelXml(snap);
  const blob = new Blob([xmlDoc], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sandeshdo-${monthKey()}.xls`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function printPdf() {
  window.print();
}
