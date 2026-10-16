import {
  createAiModel,
  extractJsonObject,
  getAiModelChain,
} from "@data-projects/shared/ai-provider";
import type { LanguageModel } from "ai";
import { env } from "./env";

export { createAiModel, extractJsonObject, getAiModelChain };

export function getModel(): LanguageModel {
  return createAiModel(env);
}
