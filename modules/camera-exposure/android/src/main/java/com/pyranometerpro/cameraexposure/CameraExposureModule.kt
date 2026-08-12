package com.pyranometerpro.cameraexposure

import android.content.Context
import android.hardware.camera2.*
import android.hardware.camera2.params.StreamConfigurationMap
import android.os.Handler
import android.os.HandlerThread
import android.util.Size
import android.view.Surface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.Promise
import kotlin.math.log2
import kotlin.math.pow

// Reads the back camera's live auto-exposure state (ISO, exposure time,
// aperture) via Camera2's CaptureResult stream and emits EV100 to JS.
// Mirrors the iOS module's math so both platforms produce the same
// lighting-only signal for the calibration engine.
class CameraExposureModule : Module() {
    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var backgroundThread: HandlerThread? = null
    private var backgroundHandler: Handler? = null
    private var imageReaderSurface: Surface? = null

    override fun definition() = ModuleDefinition {
        Name("CameraExposure")
        Events("onExposureChange")

        AsyncFunction("start") { promise: Promise ->
            try {
                startBackgroundThread()
                openCamera(promise)
            } catch (e: Exception) {
                promise.reject("START_FAILED", e.message, e)
            }
        }

        AsyncFunction("stop") { promise: Promise ->
            closeCamera()
            promise.resolve(null)
        }
    }

    private fun context(): Context = appContext.reactContext!!

    private fun startBackgroundThread() {
        backgroundThread = HandlerThread("CameraExposureThread").also { it.start() }
        backgroundHandler = Handler(backgroundThread!!.looper)
    }

    private fun openCamera(promise: Promise) {
        val manager = context().getSystemService(Context.CAMERA_SERVICE) as CameraManager
        val backCameraId = manager.cameraIdList.firstOrNull { id ->
            manager.getCameraCharacteristics(id)
                .get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        } ?: run {
            promise.reject("NO_CAMERA", "No back camera found", null)
            return
        }

        try {
            manager.openCamera(backCameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    cameraDevice = camera
                    startPreviewSession(manager, backCameraId, camera)
                    promise.resolve(null)
                }
                override fun onDisconnected(camera: CameraDevice) { camera.close() }
                override fun onError(camera: CameraDevice, error: Int) {
                    camera.close()
                    promise.reject("CAMERA_ERROR", "Camera error code $error", null)
                }
            }, backgroundHandler)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Camera permission not granted", e)
        }
    }

    private fun startPreviewSession(manager: CameraManager, cameraId: String, camera: CameraDevice) {
        val characteristics = manager.getCameraCharacteristics(cameraId)
        val map = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP) as StreamConfigurationMap
        val size: Size = map.getOutputSizes(android.graphics.SurfaceTexture::class.java)
            .minByOrNull { it.width * it.height } ?: Size(640, 480)

        val texture = android.graphics.SurfaceTexture(0)
        texture.setDefaultBufferSize(size.width, size.height)
        val surface = Surface(texture)
        imageReaderSurface = surface

        val requestBuilder = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
        requestBuilder.addTarget(surface)
        requestBuilder.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)

        camera.createCaptureSession(listOf(surface), object : CameraCaptureSession.StateCallback() {
            override fun onConfigured(session: CameraCaptureSession) {
                captureSession = session
                session.setRepeatingRequest(requestBuilder.build(), object : CameraCaptureSession.CaptureCallback() {
                    override fun onCaptureCompleted(
                        session: CameraCaptureSession,
                        request: CaptureRequest,
                        result: TotalCaptureResult
                    ) {
                        emitFromResult(characteristics, result)
                    }
                }, backgroundHandler)
            }
            override fun onConfigureFailed(session: CameraCaptureSession) { /* no-op */ }
        }, backgroundHandler)
    }

    private fun emitFromResult(characteristics: CameraCharacteristics, result: TotalCaptureResult) {
        val iso = result.get(CaptureResult.SENSOR_SENSITIVITY)?.toFloat() ?: return
        val exposureTimeNs = result.get(CaptureResult.SENSOR_EXPOSURE_TIME) ?: return
        val apertures = characteristics.get(CameraCharacteristics.LENS_INFO_AVAILABLE_APERTURES)
        val aperture = apertures?.firstOrNull() ?: 1.8f
        val durationSeconds = exposureTimeNs / 1_000_000_000.0

        val ev100 = computeEV100(aperture, durationSeconds, iso)

        this@CameraExposureModule.sendEvent("onExposureChange", mapOf(
            "iso" to iso,
            "exposureDurationSeconds" to durationSeconds,
            "aperture" to aperture,
            "ev100" to ev100,
            "timestamp" to System.currentTimeMillis().toDouble()
        ))
    }

    // EV_S = log2(N²/t);  EV_100 = EV_S − log2(S/100)
    private fun computeEV100(aperture: Float, durationSeconds: Double, iso: Float): Double {
        if (durationSeconds <= 0 || aperture <= 0 || iso <= 0) return 0.0
        val evS = log2((aperture.toDouble().pow(2)) / durationSeconds)
        return evS - log2(iso.toDouble() / 100.0)
    }

    private fun closeCamera() {
        try {
            captureSession?.close()
            cameraDevice?.close()
            imageReaderSurface?.release()
            backgroundThread?.quitSafely()
        } catch (_: Exception) { }
        captureSession = null
        cameraDevice = null
        imageReaderSurface = null
        backgroundThread = null
        backgroundHandler = null
    }
}
