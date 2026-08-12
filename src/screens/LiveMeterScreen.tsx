import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView } from "react-native";
import GaugeView from "../components/Gauge";
import { useMeter } from "../context/MeterContext";
import { loadReadings, appendReading } from "../utils/storage";
import { IrradianceReading } from "../types";

export default function LiveMeterScreen() {
  const {
    ev100,
    iso,
    exposureDurationSeconds,
    aperture,
    isMonitoring,
    permissionDenied,
    startMonitoring,
    stopMonitoring,
    fit,
    currentEstimate
  } = useMeter();

  const [logging, setLogging] = useState(false);
  const readingsRef = useRef<IrradianceReading[]>([]);

  useEffect(() => {
    startMonitoring();
    loadReadings().then((r) => (readingsRef.current = r));
    return () => {
      stopMonitoring();
    };
  }, []);

  useEffect(() => {
    if (!logging || !currentEstimate) return;
    const interval = setInterval(async () => {
      const reading: IrradianceReading = {
        id: `${Date.now()}`,
        timestamp: Date.now(),
        ev100,
        irradianceWm2: currentEstimate.value,
        extrapolated: currentEstimate.extrapolated
      };
      readingsRef.current = await appendReading(readingsRef.current, reading);
    }, 5000);
    return () => clearInterval(interval);
  }, [logging, currentEstimate, ev100]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Live Meter</Text>

        {permissionDenied && (
          <Text style={styles.error}>
            Camera permission was denied. Enable it in system settings to take readings.
          </Text>
        )}

        {!fit && (
          <Text style={styles.notice}>
            Using default approximation. Add at least 2 calibration points in the Calibrate tab for actual accuracy.
          </Text>
        )}

        <GaugeView
          value={currentEstimate?.value ?? 0}
          extrapolated={currentEstimate?.extrapolated}
        />

        <View style={styles.telemetry}>
          <Row label="EV100" value={ev100.toFixed(2)} />
          <Row label="ISO" value={iso.toFixed(0)} />
          <Row label="Shutter" value={`1/${(1 / Math.max(exposureDurationSeconds, 1e-6)).toFixed(0)}s`} />
          <Row label="Aperture" value={`f/${aperture.toFixed(1)}`} />
          {fit && <Row label="Fit R²" value={fit.rSquared.toFixed(3)} />}
        </View>

        <Pressable
          style={[styles.button, logging ? styles.buttonStop : styles.buttonStart]}
          onPress={() => setLogging((v) => !v)}
        >
          <Text style={styles.buttonText}>{logging ? "Stop Logging" : "Start Logging (every 5s)"}</Text>
        </Pressable>

        <Text style={styles.status}>{isMonitoring ? "Camera active" : "Camera inactive"}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { alignItems: "center", padding: 20, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: "700", color: "#FFFFFF", marginBottom: 12 },
  error: { color: "#EF4444", textAlign: "center", marginBottom: 12 },
  notice: { color: "#F59E0B", textAlign: "center", marginBottom: 16, fontSize: 13 },
  telemetry: { width: "100%", marginTop: 24, backgroundColor: "#141B2D", borderRadius: 12, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  rowLabel: { color: "#94A3B8", fontSize: 14 },
  rowValue: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  button: { marginTop: 24, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: "100%" },
  buttonStart: { backgroundColor: "#F59E0B" },
  buttonStop: { backgroundColor: "#EF4444" },
  buttonText: { color: "#0B0F1A", fontWeight: "700", textAlign: "center", fontSize: 15 },
  status: { color: "#64748B", marginTop: 16, fontSize: 12 }
});
