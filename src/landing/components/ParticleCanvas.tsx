"use client";

import { useEffect, useRef } from "react";
import { Matrix4, Vector3 } from "three";
import { ControlManager } from "@/src/landing/engine/controls";
import { Engine } from "@/src/landing/engine/engine";
import {
  projectLabelsInto,
  type ProjectedLabel,
} from "@/src/landing/engine/label-projection";
import { MouseSim } from "@/src/landing/engine/mouse-sim";
import { ParticleSystem } from "@/src/landing/engine/particles";
import { RestBaker } from "@/src/landing/engine/rest-baker";
import { getMorphBlend, type MorphBlend } from "@/src/landing/engine/morph";
import { createModelTexture } from "@/src/landing/engine/model-texture";
import type { ModelData } from "@/src/landing/engine/model-loader";
import type { Preset, ShaderId, SystemSettings } from "@/src/landing/engine/types";
import { clamp, clamp01, lerp } from "@/src/landing/utils/math";
import { reducedMotion } from "@/src/landing/utils/reduced-motion";

const PARTICLE_INTRO_DELAY_S = 1;
const DEFAULT_CAM_POS: [number, number, number] = [0, 30, 80];
const DEFAULT_CAM_TARGET: [number, number, number] = [0, 0, 0];
const CAM_LERP_SPEED = 0.025;

const SHADER_ID_TO_INT: Record<ShaderId, number> = {
  racetrack: 0,
  racecar: 1,
  runner: 2,
  remixLogo: 3,
  racetrackCar: 4,
};

function resolveShaderInt(preset: Preset): number {
  return SHADER_ID_TO_INT[preset.shaderId];
}

type PresetRuntimeData = {
  presets: Preset[];
  controls: number[][];
  shaderInts: number[];
  racetrackIndex: number;
  driveIndex: number;
  driveCarPosY: number;
};

function setDesiredCameraInto(
  presets: Preset[],
  morphValue: number,
  outPos: Vector3,
  outTarget: Vector3,
) {
  const maxIdx = presets.length - 1;
  const clamped = clamp(morphValue, 0, maxIdx);
  const fromIdx = Math.min(Math.floor(clamped), maxIdx);
  const toIdx = Math.min(fromIdx + 1, maxIdx);
  const blend = clamped - fromIdx;

  const fromPos = presets[fromIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const fromTarget = presets[fromIdx].cameraTarget ?? DEFAULT_CAM_TARGET;
  const toPos = presets[toIdx].cameraPosition ?? DEFAULT_CAM_POS;
  const toTarget = presets[toIdx].cameraTarget ?? DEFAULT_CAM_TARGET;

  outPos.set(
    lerp(fromPos[0], toPos[0], blend),
    lerp(fromPos[1], toPos[1], blend),
    lerp(fromPos[2], toPos[2], blend),
  );
  outTarget.set(
    lerp(fromTarget[0], toTarget[0], blend),
    lerp(fromTarget[1], toTarget[1], blend),
    lerp(fromTarget[2], toTarget[2], blend),
  );
}

function copyControlsInto(source: number[], target: number[]) {
  for (let i = 0; i < 8; i++) {
    target[i] = source[i] ?? 0;
  }
}

function copyManagedControlsInto(
  preset: Preset,
  controlMgr: ControlManager,
  target: number[],
) {
  for (let i = 0; i < 8; i++) {
    const control = preset.controls[i];
    target[i] = control
      ? (controlMgr.controls.get(control.id)?.value ?? control.initial)
      : 0;
  }
}

function buildInitialControls(preset: Preset): number[] {
  const controls = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(preset.controls.length, 8); i++) {
    controls[i] = preset.controls[i].initial;
  }
  return controls;
}

function getControlInitial(preset: Preset, id: string, fallback = 0): number {
  return (
    preset.controls.find((control) => control.id === id)?.initial ?? fallback
  );
}

function buildPresetRuntimeData(presets: Preset[]): PresetRuntimeData {
  const driveIndex = presets.findIndex((preset) => preset.name === "Drive");
  return {
    presets,
    controls: presets.map(buildInitialControls),
    shaderInts: presets.map(resolveShaderInt),
    racetrackIndex: presets.findIndex((preset) => preset.name === "Racetrack"),
    driveIndex,
    driveCarPosY:
      driveIndex >= 0
        ? getControlInitial(presets[driveIndex], "_carPosY", 0)
        : 0,
  };
}

export type ParticleCanvasProps = {
  settings: SystemSettings;
  presets: Preset[];
  morphValueRef: React.MutableRefObject<number>;
  modelData: (ModelData | undefined)[];
  labelsRef: React.MutableRefObject<ProjectedLabel[]>;
  labelOpacityRef: React.MutableRefObject<number>;
  onReady: () => void;
  onError: (error: unknown) => void;
};

export function ParticleCanvas({
  settings,
  presets,
  morphValueRef,
  modelData,
  labelsRef,
  labelOpacityRef,
  onReady,
  onError,
}: ParticleCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const settingsRef = useRef(settings);
  const presetsRef = useRef(presets);
  const modelDataRef = useRef(modelData);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  settingsRef.current = settings;
  presetsRef.current = presets;
  modelDataRef.current = modelData;
  onReadyRef.current = onReady;
  onErrorRef.current = onError;

  useEffect(() => {
    const containerEl = containerRef.current;
    const canvasEl = canvasRef.current;
    if (!containerEl || !canvasEl) return;

    let engine: Engine | null = null;
    let particles: ParticleSystem | null = null;
    let restBaker: RestBaker | null = null;
    let mouseSim: MouseSim | null = null;
    const appliedModelSlots = new Set<number>();
    let frameId = 0;
    let startTime = 0;
    let frozenTime: number | null = null;
    let previousNearest = -1;
    let hasReportedReady = false;
    let initFailed = false;
    const labelControlMgr = new ControlManager();
    const desiredCameraPos = new Vector3();
    const desiredCameraTarget = new Vector3();
    const scratchViewProj = new Matrix4();
    const scratchCamRight = new Vector3();
    const scratchCamUp = new Vector3();
    let lastFrameNow = 0;
    const scratchControlsA = [0, 0, 0, 0, 0, 0, 0, 0];
    const scratchControlsB = [0, 0, 0, 0, 0, 0, 0, 0];
    const scratchLabelControls = [0, 0, 0, 0, 0, 0, 0, 0];
    const morphBlend: MorphBlend = { fromIndex: 0, toIndex: 0, blend: 0 };
    let presetRuntimeData: PresetRuntimeData | null = null;

    let mouseNormX = 0;
    let mouseNormY = 0;
    let prevMouseNormX = 0;
    let prevMouseNormY = 0;
    let mouseVelPrimed = false;
    let mouseNdcSpeedSmoothed = 0;
    let mouseBrushSmoothed = 0;
    let smoothMouseOffsetX = 0;
    let smoothCarLane = 0;
    let prevCarLane = 0;
    let laneActivity = 0;

    const MOUSE_RANGE = 1;
    const MOUSE_LERP = 0.04;
    const CAR_LANE_LERP = 0.06;
    const ACTIVITY_DECAY = 0.97;
    const ACTIVITY_GAIN = 20.0;
    const RACETRACK_MOUSE_STRAFE_ATTENUATION = 0.4;
    const RACETRACK_MOUSE_STRAFE_OF_TRACKW = 0.18;
    const MOUSE_SIM_STRENGTH_SCALE = 3900;
    const MOUSE_SIM_REPULSION_REF = 0.2;
    const MOUSE_SIM_PEAK_DISP = 17.0;
    const MOUSE_SIM_FOLLOW_TAU = 10;
    const MOUSE_SIM_NDC_RADIUS = 0.154;
    const MOUSE_SIM_VEL_SMOOTH_TAU = 22;
    const MOUSE_SIM_VEL_GATE = 0.14;
    const MOUSE_SIM_VEL_FULL = 5.5;
    const MOUSE_SIM_BRUSH_SMOOTH_TAU = 14;
    const MOUSE_SIM_PUSH_GAIN =
      MOUSE_SIM_PEAK_DISP /
      (MOUSE_SIM_STRENGTH_SCALE * MOUSE_SIM_REPULSION_REF);

    function setMousePosition(clientX: number, clientY: number) {
      const vp = containerEl ?? canvasEl;
      if (vp) {
        const rect = vp.getBoundingClientRect();
        const rw = rect.width > 1e-4 ? rect.width : window.innerWidth;
        const rh = rect.height > 1e-4 ? rect.height : window.innerHeight;
        mouseNormX = ((clientX - rect.left) / rw) * 2 - 1;
        mouseNormY = ((clientY - rect.top) / rh) * 2 - 1;
      } else {
        mouseNormX = (clientX / window.innerWidth) * 2 - 1;
        mouseNormY = (clientY / window.innerHeight) * 2 - 1;
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      setMousePosition(event.clientX, event.clientY);
    };

    const onMouseMove = (event: MouseEvent) => {
      if (window.PointerEvent) return;
      if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
        return;
      }
      setMousePosition(event.clientX, event.clientY);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("mousemove", onMouseMove);

    function getPresetRuntimeData(currentPresets: Preset[]) {
      if (presetRuntimeData?.presets === currentPresets) {
        return presetRuntimeData;
      }
      presetRuntimeData = buildPresetRuntimeData(currentPresets);
      return presetRuntimeData;
    }

    function disposeScene() {
      cancelAnimationFrame(frameId);
      if (particles && engine) {
        particles.dispose(engine.scene);
      }
      mouseSim?.dispose();
      restBaker?.dispose();
      appliedModelSlots.clear();
      engine?.dispose();
      particles = null;
      restBaker = null;
      mouseSim = null;
      engine = null;
      mouseVelPrimed = false;
      mouseNdcSpeedSmoothed = 0;
      mouseBrushSmoothed = 0;
    }

    function syncModelTextures() {
      if (!restBaker) return;
      const currentPresets = presetsRef.current;
      const currentModelData = modelDataRef.current;

      for (const preset of currentPresets) {
        if (
          preset.modelUrl == null ||
          preset.modelSlot == null ||
          appliedModelSlots.has(preset.modelSlot)
        ) {
          continue;
        }

        const model =
          currentModelData[currentPresets.indexOf(preset)];
        if (!model) continue;

        restBaker.setModelTexture(
          preset.modelSlot,
          createModelTexture(model),
          model.positions.length / 3,
        );
        appliedModelSlots.add(preset.modelSlot);
      }
    }

    try {
      engine = new Engine();
      engine.init(canvasEl, containerEl, settingsRef.current);

      restBaker = new RestBaker(
        engine.renderer,
        settingsRef.current.particleCount,
      );
      restBaker.setCount(settingsRef.current.particleCount);

      particles = new ParticleSystem();
      particles.init(
        engine.scene,
        settingsRef.current.particleCount,
        settingsRef.current.pointSize,
      );
      particles.setRestTextures(
        restBaker.getPosTexture(0),
        restBaker.getColTexture(0),
        restBaker.getPosTexture(1),
        restBaker.getColTexture(1),
      );
      syncModelTextures();

      mouseSim = new MouseSim(
        engine.renderer,
        settingsRef.current.particleCount,
      );
      mouseSim.setRestTextures(
        restBaker.getPosTexture(0),
        restBaker.getPosTexture(1),
      );
      mouseSim.setPushGain(MOUSE_SIM_PUSH_GAIN);
      mouseSim.setFollowTau(MOUSE_SIM_FOLLOW_TAU);
      particles.setDispTexture(mouseSim.getDispTexture());

      startTime = performance.now() / 1000;
      setDesiredCameraInto(
        presetsRef.current,
        morphValueRef.current,
        desiredCameraPos,
        desiredCameraTarget,
      );
      engine.camera.position.copy(desiredCameraPos);
      engine.controls.target.copy(desiredCameraTarget);

      const initialPresetData = getPresetRuntimeData(presetsRef.current);
      const initialIndex = Math.min(
        Math.max(0, Math.floor(morphValueRef.current)),
        initialPresetData.presets.length - 1,
      );
      copyControlsInto(
        initialPresetData.controls[initialIndex],
        scratchControlsA,
      );
      restBaker.bake(
        0,
        initialPresetData.shaderInts[initialIndex],
        scratchControlsA,
        0,
      );
      engine.renderer.compile(engine.scene, engine.camera);
    } catch (error) {
      initFailed = true;
      disposeScene();
      onErrorRef.current(error);
      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("mousemove", onMouseMove);
      };
    }

    const animate = () => {
      if (!engine || !particles || !restBaker || !mouseSim) {
        return;
      }

      syncModelTextures();

      const now = performance.now();
      const time = now / 1000 - startTime;
      const dtSeconds =
        lastFrameNow === 0 ? 1 / 60 : (now - lastFrameNow) / 1000;
      lastFrameNow = now;
      const currentSettings = settingsRef.current;
      const currentPresets = presetsRef.current;
      const presetData = getPresetRuntimeData(currentPresets);
      const morphValue = morphValueRef.current;
      const reduceMotion = reducedMotion.current;

      if (reduceMotion) {
        frozenTime ??= Math.max(time, PARTICLE_INTRO_DELAY_S + 3.5);
      } else {
        frozenTime = null;
      }
      const visualTime = frozenTime ?? time;

      engine.updateSettings(currentSettings);

      const screenScale = engine.getScreenScale();
      particles.setPointSize(currentSettings.pointSize);
      particles.setHdrIntensity(currentSettings.hdrIntensity * screenScale);
      const effectiveMouseNormX = reduceMotion ? 0 : mouseNormX;
      const effectiveMouseNormY = reduceMotion ? 0 : mouseNormY;

      let mouseBrushFactor = 0;
      const dtClamp = Math.max(dtSeconds, 1e-4);
      if (reduceMotion) {
        mouseVelPrimed = false;
        mouseNdcSpeedSmoothed = 0;
        mouseBrushSmoothed = 0;
      } else {
        if (!mouseVelPrimed) {
          prevMouseNormX = effectiveMouseNormX;
          prevMouseNormY = effectiveMouseNormY;
          mouseVelPrimed = true;
        } else {
          const speed = Math.hypot(
            (effectiveMouseNormX - prevMouseNormX) / dtClamp,
            (effectiveMouseNormY - prevMouseNormY) / dtClamp,
          );
          const kVel = 1 - Math.exp(-MOUSE_SIM_VEL_SMOOTH_TAU * dtClamp);
          mouseNdcSpeedSmoothed += (speed - mouseNdcSpeedSmoothed) * kVel;
        }
        prevMouseNormX = effectiveMouseNormX;
        prevMouseNormY = effectiveMouseNormY;
        const span = Math.max(MOUSE_SIM_VEL_FULL - MOUSE_SIM_VEL_GATE, 1e-4);
        const linear = clamp01(
          (mouseNdcSpeedSmoothed - MOUSE_SIM_VEL_GATE) / span,
        );
        const brushTarget = linear * linear * (3 - 2 * linear);
        const kBrush = 1 - Math.exp(-MOUSE_SIM_BRUSH_SMOOTH_TAU * dtClamp);
        mouseBrushSmoothed += (brushTarget - mouseBrushSmoothed) * kBrush;
        mouseBrushFactor = mouseBrushSmoothed;
      }

      particles.setColorMode(currentSettings.colorMode);
      particles.setDof(currentSettings.dofAmount, currentSettings.dofFocus);
      const introTime = Math.max(0, visualTime - PARTICLE_INTRO_DELAY_S);
      particles.setIntroProgress(
        reduceMotion ? 1.5 : Math.min(introTime / 3.5, 1.5),
      );
      particles.setTime(visualTime);

      const maxValue = currentPresets.length - 1;
      getMorphBlend(morphValue, maxValue, morphBlend);
      const { fromIndex, toIndex, blend } = morphBlend;

      let separation: number;

      if (blend < 0.001) {
        copyControlsInto(presetData.controls[fromIndex], scratchControlsA);
        copyControlsInto(presetData.controls[fromIndex], scratchControlsB);
        separation = currentPresets[fromIndex].separation;
      } else {
        copyControlsInto(presetData.controls[fromIndex], scratchControlsA);
        copyControlsInto(presetData.controls[toIndex], scratchControlsB);
        const easedBlend = blend * blend * (3 - 2 * blend);
        separation =
          currentPresets[fromIndex].separation * (1 - easedBlend) +
          currentPresets[toIndex].separation * easedBlend;
      }

      const racetrackIndex = presetData.racetrackIndex;
      const racetrackDist =
        racetrackIndex >= 0 ? Math.abs(morphValue - racetrackIndex) : 0;
      const departingRacetrack =
        !reduceMotion && racetrackDist > 0.01 && racetrackDist < 1.0;

      if (departingRacetrack) {
        const surge = racetrackDist * racetrackDist * 32;
        if (blend < 0.001) {
          if (fromIndex === racetrackIndex || toIndex === racetrackIndex) {
            scratchControlsA[7] = surge;
            scratchControlsB[7] = surge;
          }
        } else {
          if (fromIndex === racetrackIndex) scratchControlsA[7] = surge;
          if (toIndex === racetrackIndex) scratchControlsB[7] = surge;
        }
      }

      let morphT = 0;
      if (blend > 0.001) {
        const ease = currentSettings.morphEase;
        const tk = Math.pow(blend, ease);
        morphT = tk / (tk + Math.pow(1 - blend, ease));
      }
      particles.setBlend(blend);
      particles.setMorphT(morphT);
      particles.setSeparation(separation);

      const overridesA = currentPresets[fromIndex].systemOverrides;
      const overridesB = currentPresets[toIndex].systemOverrides;
      const easedBlend = blend * blend * (3 - 2 * blend);
      const effectiveTrail =
        (1 - easedBlend) *
          (overridesA?.trailIntensity ?? currentSettings.trailIntensity) +
        easedBlend *
          (overridesB?.trailIntensity ?? currentSettings.trailIntensity);
      const effectiveRepulsion =
        (1 - easedBlend) *
          (overridesA?.cursorRepulsion ?? currentSettings.cursorRepulsion) +
        easedBlend *
          (overridesB?.cursorRepulsion ?? currentSettings.cursorRepulsion);
      const trailBoost = departingRacetrack
        ? Math.sin(racetrackDist * Math.PI) * 0.75
        : 0;
      engine.afterImagePass.uniforms.damp.value = reduceMotion
        ? 0
        : Math.min(effectiveTrail + trailBoost, 0.97);

      const driveIndex = presetData.driveIndex;
      const racetrackFogDist =
        racetrackIndex >= 0 ? Math.abs(morphValue - racetrackIndex) : Infinity;
      const driveFogDist =
        driveIndex >= 0 ? Math.abs(morphValue - driveIndex) : Infinity;
      const fogProximity = Math.max(
        0,
        1 - Math.min(racetrackFogDist, driveFogDist),
      );
      particles.setFog(fogProximity, 10, 180);

      const driveProximity =
        driveIndex >= 0 ? clamp01(1 - Math.abs(morphValue - driveIndex)) : 0;
      const racetrackRoadLock =
        racetrackIndex >= 0
          ? clamp01(1 - racetrackDist) * (1 - driveProximity)
          : 0;
      if (!reduceMotion && driveProximity > 0) {
        smoothCarLane += (effectiveMouseNormX - smoothCarLane) * CAR_LANE_LERP;
      } else {
        smoothCarLane += (0 - smoothCarLane) * CAR_LANE_LERP;
      }

      const laneDelta = Math.abs(smoothCarLane - prevCarLane);
      laneActivity = Math.max(
        laneActivity * ACTIVITY_DECAY,
        clamp01(laneDelta * ACTIVITY_GAIN),
      );
      prevCarLane = smoothCarLane;

      const carLaneOffset = smoothCarLane * driveProximity;
      const carLaneActivity = laneActivity * driveProximity;
      const carPosY =
        driveIndex >= 0 ? presetData.driveCarPosY * driveProximity : 0;
      restBaker.setCarUniforms(carLaneOffset, carLaneActivity, carPosY);

      restBaker.bake(
        0,
        presetData.shaderInts[fromIndex],
        scratchControlsA,
        visualTime,
      );
      if (blend > 0.001) {
        restBaker.bake(
          1,
          presetData.shaderInts[toIndex],
          scratchControlsB,
          visualTime,
        );
      }

      engine.controls.enabled = !reduceMotion && driveProximity < 0.5;

      setDesiredCameraInto(
        currentPresets,
        morphValue,
        desiredCameraPos,
        desiredCameraTarget,
      );
      if (reduceMotion) {
        engine.camera.position.copy(desiredCameraPos);
        engine.controls.target.copy(desiredCameraTarget);
      } else {
        engine.camera.position.lerp(desiredCameraPos, CAM_LERP_SPEED);
        engine.controls.target.lerp(desiredCameraTarget, CAM_LERP_SPEED);
      }

      const parallaxScale = 1 - driveProximity;
      smoothMouseOffsetX +=
        (effectiveMouseNormX * MOUSE_RANGE - smoothMouseOffsetX) * MOUSE_LERP;
      if (!reduceMotion) {
        const parallaxUncapped = smoothMouseOffsetX * parallaxScale;
        let parallaxX = parallaxUncapped;
        if (racetrackIndex >= 0 && racetrackRoadLock > 0) {
          const trackW = presetData.controls[racetrackIndex][1] ?? 40;
          const strafeCap = trackW * RACETRACK_MOUSE_STRAFE_OF_TRACKW;
          const parallaxRacetrack = clamp(
            parallaxUncapped * RACETRACK_MOUSE_STRAFE_ATTENUATION,
            -strafeCap,
            strafeCap,
          );
          parallaxX = lerp(
            parallaxUncapped,
            parallaxRacetrack,
            racetrackRoadLock,
          );
        }
        engine.camera.position.x += parallaxX;
      }

      engine.controls.update();
      scratchViewProj.multiplyMatrices(
        engine.camera.projectionMatrix,
        engine.camera.matrixWorldInverse,
      );
      const ew = engine.camera.matrixWorld.elements;
      scratchCamRight.set(ew[0], ew[1], ew[2]).normalize();
      scratchCamUp.set(ew[4], ew[5], ew[6]).normalize();
      mouseSim.setViewProj(scratchViewProj);
      mouseSim.setCamBasis(scratchCamRight, scratchCamUp);
      mouseSim.setMouseNDC(effectiveMouseNormX, -effectiveMouseNormY);
      mouseSim.setBlend(blend);
      mouseSim.setMorphT(morphT);
      mouseSim.setMouseNdcRadius(MOUSE_SIM_NDC_RADIUS * mouseBrushFactor);
      mouseSim.setMouseStrength(
        reduceMotion
          ? 0
          : effectiveRepulsion * MOUSE_SIM_STRENGTH_SCALE * mouseBrushFactor,
      );
      mouseSim.step(dtSeconds);
      particles.setDispTexture(mouseSim.getDispTexture());

      const nearest = Math.round(clamp(morphValue, 0, maxValue));
      if (nearest !== previousNearest) {
        previousNearest = nearest;
        labelControlMgr.loadPreset(currentPresets[nearest]);
      }

      const nearestPreset = currentPresets[nearest];
      if (
        nearestPreset?.labels &&
        nearestPreset.labels.length > 0 &&
        containerEl
      ) {
        let activeCtrls = presetData.controls[nearest];
        if (blend < 0.001) {
          copyManagedControlsInto(
            nearestPreset,
            labelControlMgr,
            scratchLabelControls,
          );
          activeCtrls = scratchLabelControls;
        }

        projectLabelsInto(
          labelsRef.current,
          nearestPreset,
          labelControlMgr,
          activeCtrls,
          visualTime,
          engine.camera,
          containerEl.clientWidth,
          containerEl.clientHeight,
        );

        const distFromNearest = Math.abs(morphValue - nearest);
        labelOpacityRef.current = Math.max(0, 1 - distFromNearest * 4);
      } else {
        labelsRef.current.length = 0;
        labelOpacityRef.current = 0;
      }

      engine.render(time);
      if (!hasReportedReady) {
        hasReportedReady = true;
        onReadyRef.current();
      }
      frameId = requestAnimationFrame(animate);
    };

    if (!initFailed) {
      frameId = requestAnimationFrame(animate);
    }

    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("mousemove", onMouseMove);
      disposeScene();
    };
  }, [labelsRef, labelOpacityRef, morphValueRef]);

  return (
    <div ref={containerRef} aria-hidden="true" className="particle-canvas">
      <canvas ref={canvasRef} className="particle-canvas__canvas" />
    </div>
  );
}
