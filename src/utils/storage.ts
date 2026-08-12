import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { IrradianceReading } from "../types";

const STORAGE_KEY = "@pyranometer_pro/readings_log";
const MAX_READINGS = 2000;

export async function loadReadings(): Promise<IrradianceReading[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IrradianceReading[]) : [];
  } catch {
    return [];
  }
}

export async function appendReading(
  existing: IrradianceReading[],
  reading: IrradianceReading
): Promise<IrradianceReading[]> {
  const next = [reading, ...existing].slice(0, MAX_READINGS);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export async function clearReadings(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function exportReadingsCSV(readings: IrradianceReading[]): Promise<void> {
  const header = "timestamp,ev100,irradiance_wm2,extrapolated\n";
  const rows = readings
    .map((r) => `${new Date(r.timestamp).toISOString()},${r.ev100},${r.irradianceWm2},${r.extrapolated}`)
    .join("\n");
  const csv = header + rows;

  const fileUri = FileSystem.documentDirectory + `pyranometer_export_${Date.now()}.csv`;
  await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export readings" });
  }
}
