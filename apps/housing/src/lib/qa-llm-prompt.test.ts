import { describe, expect, it } from "vitest";
import { buildQaLlmPrompt, redactAdvertiserContact } from "@/lib/qa-llm-prompt";
import type { PropertyQuestionSnapshot } from "@/types/housing";

// NOT VALID — test data only (fake advertiser contact).
const fakeAdvertiser = {
  name: "Imobiliária Fake Teste",
  creci: "MG-00000",
  phone: "(31) 3000-0000",
  whatsapp: "+55 31 90000-1234",
};

const snapshot: PropertyQuestionSnapshot = {
  title: "Apartamento 2 quartos",
  neighborhood: "Lourdes",
  cityCode: "BH",
  street: "Rua Exemplo",
  streetNumber: null,
  condominiumName: null,
  totalMonthly: 4200,
  rent: 3000,
  condoFee: 1000,
  iptu: 200,
  areaM2: 70,
  bedrooms: 2,
  bathrooms: 2,
  parkingSpaces: 1,
  floor: 7,
  floorLabel: null,
  furnished: false,
  modernityScore: 80,
  finalScore: 8.5,
  overallRank: 3,
  url: "https://www.quintoandar.com.br/imovel/000000000",
  shortJustification: "Bom custo-benefício.",
  description:
    "Ótimo apê. Fale com Imobiliária Fake Teste pelo WhatsApp 31 900001234 ou ligue (31) 3000-0000.",
};

describe("buildQaLlmPrompt", () => {
  it("never includes the advertiser name, phone or WhatsApp", () => {
    const { systemPrompt, userPrompt } = buildQaLlmPrompt({
      question: "Qual o telefone do anunciante?",
      propertyKey: "quintoandar:000000000",
      snapshot,
      evaluated: null,
      rawSpecs: { area_m2: 70 },
      advertiser: fakeAdvertiser,
      topEvaluated: [],
    });
    const prompt = `${systemPrompt}\n${userPrompt}`;
    expect(prompt.toLowerCase()).not.toContain(fakeAdvertiser.name.toLowerCase());
    expect(prompt).not.toContain("rawAdvertiser");
    expect(prompt).not.toContain(fakeAdvertiser.creci);
    expect(prompt).not.toMatch(/3000[\s.-]*0000/);
    expect(prompt).not.toMatch(/0000[\s.-]*1234/);
    expect(prompt).toContain("Rua Exemplo");
    expect(prompt).toContain("Ótimo apê");
  });

  it("leaves text alone when there's no advertiser", () => {
    expect(redactAdvertiserContact("Ligue 31 3000-0000", null)).toBe("Ligue 31 3000-0000");
  });
});
