import * as THREE from "three";
import {
  canonicalCategory,
  resolveModel,
  type ModelKey,
} from "@/lib/furnitureKit";

export { canonicalCategory } from "@/lib/furnitureKit";

export function modelPathFor(key: ModelKey): string | undefined {
  return resolveModel(key)?.path;
}

export function rotationDegFor(key: ModelKey): number {
  return resolveModel(key)?.frontOffsetDeg ?? 0;
}

export function frontDegFor(key: ModelKey): number {
  return resolveModel(key)?.frontOffsetDeg ?? 0;
}

export function fitModeFor(key: ModelKey): "footprint" | "floor" | "ceiling" {
  return resolveModel(key)?.fitMode ?? "footprint";
}

export function fitFurnitureModel(
  model: THREE.Object3D,
  dims: { widthM: number; depthM: number; heightM: number },
  fitMode: "footprint" | "floor" | "ceiling" = "footprint",
  frontOffsetDeg = 0
): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return model;

  const safeHeight = Math.max(dims.heightM, 0.02);

  let scale = 1;
  if (fitMode === "floor") {
    scale = Math.min(dims.widthM / size.x, dims.depthM / size.z);
  } else {
    scale = Math.min(
      dims.widthM / size.x,
      dims.depthM / size.z,
      (safeHeight / size.y) * 1.2
    );
  }

  const fitted = model.clone();
  if (fitMode === "floor") {
    fitted.scale.set(dims.widthM / size.x, safeHeight / size.y, dims.depthM / size.z);
  } else {
    fitted.scale.setScalar(scale);
  }

  const fittedBox = new THREE.Box3().setFromObject(fitted);
  const center = fittedBox.getCenter(new THREE.Vector3());
  fitted.position.x -= center.x;
  fitted.position.z -= center.z;
  if (fitMode === "ceiling") {
    fitted.position.y -= fittedBox.max.y;
  } else {
    fitted.position.y -= fittedBox.min.y;
  }

  if (frontOffsetDeg !== 0) {
    fitted.rotation.y = (frontOffsetDeg * Math.PI) / 180;
  }

  return fitted;
}