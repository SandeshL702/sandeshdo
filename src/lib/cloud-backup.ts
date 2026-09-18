import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

export const pushCloudBackup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { payload: string }) => input)
  .handler(async ({ data, context }) => {
    const payload = data.payload;
    if (!payload || payload.length < 8 || payload.length > 4_000_000) {
      return { ok: false as const, error: "bad payload" };
    }
    const sql = await getSql();
    await sql`
      insert into sandesh_cloud (user_id, payload, updated_at)
      values (${context.userId}, ${payload}, now())
      on conflict (user_id) do update
      set payload = excluded.payload, updated_at = now()
    `;
    return { ok: true as const };
  });

export const pullCloudBackup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const rows = await sql<{ payload: string }>`
      select payload from sandesh_cloud where user_id = ${context.userId} limit 1
    `;
    return { payload: rows[0]?.payload ?? null };
  });
