export type IntegrationMode = "real" | "demo";

export type IntegrationModes = {
  openai: IntegrationMode;
  leonardo: IntegrationMode;
  pinterest: IntegrationMode;
  r2: IntegrationMode;
};

export function getIntegrationModes(): IntegrationModes {
  return {
    openai: process.env.OPENAI_API_KEY ? "real" : "demo",
    leonardo: process.env.LEONARDO_API_KEY ? "real" : "demo",
    pinterest: "demo",
    r2: process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET
      ? "real"
      : "demo"
  };
}

export function getIntegrationModeLabel(mode: IntegrationMode) {
  return mode === "real" ? "Реальный API" : "Demo режим";
}
