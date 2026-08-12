import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Pyranometer Pro",
  slug: "pyranometer-pro",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  scheme: "pyranometerpro",
  // This project uses a local native module (modules/camera-exposure),
  // which requires a custom dev client / EAS Build — it will NOT run
  // inside the plain "Expo Go" app.
  plugins: [],
  ios: {
    bundleIdentifier: "com.yourcompany.pyranometerpro",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription:
        "Pyranometer Pro reads live camera exposure metadata (ISO, shutter speed, aperture) to estimate solar irradiance. No photos or video are captured or stored."
    }
  },
  android: {
    package: "com.yourcompany.pyranometerpro",
    permissions: ["android.permission.CAMERA"]
  },
  extra: {
    eas: {
      projectId: "a1d7a2fe-32c5-48b6-ba90-5c799f05e606"
    }
  }
});

