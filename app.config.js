const fs = require("node:fs");

module.exports = ({ config }) => {
  // EAS permite subir google-services.json como variable de tipo archivo.
  // No se inventa un proyecto Firebase ni se incluyen claves del servidor.
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  if (googleServicesFile && !fs.existsSync(googleServicesFile)) {
    throw new Error("GOOGLE_SERVICES_JSON debe apuntar a un google-services.json existente.");
  }
  const androidBuild = process.env.EAS_BUILD_PLATFORM === "android";
  if (androidBuild && process.env.EXPO_PUBLIC_NOTIFICATIONS_API_URL && !googleServicesFile) {
    throw new Error("Push está habilitado pero falta GOOGLE_SERVICES_JSON para registrar Android con FCM.");
  }
  return { ...config, android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) } };
};
