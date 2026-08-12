# Pyranometer Pro (Expo / React Native)

A camera-based solar irradiance meter. It reads the phone's live auto-exposure
state (ISO, shutter speed, aperture) via the *same native camera APIs* a
native Swift or Kotlin app would use, converts that into EV100, and maps
EV100 → W/m² using a regression fit against **your own paired readings from
a real pyranometer**. Accuracy is bounded by how well you calibrate it, not
by a guessed textbook constant.

## Why a native module, not Expo Go

`expo-camera` doesn't expose live ISO/shutter/aperture. This project adds a
small local native module (`modules/camera-exposure`) — Swift on iOS,
Kotlin on Android — that reads those values directly from AVFoundation /
Camera2, same as a fully-native app would. Because of that native code,
**this app will not run inside the plain Expo Go app** — it needs a custom
dev client, which EAS Build produces for you.

## Building on Windows

You never need a physical Mac. Everything below runs on Windows; the iOS
compile step happens on Expo's cloud build machines.

```bash
npm install -g eas-cli
npm install
eas login
eas build:configure

# Android — fully testable on Windows via emulator or a USB-connected phone
eas build --platform android --profile development

# iOS — compiled in Expo's cloud, installed via a link/QR to a real iPhone
eas build --platform ios --profile development
```

Requirements for the iOS build specifically:
- A free or paid Apple Developer account (paid, $99/yr, is required to
  install on your own device or distribute beyond 7-day free provisioning).
- `eas build` will prompt you to let it manage credentials automatically —
  say yes, it handles certificates/provisioning without a local Mac.
- A physical iPhone to test on — the iOS Simulator has no camera, so you
  cannot validate irradiance readings on it.

Once a development build is installed on your phone:

```bash
npx expo start --dev-client
```

and scan the QR code from the same Wi-Fi network to iterate on JS changes
without rebuilding.

## Calibration protocol (do this before trusting any reading)

1. Open the **Calibrate** tab next to your reference pyranometer, both
   pointed at the same patch of sky/surface.
2. At the same moment your pyranometer reads N W/m², type N in and tap
   **Add Point**.
3. Repeat across a spread of conditions: shade, overcast, hazy sun, and
   full clear-sky sun. 5–10 points spread across the full range you'll
   actually use the app in matters far more than dozens of points
   clustered at one brightness.
4. Watch **R²** in the Calibrate tab. Below ~0.9 means the fit is noisy —
   readings were probably taken too close together in light level, or
   there was a large delay between your reading and the pyranometer's.
5. The gauge flags readings taken **outside** your calibrated EV100 range
   as extrapolated (greyed needle, warning label) — treat those as
   unreliable until you add calibration points that bracket that range.

## Known accuracy limits, even after calibration

- Camera lens transmission, IR/UV filtering, and sensor spectral response
  don't match a thermopile pyranometer's flat spectral response — the fit
  corrects for average behavior, not the exact spectral mismatch under
  every sky condition (e.g. it may drift slightly between clear-sky and
  heavily overcast light, since the spectral composition differs).
- Auto-exposure metering region (center-weighted vs. matrix) affects what
  the ISO/shutter combo actually responds to — try to keep the sun/sky
  target roughly centered in frame when taking readings.
- Recalibrate if you change phones, get a software update that changes
  the camera's ISP behavior, or notice drift against your reference
  instrument over time.

## Project structure

```
App.tsx                         navigation root
src/
  types.ts                      shared TS types
  context/MeterContext.tsx      wraps native module + calibration engine
  utils/calibration.ts          log-linear regression fit (same model iOS/Android)
  utils/storage.ts              reading log + CSV export
  components/Gauge.tsx          SVG radial gauge
  screens/
    LiveMeterScreen.tsx
    CalibrationScreen.tsx
    HistoryScreen.tsx
modules/camera-exposure/        local native module
  index.ts                      JS bridge
  ios/CameraExposureModule.swift
  android/.../CameraExposureModule.kt
```
