import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalibrationPoint, FitResult } from "../types";

const STORAGE_KEY = "@pyranometer_pro/calibration_points";

/**
 * Model: log10(irradiance) = a * EV100 + b
 * Illuminance/irradiance vs. EV is exponential, so fitting in log space
 * is a straight line — ordinary least squares gives a and b directly.
 * This is fit against YOUR paired readings from a real pyranometer,
 * rather than a generic textbook constant, so it corrects for this
 * specific phone's sensor/lens characteristics.
 */
export function fitCalibration(points: CalibrationPoint[]): FitResult | null {
  if (points.length < 2) return null;

  const xs = points.map((p) => p.ev100);
  const ys = points.map((p) => Math.log10(Math.max(p.referenceIrradiance, 0.001)));
  const n = xs.length;

  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
  const sumXX = xs.reduce((acc, x) => acc + x * x, 0);

  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return null;

  const a = (n * sumXY - sumX * sumY) / denom;
  const b = (sumY - a * sumX) / n;

  const meanY = sumY / n;
  const ssTot = ys.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const ssRes = xs.reduce((acc, x, i) => acc + (ys[i] - (a * x + b)) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  return {
    slope: a,
    intercept: b,
    rSquared: r2,
    minEv100: Math.min(...xs),
    maxEv100: Math.max(...xs)
  };
}

export function predictIrradiance(
  ev100: number,
  fit: FitResult
): { value: number; extrapolated: boolean } {
  const logIrradiance = fit.slope * ev100 + fit.intercept;
  const raw = Math.pow(10, logIrradiance);
  const clamped = Math.min(Math.max(raw, 0), 1500); // physical sanity bounds
  const extrapolated = ev100 < fit.minEv100 || ev100 > fit.maxEv100;
  return { value: clamped, extrapolated };
}

export async function loadCalibrationPoints(): Promise<CalibrationPoint[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CalibrationPoint[]) : [];
  } catch {
    return [];
  }
}

export async function saveCalibrationPoints(points: CalibrationPoint[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(points));
}
