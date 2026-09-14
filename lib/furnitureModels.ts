import * as THREE from "three";

export const CATEGORY_MODELS: Record<string, string> = {
  Seating: "/models/furniture/seating.glb",
  Table: "/models/furniture/table.glb",
  Storage: "/models/furniture/storage.glb",
  Bed: "/models/furniture/bed.glb",
  Lighting: "/models/furniture/lighting.glb",
  Decor: "/models/furniture/decor.glb",
  Rug: "/models/furniture/rug.glb",
  Other: "/models/furniture/other.glb",
};

export function modelPathFor(category: string): string | undefined {
  return CATEGORY_MODELS[category];
}

export const MODEL_ROTATION_DEG: Record<string, number> = {};

export const MODEL_FRONT_DEG: Record<string, number> = {};

export function rotationDegFor(category: string): number {
  return MODEL_ROTATION_DEG[category] ?? 0;
}

export function frontDegFor(category: string): number {
  return MODEL_FRONT_DEG[category] ?? 0;
}

export function fitFurnitureModel(
  model: THREE.Object3D,
  widthFt: number,
  depthFt: number,
  heightFt: number,
  rotationOffsetDeg = 0
): THREE.Object3D {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) return model;

  const scale = Math.min(widthFt / size.x, heightFt / size.y, depthFt / size.z);

  const fitted = model.clone();
  fitted.scale.setScalar(scale);

  const fittedBox = new THREE.Box3().setFromObject(fitted);
  const center = fittedBox.getCenter(new THREE.Vector3());
  fitted.position.x -= center.x;
  fitted.position.z -= center.z;
  fitted.position.y -= fittedBox.min.y;

  if (rotationOffsetDeg !== 0) {
    fitted.rotation.y = (rotationOffsetDeg * Math.PI) / 180;
  }

  return fitted;
}