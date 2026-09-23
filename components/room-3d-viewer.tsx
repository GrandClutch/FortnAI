"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, Html, useGLTF } from "@react-three/drei";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { LayoutItem, Obstacle } from "@/lib/schema";
import { wallSegments, furnitureTransform, obstacleTransform } from "@/lib/scene";
import { modelPathFor, fitFurnitureModel, rotationDegFor } from "@/lib/furnitureModels";

interface Room3DViewerProps {
  widthM: number;
  lengthM: number;
  heightM: number;
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

interface ExportApi {
  exportGLB: () => Promise<void>;
  exportPNG: () => void;
}

function fallbackBox(item: LayoutItem): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(item.widthM, item.heightM, item.depthM),
    new THREE.MeshStandardMaterial({
      color: CATEGORY_COLORS[item.category] ?? "#8a8172",
      roughness: 0.85,
    })
  );
  mesh.position.y = item.heightM / 2;
  mesh.name = item.item;
  return mesh;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

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
    <group position={[t.x, item.heightM / 2, t.z]} rotation={[0, t.rotation, 0]}>
      <mesh
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[item.widthM, item.heightM, item.depthM]} />
        <meshStandardMaterial color={CATEGORY_COLORS[item.category] ?? "#8a8172"} roughness={0.85} />
      </mesh>
      {hovered && (
        <Html position={[0, item.heightM + 0.5, 0]} center distanceFactor={10}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-hair bg-paper px-2 py-1 text-[10px] font-medium text-ink shadow-sm">
            {item.item}
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
        item.widthM,
        item.depthM,
        item.heightM,
        rotationDegFor(item.category)
      ),
    [scene, item.widthM, item.depthM, item.heightM, item.category]
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
        <Html position={[0, item.heightM + 0.5, 0]} center distanceFactor={10}>
          <div className="pointer-events-none whitespace-nowrap rounded-md border border-hair bg-paper px-2 py-1 text-[10px] font-medium text-ink shadow-sm">
            {item.item}
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

function ExportBridge({
  widthM,
  lengthM,
  heightM,
  items,
  obstacles,
  onReady,
}: {
  widthM: number;
  lengthM: number;
  heightM: number;
  items: LayoutItem[];
  obstacles: Obstacle[];
  onReady: (api: ExportApi) => void;
}) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const api = useMemo<ExportApi>(
    () => ({
      exportPNG: () => {
        const prevClear = gl.getClearColor(new THREE.Color()).getHex();
        const prevAlpha = gl.getClearAlpha();
        gl.setClearColor("#f6f4f0", 1);
        gl.render(scene, camera);
        const dataUrl = gl.domElement.toDataURL("image/png");
        gl.setClearColor(prevClear, prevAlpha);
        downloadDataUrl(dataUrl, "fortnai-room-view.png");
      },
      exportGLB: async () => {
        const root = new THREE.Group();
        root.name = "FortnAI Room";

        const floor = new THREE.Mesh(
          new THREE.PlaneGeometry(widthM, lengthM),
          new THREE.MeshStandardMaterial({ color: "#efe9de", roughness: 0.95 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.name = "Floor";
        root.add(floor);

        for (const w of wallSegments(widthM, lengthM, heightM)) {
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(w.args[0], w.args[1], w.args[2]),
            new THREE.MeshStandardMaterial({ color: "#e3ddd1", roughness: 0.95 })
          );
          mesh.position.set(w.position[0], w.position[1], w.position[2]);
          mesh.name = `${w.key.charAt(0).toUpperCase() + w.key.slice(1)} wall`;
          root.add(mesh);
        }

        const loader = new GLTFLoader();
        for (const item of items) {
          const t = furnitureTransform(item, widthM, lengthM);
          const group = new THREE.Group();
          group.position.set(t.x, 0, t.z);
          group.rotation.y = t.rotation;
          group.name = item.item;

          const path = modelPathFor(item.category);
          if (path) {
            try {
              const gltf = await loader.loadAsync(path);
              group.add(
                fitFurnitureModel(
                  gltf.scene,
                  item.widthM,
                  item.depthM,
                  item.heightM,
                  rotationDegFor(item.category)
                )
              );
            } catch {
              group.add(fallbackBox(item));
            }
          } else {
            group.add(fallbackBox(item));
          }
          root.add(group);
        }

        for (const o of obstacles) {
          const t = obstacleTransform(o, widthM, lengthM, heightM);
          const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(t.args[0], t.args[1], t.args[2]),
            new THREE.MeshStandardMaterial({
              color: t.door ? "#8f6b46" : "#a9bdc9",
              roughness: 0.9,
            })
          );
          mesh.position.set(t.position[0], t.position[1], t.position[2]);
          mesh.name = o.type === "door" ? "Door" : "Window";
          root.add(mesh);
        }

        const exporter = new GLTFExporter();
        exporter.parse(
          root,
          (result) => {
            const blob =
              result instanceof ArrayBuffer
                ? new Blob([result], { type: "model/gltf-binary" })
                : new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
            downloadBlob(blob, "fortnai-room.glb");
          },
          (err) => console.error("GLB export failed:", err),
          { binary: true }
        );
      },
    }),
    [gl, scene, camera, widthM, lengthM, heightM, items, obstacles]
  );

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

export function Room3DViewer({ widthM, lengthM, heightM, items, obstacles = [] }: Room3DViewerProps) {
  const maxDim = Math.max(widthM, lengthM);
  const exportApi = useRef<ExportApi | null>(null);
  const handleReady = useCallback((api: ExportApi) => {
    exportApi.current = api;
  }, []);

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-hair bg-surface">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [widthM * 0.9, heightM * 1.6 + 2, maxDim * 1.05], fov: 42 }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[widthM, heightM * 2, lengthM]} intensity={1.1} />
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[widthM, lengthM]} />
            <meshStandardMaterial color="#efe9de" roughness={0.95} />
          </mesh>
          {wallSegments(widthM, lengthM, heightM).map((w) => (
            <mesh key={w.key} position={w.position as [number, number, number]}>
              <boxGeometry args={w.args as [number, number, number]} />
              <meshStandardMaterial color="#e3ddd1" roughness={0.95} />
            </mesh>
          ))}
          <gridHelper args={[Math.max(maxDim * 1.6, 8), 16, "#d8d0c0", "#e6e0d2"]} position={[0, 0.02, 0]} />
          <Suspense fallback={null}>
            {items.map((item) =>
              modelPathFor(item.category) ? (
                <FurnitureModel key={item.itemId} item={item} width={widthM} length={lengthM} />
              ) : (
                <FurnitureMesh key={item.itemId} item={item} width={widthM} length={lengthM} />
              )
            )}
          </Suspense>
          {obstacles.map((o, i) => (
            <ObstacleMesh key={i} obstacle={o} width={widthM} length={lengthM} height={heightM} />
          ))}
        </group>
        <OrbitControls makeDefault enableDamping target={[0, heightM * 0.4, 0]} />
        <ExportBridge
          widthM={widthM}
          lengthM={lengthM}
          heightM={heightM}
          items={items}
          obstacles={obstacles}
          onReady={handleReady}
        />
      </Canvas>
      <span className="pointer-events-none absolute bottom-3 left-3 z-10 rounded-full bg-paper/90 px-2.5 py-1 text-[11px] font-medium tracking-wide text-mute">
        Hover a piece for details
      </span>
      <div className="absolute bottom-3 right-3 z-10 flex gap-2">
        <button
          type="button"
          onClick={() => {
            void exportApi.current?.exportGLB();
          }}
          className="rounded-full border border-hair bg-paper/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm transition-colors hover:bg-paper"
        >
          Download .glb
        </button>
        <button
          type="button"
          onClick={() => exportApi.current?.exportPNG()}
          className="rounded-full border border-hair bg-paper/90 px-2.5 py-1 text-[11px] font-medium text-ink shadow-sm transition-colors hover:bg-paper"
        >
          Download PNG
        </button>
      </div>
    </div>
  );
}