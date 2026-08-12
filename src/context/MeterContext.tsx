import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  addExposureListener,
  startExposureMonitoring,
  stopExposureMonitoring,
  ExposureSample
} from "../../modules/camera-exposure";
import { CalibrationPoint, FitResult } from "../types";
import { fitCalibration, loadCalibrationPoints, saveCalibrationPoints, predictIrradiance } from "../utils/calibration";

type MeterContextValue = {
  // live camera state
  ev100: number;
  iso: number;
  exposureDurationSeconds: number;
  aperture: number;
  isMonitoring: boolean;
  permissionDenied: boolean;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => Promise<void>;

  // calibration
  points: CalibrationPoint[];
  fit: FitResult | null;
  addCalibrationPoint: (referenceIrradiance: number, note?: string) => Promise<void>;
  removeCalibrationPoint: (id: string) => Promise<void>;
  clearCalibrationPoints: () => Promise<void>;

  // derived live reading
  currentEstimate: { value: number; extrapolated: boolean } | null;
};

const MeterContext = createContext<MeterContextValue | null>(null);

export function MeterProvider({ children }: { children: React.ReactNode }) {
  const [ev100, setEv100] = useState(0);
  const [iso, setIso] = useState(0);
  const [exposureDurationSeconds, setExposureDurationSeconds] = useState(0);
  const [aperture, setAperture] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [points, setPoints] = useState<CalibrationPoint[]>([]);
  const [fit, setFit] = useState<FitResult | null>(null);

  const subRef = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    loadCalibrationPoints().then((loaded) => {
      setPoints(loaded);
      setFit(fitCalibration(loaded));
    });
  }, []);

  const startMonitoring = useCallback(async () => {
    try {
      subRef.current?.remove();
      subRef.current = addExposureListener((sample: ExposureSample) => {
        setEv100(sample.ev100);
        setIso(sample.iso);
        setExposureDurationSeconds(sample.exposureDurationSeconds);
        setAperture(sample.aperture);
      });
      await startExposureMonitoring();
      setIsMonitoring(true);
      setPermissionDenied(false);
    } catch (e: any) {
      if (e?.code === "PERMISSION_DENIED") {
        setPermissionDenied(true);
      }
      console.warn("startMonitoring failed", e);
    }
  }, []);

  const stopMonitoring = useCallback(async () => {
    subRef.current?.remove();
    subRef.current = null;
    await stopExposureMonitoring();
    setIsMonitoring(false);
  }, []);

  const persistAndRefit = useCallback(async (next: CalibrationPoint[]) => {
    setPoints(next);
    setFit(fitCalibration(next));
    await saveCalibrationPoints(next);
  }, []);

  const addCalibrationPoint = useCallback(
    async (referenceIrradiance: number, note?: string) => {
      if (referenceIrradiance <= 0) return;
      const point: CalibrationPoint = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ev100,
        referenceIrradiance,
        timestamp: Date.now(),
        note
      };
      await persistAndRefit([...points, point]);
    },
    [ev100, points, persistAndRefit]
  );

  const removeCalibrationPoint = useCallback(
    async (id: string) => {
      await persistAndRefit(points.filter((p) => p.id !== id));
    },
    [points, persistAndRefit]
  );

  const clearCalibrationPoints = useCallback(async () => {
    await persistAndRefit([]);
  }, [persistAndRefit]);

  const currentEstimate = fit
    ? predictIrradiance(ev100, fit)
    : {
        value: Math.min(1200, Math.max(0, 0.0208 * Math.pow(2, ev100))),
        extrapolated: false
      };

  return (
    <MeterContext.Provider
      value={{
        ev100,
        iso,
        exposureDurationSeconds,
        aperture,
        isMonitoring,
        permissionDenied,
        startMonitoring,
        stopMonitoring,
        points,
        fit,
        addCalibrationPoint,
        removeCalibrationPoint,
        clearCalibrationPoints,
        currentEstimate
      }}
    >
      {children}
    </MeterContext.Provider>
  );
}

export function useMeter(): MeterContextValue {
  const ctx = useContext(MeterContext);
  if (!ctx) throw new Error("useMeter must be used within MeterProvider");
  return ctx;
}
