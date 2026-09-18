import { createServerFn } from "@tanstack/react-start";
import { generateWithLlm } from "./llm";

export const proxyGemini = createServerFn({ method: "POST" })
  .validator((input: { key: string; prompt: string }) => input)
  .handler(async ({ data }) => generateWithLlm(data.key, data.prompt));
