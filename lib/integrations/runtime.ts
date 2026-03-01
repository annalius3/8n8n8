export type IntegrationMode = "real" | "connection_required" | "missing";

export type IntegrationModes = {
  openai: IntegrationMode;
  leonardo: IntegrationMode;
  pinterest: IntegrationMode;
  r2: IntegrationMode;
};

export function getIntegrationModes(): IntegrationModes {
  return {
    openai: process.env.OPENAI_API_KEY ? "real" : "missing",
    leonardo: process.env.LEONARDO_API_KEY ? "real" : "missing",
    pinterest: "connection_required",
    r2:
      process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET
        ? "real"
        : "missing"
  };
}

export function getIntegrationModeLabel(mode: IntegrationMode) {
  if (mode === "real") return "Real API";
  if (mode === "connection_required") return "Token required";
  return "Not configured";
}

