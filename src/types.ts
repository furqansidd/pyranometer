export type CalibrationPoint = {
  id: string;
  ev100: number;
  referenceIrradiance: number; // W/m², from your reference pyranometer
  timestamp: number;
  note?: string;
};

export type IrradianceReading = {
  id: string;
  timestamp: number;
  ev100: number;
  irradianceWm2: number;
  extrapolated: boolean;
};

export type FitResult = {
  slope: number;
  intercept: number;
  rSquared: number;
  minEv100: number;
  maxEv100: number;
};
