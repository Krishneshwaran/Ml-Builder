export const SETTINGS_KEY = "AutoML_settings";

export type ImageBaseModel =
  | "custom-cnn"
  | "resnet18"
  | "mobilenet_v3_small"
  | "efficientnet_b0";

export interface AppSettings {
  orgName: string;
  orgEmail: string;
  rateLimiting: boolean;
  requireApiKey: boolean;
  enableLogging: boolean;
  notifyTraining: boolean;
  notifyDeployment: boolean;
  notifyUsage: boolean;
  imageBaseModel: ImageBaseModel;
  alwaysUseGpu: boolean;
  usePretrainedWeights: boolean;
  imageTrainingEpochs: number;
  useImageAugmentation: boolean;
  llmProvider: "ollama" | "openai-compatible" | "disabled";
  llmBaseUrl: string;
  llmModel: string;
  llmApiKey: string;
}

export const defaultSettings: AppSettings = {
  orgName: "AutoML Enterprise",
  orgEmail: "admin@AutoML.io",
  rateLimiting: true,
  requireApiKey: true,
  enableLogging: true,
  notifyTraining: true,
  notifyDeployment: true,
  notifyUsage: false,
  imageBaseModel: "resnet18",
  alwaysUseGpu: false,
  usePretrainedWeights: false,
  imageTrainingEpochs: 12,
  useImageAugmentation: true,
  llmProvider: "ollama",
  llmBaseUrl: "http://localhost:11434",
  llmModel: "deepseek-r1:8b",
  llmApiKey: "",
};

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const merged = { ...defaultSettings, ...JSON.parse(saved) };
      if (merged.llmModel === "deepseek-r1:1.5b") {
        merged.llmModel = defaultSettings.llmModel;
      }
      return merged;
    }
  } catch {}
  return defaultSettings;
}
