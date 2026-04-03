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
  llmModel: "deepseek-r1:1.5b",
  llmApiKey: "",
};

export function loadSettings(): AppSettings {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      return { ...defaultSettings, ...JSON.parse(saved) };
    }
  } catch {}
  return defaultSettings;
}
