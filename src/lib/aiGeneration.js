import { firebaseApi } from "@/api/firebaseClient";

export const SUBJECTS = ["PSAD", "MSTE", "HGE"];

export async function generateWithGemini({
  prompt,
  schema,
  signal,
  onProgress,
}) {
  let lastError;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      onProgress?.(
        attempt === 1 ? "Generating with Gemini…" : "Retrying Gemini once…",
      );
      return await firebaseApi.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
        timeoutMs: 120000,
        signal,
      });
    } catch (error) {
      if (error?.name === "AbortError")
        throw new Error("Generation cancelled.");
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export function generatedArray(response, key) {
  const value = response?.[key];
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object")
    return Object.values(value).filter(
      (item) => item && typeof item === "object",
    );
  console.error("[Gemini] Invalid generation response", { key, response });
  throw new Error(
    `Gemini returned an invalid ${key} collection. Expected an array.`,
  );
}

const string = { type: "string" };
export const flashcardSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: string,
          topic: string,
          question: string,
          answer: string,
          explanation: string,
          solution: string,
          remarks: string,
          questionSource: string,
          tags: { type: "array", items: string },
          difficulty: string,
        },
      },
    },
  },
};
export const questionSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: string,
          topic: string,
          question: string,
          choices: { type: "array", items: string },
          correctAnswer: string,
          explanation: string,
          difficulty: string,
          tags: { type: "array", items: string },
          situationTitle: string,
          situationDescription: string,
          imageUrl: string,
          figureLabel: string,
        },
      },
    },
  },
};
export const formulaSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          subject: string,
          folder: string,
          subFolder: string,
          name: string,
          formula: string,
          description: string,
          references: string,
          tags: { type: "array", items: string },
          difficulty: string,
          figureUrl: string,
          imageUrl: string,
          variableSymbol1: string,
          variableMeaning1: string,
          variableUnit1: string,
          variableSymbol2: string,
          variableMeaning2: string,
          variableUnit2: string,
          variableSymbol3: string,
          variableMeaning3: string,
          variableUnit3: string,
          variableSymbol4: string,
          variableMeaning4: string,
          variableUnit4: string,
          variableSymbol5: string,
          variableMeaning5: string,
          variableUnit5: string,
        },
      },
    },
  },
};
