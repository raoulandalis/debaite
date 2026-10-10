export const DEBATER_MODELS = ["mistral:7b", "qwen2.5:7b", "llama3.1:8b"] as const;

export const JUDGE_MODEL = "gemma2:9b";

export type DebaterModel = (typeof DEBATER_MODELS)[number];

export function isDebaterModel(name: string): name is DebaterModel {
  return (DEBATER_MODELS as readonly string[]).includes(name);
}

export function validateModelChoice(input: {
  debaterAModel: string;
  debaterBModel: string;
  judgeModel: string;
}): { ok: true } | { ok: false; code: "INVALID_INPUT"; message: string } {
  if (
    !isDebaterModel(input.debaterAModel) ||
    !isDebaterModel(input.debaterBModel) ||
    input.debaterAModel === input.debaterBModel
  ) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "Choose two different models from the debater list.",
    };
  }
  if (input.judgeModel !== JUDGE_MODEL) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "The judge model must be gemma2:9b.",
    };
  }
  return { ok: true };
}
