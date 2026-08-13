import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, SafeAreaView } from "react-native";
import GaugeView from "../components/Gauge";
import { useMeter } from "../context/MeterContext";
import { loadReadings, appendReading } from "../utils/storage";
import { predictIrradiance } from "../utils/calibration";
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

  const [countdown, setCountdown] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [saved, setSaved] = useState(false);

  const [finalEstimate, setFinalEstimate] = useState<{ value: number; extrapolated: boolean } | null>(null);
  const [finalTelemetry, setFinalTelemetry] = useState<{
    ev100: number;
    iso: number;
    exposureDurationSeconds: number;
    aperture: number;
  } | null>(null);

  const readingsRef = useRef<IrradianceReading[]>([]);
  const samplesRef = useRef<number[]>([]);

  // Keep refs updated to avoid stale closures in the timer loop
  const ev100Ref = useRef(ev100);
  const fitRef = useRef(fit);
  const isoRef = useRef(iso);
  const exposureDurationSecondsRef = useRef(exposureDurationSeconds);
  const apertureRef = useRef(aperture);

  useEffect(() => { ev100Ref.current = ev100; }, [ev100]);
  useEffect(() => { fitRef.current = fit; }, [fit]);
  useEffect(() => { isoRef.current = iso; }, [iso]);
  useEffect(() => { exposureDurationSecondsRef.current = exposureDurationSeconds; }, [exposureDurationSeconds]);
  useEffect(() => { apertureRef.current = aperture; }, [aperture]);

  useEffect(() => {
    startMonitoring();
    loadReadings().then((r) => (readingsRef.current = r));
    return () => {
      stopMonitoring();
    };
  }, []);

  // Collect samples while measuring is active
  useEffect(() => {
    if (measuring) {
      samplesRef.current.push(ev100);
    }
  }, [ev100, measuring]);

  // Countdown timer loop
  useEffect(() => {
    if (countdown === null) return;

    if (countdown === 0) {
      setMeasuring(false);
      setCountdown(null);

      const samples = samplesRef.current;
      const avgEv100 = samples.length > 0 ? samples.reduce((a, b) => a + b, 0) / samples.length : ev100Ref.current;
      const estimate = fitRef.current
        ? predictIrradiance(avgEv100, fitRef.current)
        : {
            value: Math.min(1200, Math.max(0, 0.0208 * Math.pow(2, avgEv100))),
            extrapolated: false
          };

      setFinalEstimate(estimate);
      setFinalTelemetry({
        ev100: avgEv100,
        iso: isoRef.current,
        exposureDurationSeconds: exposureDurationSecondsRef.current,
        aperture: apertureRef.current
      });
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((c) => (c !== null ? c - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  const startMeasure = () => {
    samplesRef.current = [];
    setFinalEstimate(null);
    setFinalTelemetry(null);
    setSaved(false);
    setCountdown(5);
    setMeasuring(true);
  };

  const saveReadingToHistory = async () => {
    if (!finalEstimate || !finalTelemetry) return;
    const reading: IrradianceReading = {
      id: `${Date.now()}`,
      timestamp: Date.now(),
      ev100: finalTelemetry.ev100,
      irradianceWm2: finalEstimate.value,
      extrapolated: finalEstimate.extrapolated
    };
    readingsRef.current = await appendReading(readingsRef.current, reading);
    setSaved(true);
  };

  const displayEstimate = measuring
    ? currentEstimate
    : finalEstimate;

  const displayEv100 = measuring ? ev100 : (finalTelemetry?.ev100 ?? 0);
  const displayIso = measuring ? iso : (finalTelemetry?.iso ?? 0);
  const displayShutter = measuring ? exposureDurationSeconds : (finalTelemetry?.exposureDurationSeconds ?? 0);
  const displayAperture = measuring ? aperture : (finalTelemetry?.aperture ?? 0);

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
          value={displayEstimate?.value ?? 0}
          extrapolated={displayEstimate?.extrapolated}
        />

        <View style={styles.telemetry}>
          <Row label="EV100" value={displayEv100.toFixed(2)} />
          <Row label="ISO" value={displayIso.toFixed(0)} />
          <Row label="Shutter" value={`1/${(1 / Math.max(displayShutter, 1e-6)).toFixed(0)}s`} />
          <Row label="Aperture" value={`f/${displayAperture.toFixed(1)}`} />
          {fit && <Row label="Fit R²" value={fit.rSquared.toFixed(3)} />}
        </View>

        <Pressable
          style={[styles.button, measuring ? styles.buttonMeasuring : styles.buttonStart]}
          onPress={startMeasure}
          disabled={measuring}
        >
          <Text style={styles.buttonText}>
            {measuring ? `Measuring... (${countdown}s)` : "Start Measurement (5s)"}
          </Text>
        </Pressable>

        {finalEstimate && !measuring && (
          <Pressable
            style={[styles.button, saved ? styles.buttonSaved : styles.buttonSave]}
            onPress={saveReadingToHistory}
            disabled={saved}
          >
            <Text style={[styles.buttonText, saved && styles.buttonTextSaved]}>
              {saved ? "Saved to History" : "Save to History"}
            </Text>
          </Pressable>
        )}

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
  button: { marginTop: 16, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: "100%" },
  buttonStart: { backgroundColor: "#F59E0B" },
  buttonMeasuring: { backgroundColor: "#475569" },
  buttonSave: { backgroundColor: "#10B981" },
  buttonSaved: { backgroundColor: "#1E293B" },
  buttonText: { color: "#0B0F1A", fontWeight: "700", textAlign: "center", fontSize: 15 },
  buttonTextSaved: { color: "#94A3B8" },
  status: { color: "#64748B", marginTop: 16, fontSize: 12 }
});
