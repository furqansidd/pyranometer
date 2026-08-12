import { requireNativeModule, EventEmitter, EventSubscription } from "expo-modules-core";

export type ExposureSample = {
  iso: number;
  exposureDurationSeconds: number;
  aperture: number; // f-number
  ev100: number;    // computed on the native side, ISO-100-referenced
  timestamp: number;
};

type CameraExposureModuleType = {
  start(): Promise<void>;
  stop(): Promise<void>;
};

let NativeModule: any = null;
let emitter: any = null;

try {
  NativeModule = requireNativeModule<CameraExposureModuleType>("CameraExposure");
  // In SDK 52+, the native module is itself an EventEmitter
  emitter = NativeModule;
} catch (e) {
  console.warn("Native CameraExposure module not found. Falling back to mock implementation for Expo Go testing.");
}

// Mock exposure state for testing inside Expo Go
let mockInterval: any = null;
const mockListeners = new Set<(sample: ExposureSample) => void>();

export async function startExposureMonitoring(): Promise<void> {
  if (NativeModule) {
    return NativeModule.start();
  }
  
  if (mockInterval) {
    clearInterval(mockInterval);
  }
  
  mockInterval = setInterval(() => {
    // Generate realistic fluctuating solar irradiance exposure values (EV100 ~ 6 to 14)
    const baseEv100 = 10.0;
    const timeFactor = Math.sin(Date.now() / 5000) * 4; // fluctuates over 5 seconds
    const ev100 = parseFloat((baseEv100 + timeFactor + (Math.random() - 0.5) * 0.5).toFixed(2));
    
    const aperture = 2.8;
    const iso = 100;
    // Calculate shutter speed equivalent for this EV100
    // EV100 = log2( aperture^2 / (duration * (iso/100)) )
    // duration = aperture^2 / (2^EV100 * (iso/100))
    const duration = Math.max(0.0001, Math.min(1.0, Math.pow(aperture, 2) / Math.pow(2, ev100)));
    
    const sample: ExposureSample = {
      iso,
      exposureDurationSeconds: duration,
      aperture,
      ev100,
      timestamp: Date.now()
    };
    
    mockListeners.forEach(listener => listener(sample));
  }, 1000);
}

export async function stopExposureMonitoring(): Promise<void> {
  if (NativeModule) {
    return NativeModule.stop();
  }
  if (mockInterval) {
    clearInterval(mockInterval);
    mockInterval = null;
  }
}

export function addExposureListener(
  listener: (sample: ExposureSample) => void
): EventSubscription {
  if (emitter && typeof emitter.addListener === "function") {
    return emitter.addListener("onExposureChange", listener);
  }
  
  mockListeners.add(listener);
  return {
    remove: () => {
      mockListeners.delete(listener);
    }
  };
}


