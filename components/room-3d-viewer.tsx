"use client";

import { Suspense, useMemo, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import type { LayoutItem, Obstacle } from "@/lib/schema";
import { wallSegments, furnitureTransform, obstacleTransform } from "@/lib/scene";
import { modelPathFor, fitFurnitureModel, rotationDegFor } from "@/lib/furnitureModels";

interface Room3DViewerProps {
  widthFt: number;
  lengthFt: number;
  heightFt: number;
  items: LayoutItem[];
  obstacles?: Obstacle[];
}

const CATEGORY_COLORS: Record<string, string> = {
  Seating: "#4a6a56",
  Table: "#a9845f",
  Storage: "#7d6a54",
  Bed: "#3f5a4c",
  Lighting: "#2f2d29",
  Decor: "#9aa07f",
  Rug: "#c9b8a0",
  Other: "#8a8172",
};

function FurnitureMesh({
  item,
  width,
  length,
}: {
  item: LayoutItem;
  width: number;
  length: number;
}) {
  const [hovered, setHovered] = useState(false);
  const t = furnitureTransform(item, width, length);

  return (
    <group position={[t.x, item.heightFt / 2, t.z]} rotation={[0, t.rotation, 0]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[item.widthFt, item.heightFt, item.depthFt]} />
        <meshStandardMaterial color={CATEGORY_COLORS[item.category] ?? "#8a8172"} roughness={0.85} />
      </mesh>
      {hovered && (
        <Html position={[0, item.heightFt + 0.5, 0]} center distanceFactor={10}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[11px] leading-tight text-ink shadow-sm">
            <p className="font-medium">{item.item}</p>
            <p className="text-mute">
              {item.widthFt}′ × {item.depthFt}′ · ${item.estimatedCostUSD.toLocaleString()}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

function FurnitureModel({
  item,
  width,
  length,
}: {
  item: LayoutItem;
  width: number;
  length: number;
}) {
  const [hovered, setHovered] = useState(false);
  const { scene } = useGLTF(modelPathFor(item.category) ?? "");
  const fitted = useMemo(
    () =>
      fitFurnitureModel(
        scene,
        item.widthFt,
        item.depthFt,
        item.heightFt,
        rotationDegFor(item.category)
      ),
    [scene, item.widthFt, item.depthFt, item.heightFt, item.category]
  );
  const t = furnitureTransform(item, width, length);

  return (
    <group position={[t.x, 0, t.z]} rotation={[0, t.rotation, 0]}>
      <primitive
        object={fitted}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      />
      {hovered && (
        <Html position={[0, item.heightFt + 0.5, 0]} center distanceFactor={10}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-hair bg-paper px-2.5 py-1.5 text-[11px] leading-tight text-ink shadow-sm">
            <p className="font-medium">{item.item}</p>
            <p className="text-mute">
              {item.widthFt}′ × {item.depthFt}′ · ${item.estimatedCostUSD.toLocaleString()}
            </p>
          </div>
        </Html>
      )}
    </group>
  );
}

function ObstacleMesh({
  obstacle,
  width,
  length,
  height,
}: {
  obstacle: Obstacle;
  width: number;
  length: number;
  height: number;
}) {
  const t = obstacleTransform(obstacle, width, length, height);
  const { position, args, door } = t;

  return (
    <mesh position={position}>
      <boxGeometry args={args} />
      <meshStandardMaterial color={door ? "#8f6b46" : "#a9bdc9"} roughness={0.9} />
    </mesh>
  );
}

export function Room3DViewer({ widthFt, lengthFt, heightFt, items, obstacles = [] }: Room3DViewerProps) {
  const maxDim = Math.max(widthFt, lengthFt);
  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-hair bg-surface">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [widthFt * 0.9, heightFt * 1.6 + 2, maxDim * 1.05], fov: 42 }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[widthFt, heightFt * 2, lengthFt]} intensity={1.1} />
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[widthFt, lengthFt]} />
            <meshStandardMaterial color="#efe9de" roughness={0.95} />
          </mesh>
          {wallSegments(widthFt, lengthFt, heightFt).map((w) => (
            <mesh key={w.key} position={w.position as [number, number, number]}>
              <boxGeometry args={w.args as [number, number, number]} />
              <meshStandardMaterial color="#e3ddd1" roughness={0.95} />
            </mesh>
          ))}
          <gridHelper args={[Math.max(maxDim * 1.6, 8), 16, "#d8d0c0", "#e6e0d2"]} position={[0, 0.02, 0]} />
          <Suspense fallback={null}>
            {items.map((item) =>
              modelPathFor(item.category) ? (
                <FurnitureModel key={item.itemId} item={item} width={widthFt} length={lengthFt} />
              ) : (
                <FurnitureMesh key={item.itemId} item={item} width={widthFt} length={lengthFt} />
              )
            )}
          </Suspense>
          {obstacles.map((o, i) => (
            <ObstacleMesh key={i} obstacle={o} width={widthFt} length={lengthFt} height={heightFt} />
          ))}
        </group>
        <OrbitControls makeDefault enableDamping target={[0, heightFt * 0.4, 0]} />
      </Canvas>
      <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-mute">
        Hover a piece for details
      </span>
    </div>
  );
}