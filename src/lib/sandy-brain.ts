import { createServerFn } from "@tanstack/react-start";
import { runSandyGrok, type SandyAsk } from "./sandy-grok";

export const askSandyBrain = createServerFn({ method: "POST" })
  .validator((input: SandyAsk) => input)
  .handler(async ({ data }) => runSandyGrok(data));
