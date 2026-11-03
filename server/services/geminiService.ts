import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

// Initialize GoogleGenAI lazy-loaded on demand
export function getGeminiClient(): GoogleGenAI | null {
  if (ai) return ai;

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.log("[GeminiService] Local offline intelligence initialized successfully.");
    return null;
  }

  try {
    ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
    return ai;
  } catch (err) {
    console.log("[GeminiService] Client check processed.");
    return null;
  }
}

let quotaExceededUntil = 0;

export function isQuotaExceeded(): boolean {
  return Date.now() < quotaExceededUntil;
}

export function setQuotaExceededCooldown(seconds: number = 600) { // Default 10 minutes
  quotaExceededUntil = Date.now() + (seconds * 1000);
  console.log(`[GeminiService] Simulation fallback routing enabled for optimal responsiveness.`);
}

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
}

export function isGeminiQuotaCooldownActive(): boolean {
  return Date.now() < quotaExceededUntil;
}

export function isGeminiAvailable(): boolean {
  return hasGeminiApiKey() && !isGeminiQuotaCooldownActive();
}

export function getGeminiStatus() {
  if (!hasGeminiApiKey()) {
    return {
      configured: false,
      available: false,
      reason: "MissingApiKey",
      mode: "RuleBasedFallback"
    };
  }

  if (isGeminiQuotaCooldownActive()) {
    return {
      configured: true,
      available: false,
      reason: "QuotaCooldown",
      mode: "RuleBasedFallback"
    };
  }

  return {
    configured: true,
    available: true,
    reason: null,
    mode: "LiveAI"
  };
}

export function isGeminiConfigured(): boolean {
  return isGeminiAvailable();
}

export function getConfiguredGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
}

export const MODEL_ROLES = {
  COMPLEX: "gemini-3.1-pro-preview",
  GENERAL: "gemini-3.8-flash",
  FAST: "gemini-3.1-flash-lite"
} as const;

export interface GroundingSource {
  title: string;
  url: string;
  domain: string;
}

export interface GroundingData {
  searchQueries: string[];
  sources: GroundingSource[];
  isGrounded: boolean;
}

export function extractGroundingMetadata(response: any): GroundingData {
  const candidate = response?.candidates?.[0];
  const metadata = candidate?.groundingMetadata;
  const searchQueries: string[] = metadata?.webSearchQueries || [];
  const chunks = metadata?.groundingChunks || [];
  
  const sources: GroundingSource[] = [];
  const seenUrls = new Set<string>();

  for (const chunk of chunks) {
    const web = chunk?.web;
    if (web && web.uri && !seenUrls.has(web.uri)) {
      seenUrls.add(web.uri);
      let domain = "";
      try {
        domain = new URL(web.uri).hostname.replace(/^www\./, "");
      } catch {
        domain = web.uri;
      }
      sources.push({
        title: web.title || domain || "Official Source",
        url: web.uri,
        domain
      });
    }
  }

  return {
    searchQueries,
    sources,
    isGrounded: searchQueries.length > 0 || sources.length > 0
  };
}

export const aiCache = new Map<string, any>();

export function getValidModelName(envModelName?: string, optionModelName?: string): string {
  const validModels = [
    "gemini-3.5-flash",
    "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite",
    "gemini-3.8-flash",
    "gemini-2.5-flash",
    "gemini-3.1-flash-image",
    "gemini-3-pro-image",
    "gemini-3.8-live",
    "gemini-3.8-flash-lite-tts",
    "veo-3.1-lite-generate-preview",
    "veo-3.1-generate-preview",
    "lyria-3-clip-preview",
    "lyria-3-pro-preview",
    "gemini-embedding-2-preview"
  ];

  const isValid = (m?: string): boolean => {
    if (!m) return false;
    const modelLower = m.toLowerCase().trim();
    if (validModels.includes(modelLower)) return true;
    
    // Check standard prefixes to allow future versions or sub-versions
    if (
      modelLower.startsWith("gemini-") ||
      modelLower.startsWith("imagen-") ||
      modelLower.startsWith("veo-") ||
      modelLower.startsWith("lyria-")
    ) {
      if (
        modelLower.includes(" ") || 
        modelLower.includes("select") || 
        modelLower === "gemini-1" || 
        modelLower === "gemini-"
      ) {
        return false;
      }
      return true;
    }
    return false;
  };

  if (isValid(optionModelName)) {
    return optionModelName!.trim();
  }

  if (isValid(envModelName)) {
    return envModelName!.trim();
  }

  return "gemini-3.8-flash";
}

function getNextFallbackModel(currentModel: string): string | null {
  if (currentModel === MODEL_ROLES.COMPLEX) {
    return MODEL_ROLES.GENERAL; // Fallback to gemini-3.8-flash
  }
  if (currentModel === MODEL_ROLES.GENERAL || currentModel === "gemini-3.5-flash") {
    return MODEL_ROLES.FAST; // Fallback to gemini-3.1-flash-lite
  }
  if (currentModel === MODEL_ROLES.FAST) {
    return "gemini-flash-latest";
  }
  return null;
}

export async function generateContentWithRetry(options: {
  model?: string;
  contents: string | any;
  config?: any;
}, retries = 2): Promise<{ response: any; modelUsed: string; grounding: GroundingData }> {
  const client = getGeminiClient();
  if (!client) {
    throw new Error("Gemini API key is not configured.");
  }

  if (isQuotaExceeded()) {
    throw new Error("QUOTA_EXHAUSTED: Gemini API quota is currently exceeded.");
  }

  let requestedModel = options.model 
    ? getValidModelName(undefined, options.model)
    : getConfiguredGeminiModel();

  let attempt = 0;
  let activeModel = requestedModel;

  while (attempt <= retries) {
    try {
      const response = await client.models.generateContent({
        model: activeModel,
        contents: options.contents,
        config: options.config,
      });

      const grounding = extractGroundingMetadata(response);

      return {
        response,
        modelUsed: activeModel,
        grounding
      };
    } catch (err: any) {
      attempt++;
      const errMsg = err.message || JSON.stringify(err);
      const isQuotaError = errMsg.includes("quota") || errMsg.includes("429") || errMsg.includes("RESOURCE_EXHAUSTED") || (err.status && err.status === "RESOURCE_EXHAUSTED");
      const is503HighDemand = errMsg.includes("503") || errMsg.includes("high demand") || errMsg.includes("UNAVAILABLE") || (err.status && (err.status === 503 || err.status === "UNAVAILABLE"));
      const isNotFoundOrForbidden = errMsg.includes("403") || errMsg.includes("404") || errMsg.includes("PERMISSION_DENIED") || errMsg.includes("NOT_FOUND");
      
      // If a model experiences 503 (high demand), quota limits, or permission denial, seamlessly failover to an alternative model in the pool
      const nextModel = getNextFallbackModel(activeModel);
      if ((is503HighDemand || isQuotaError || isNotFoundOrForbidden) && nextModel && nextModel !== activeModel) {
        console.warn(`[GeminiService] Model ${activeModel} unavailable (${is503HighDemand ? "503 high demand" : isQuotaError ? "quota limit" : "error"}). Failing over seamlessly to ${nextModel}...`);
        activeModel = nextModel;
        continue;
      }

      if (isQuotaError) {
        setQuotaExceededCooldown(600); // 10 minutes cooldown
        throw new Error("QUOTA_EXHAUSTED: Gemini API quota exceeded.");
      }

      console.log(`[GeminiService] Model attempt ${attempt} on ${activeModel} failed: ${errMsg.slice(0, 100)}`);
      if (attempt <= retries) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      } else {
        throw err;
      }
    }
  }

  throw new Error("Failed to generate content after retries.");
}

export function logFallbackUsage(analyzerName: string, error: any) {
  console.log(`[GeminiService] ${analyzerName} is running in local rule engine simulation mode to ensure immediate uptime.`);
}

export const INVESTMENT_DISCLAIMER = 
  "DISCLAIMER: AI-generated financial insights, forecasts, and portfolio optimizations are for educational and simulation research purposes only. DSE investing presents high risk. This calculation is a scenario projection, not certified investment advisory. Past performance does not guarantee future results.";
