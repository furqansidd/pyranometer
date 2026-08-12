import ExpoModulesCore
import AVFoundation

// Reads the back camera's live auto-exposure state (ISO, shutter speed,
// aperture) via AVCaptureDevice and emits EV100 to JS. Same approach as
// the native Swift prototype: we read the values the system's 3A
// algorithm already converged on rather than analyzing pixel brightness.
public class CameraExposureModule: Module {
    private let session = AVCaptureSession()
    private var device: AVCaptureDevice?
    private var kvoTokens: [NSKeyValueObservation] = []
    private let sessionQueue = DispatchQueue(label: "pyranometer.camera.session")

    public func definition() -> ModuleDefinition {
        Name("CameraExposure")

        Events("onExposureChange")

        AsyncFunction("start") { (promise: Promise) in
            AVCaptureDevice.requestAccess(for: .video) { granted in
                guard granted else {
                    promise.reject("PERMISSION_DENIED", "Camera access was denied")
                    return
                }
                self.configureAndStart()
                promise.resolve(nil)
            }
        }

        AsyncFunction("stop") { (promise: Promise) in
            self.sessionQueue.async {
                self.session.stopRunning()
            }
            self.kvoTokens.forEach { $0.invalidate() }
            self.kvoTokens.removeAll()
            promise.resolve(nil)
        }
    }

    private func configureAndStart() {
        sessionQueue.async {
            guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .front) else {
                return
            }
            self.device = device

            self.session.beginConfiguration()
            self.session.sessionPreset = .high
            if let input = try? AVCaptureDeviceInput(device: device), self.session.canAddInput(input) {
                self.session.addInput(input)
            }
            self.session.commitConfiguration()

            try? device.lockForConfiguration()
            if device.isExposureModeSupported(.continuousAutoExposure) {
                device.exposureMode = .continuousAutoExposure
            }
            device.unlockForConfiguration()

            self.session.startRunning()
            self.observe(device: device)
        }
    }

    private func observe(device: AVCaptureDevice) {
        kvoTokens.forEach { $0.invalidate() }
        kvoTokens.removeAll()

        let emit: () -> Void = { [weak self, weak device] in
            guard let self, let device else { return }
            let iso = device.iso
            let duration = device.exposureDuration.seconds
            let aperture = device.lensAperture
            let ev100 = Self.computeEV100(aperture: aperture, duration: duration, iso: iso)
            self.sendEvent("onExposureChange", [
                "iso": iso,
                "exposureDurationSeconds": duration,
                "aperture": aperture,
                "ev100": ev100,
                "timestamp": Date().timeIntervalSince1970 * 1000
            ])
        }

        kvoTokens.append(device.observe(\.iso, options: [.new]) { _, _ in emit() })
        kvoTokens.append(device.observe(\.exposureDuration, options: [.new]) { _, _ in emit() })
        kvoTokens.append(device.observe(\.lensAperture, options: [.new]) { _, _ in emit() })
        emit()
    }

    // EV_S = log2(N²/t);  EV_100 = EV_S − log2(S/100)
    static func computeEV100(aperture N: Float, duration t: Double, iso S: Float) -> Double {
        guard t > 0, N > 0, S > 0 else { return 0 }
        let evS = log2(Double(N) * Double(N) / t)
        return evS - log2(Double(S) / 100.0)
    }
}
