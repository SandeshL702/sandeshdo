import assert from "node:assert/strict";
import { test } from "node:test";
import { parseMoney, parseNaturalLanguage } from "./parser.ts";

/** Wednesday 16 Sep 2026, 21:49 local */
const NOW = new Date(2026, 8, 16, 21, 49, 0).getTime();

function at(y: number, m: number, d: number, h: number, min: number) {
  return new Date(y, m, d, h, min, 0, 0).getTime();
}

test("Call Rahul at 7 PM rolls to tomorrow when 7 PM has passed", () => {
  const p = parseNaturalLanguage("Call Rahul at 7 PM", NOW);
  assert.equal(p.title, "Call Rahul");
  assert.equal(p.dueAt, at(2026, 8, 17, 19, 0));
  assert.equal(p.confidence, "medium");
});

test("Pay electricity bill tomorrow at 10 AM", () => {
  const p = parseNaturalLanguage("Pay electricity bill tomorrow at 10 AM", NOW);
  assert.equal(p.title, "Pay electricity bill");
  assert.equal(p.dueAt, at(2026, 8, 17, 10, 0));
  assert.equal(p.confidence, "high");
  assert.equal(p.dateLabel, "Tomorrow");
});

test("Submit report Friday 6 PM", () => {
  const p = parseNaturalLanguage("Submit report Friday 6 PM", NOW);
  assert.equal(p.title, "Submit report");
  assert.equal(p.dueAt, at(2026, 8, 18, 18, 0));
  assert.equal(p.confidence, "high");
});

test("Study Python every day at 8 PM", () => {
  const p = parseNaturalLanguage("Study Python every day at 8 PM", NOW);
  assert.equal(p.title, "Study Python");
  assert.equal(p.recurrence?.kind, "daily");
  assert.equal(p.dueAt, at(2026, 8, 17, 20, 0));
  assert.equal(p.confidence, "high");
});

test("Call client every Monday at 10 AM", () => {
  const p = parseNaturalLanguage("Call client every Monday at 10 AM", NOW);
  assert.equal(p.title, "Call client");
  assert.equal(p.recurrence?.kind, "weekly");
  assert.deepEqual(p.recurrence?.days, [1]);
  assert.equal(p.dueAt, at(2026, 8, 21, 10, 0));
  assert.equal(p.confidence, "high");
});

test("remind me prefix is stripped", () => {
  const p = parseNaturalLanguage("Remind me to call Rahul tomorrow at 7 PM", NOW);
  assert.equal(p.title, "call Rahul");
  assert.equal(p.dueAt, at(2026, 8, 17, 19, 0));
});

test("bare title stays inbox", () => {
  const p = parseNaturalLanguage("Buy milk", NOW);
  assert.equal(p.title, "Buy milk");
  assert.equal(p.dueAt, null);
  assert.equal(p.confidence, "low");
});

test("relative time", () => {
  const p = parseNaturalLanguage("Call dentist in 20 minutes", NOW);
  assert.equal(p.title, "Call dentist");
  assert.equal(p.dueAt, NOW + 20 * 60_000);
});

test("duration is not treated as due time", () => {
  const p = parseNaturalLanguage("Study Python for 45 minutes tomorrow at 8 PM", NOW);
  assert.equal(p.title, "Study Python");
  assert.equal(p.estimatedDuration, 45);
  assert.equal(p.dueAt, at(2026, 8, 17, 20, 0));
});

test("spent 250 lunch is money", () => {
  const m = parseMoney("spent 250 lunch");
  assert.ok(m);
  assert.equal(m.amount, 250);
  assert.equal(m.type, "expense");
  assert.equal(m.category, "food");
});

test("got 15000 salary is income", () => {
  const m = parseMoney("got 15000 salary");
  assert.ok(m);
  assert.equal(m.amount, 15000);
  assert.equal(m.type, "income");
});

test("hinglish kal 5 baje sets a deadline", () => {
  const p = parseNaturalLanguage("kal 5 baje dentist", NOW);
  assert.match(p.title.toLowerCase(), /dentist/);
  assert.ok(p.dueAt);
  const d = new Date(p.dueAt);
  assert.equal(d.getDate(), 17);
  assert.equal(d.getHours(), 17);
});

test("hinglish yaad rakh prefix", () => {
  const p = parseNaturalLanguage("yaad rakh bill bharna aaj", NOW);
  assert.match(p.title.toLowerCase(), /bill/);
});
