import * as THREE from "three";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

if (typeof globalThis.FileReader === "undefined") {
  globalThis.FileReader = class {
    constructor() {
      this.result = null;
      this.onload = null;
      this.onloadend = null;
    }
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        const evt = { target: this };
        if (this.onload) this.onload(evt);
        if (this.onloadend) this.onloadend(evt);
      });
    }
  };
}

const outDir = join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "models", "furniture");
mkdirSync(outDir, { recursive: true });

const C = {
  seating: 0x4a6a56,
  table: 0xa9845f,
  storage: 0x7d6a54,
  bed: 0x3f5a4c,
  lighting: 0x2f2d29,
  decor: 0x9aa07f,
  rug: 0xc9b8a0,
  other: 0x8a8172,
};

function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  m.position.set(x, y + h / 2, z);
  return m;
}

function cylinder(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 16) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    new THREE.MeshStandardMaterial({ color, roughness: 0.85 })
  );
  m.position.set(x, y + h / 2, z);
  return m;
}

function sphere(r, color, x = 0, y = 0, z = 0, seg = 20) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(r, seg, seg),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9 })
  );
  m.position.set(x, y + r, z);
  return m;
}

const models = {
  seating() {
    const g = new THREE.Group();
    g.add(box(5.6, 0.55, 2.6, C.seating, 0, 0.85, 0));
    g.add(box(5.6, 1.7, 0.6, C.seating, 0, 1.0, -1.05));
    g.add(box(0.55, 1.1, 2.6, C.seating, -2.7, 0.85, 0));
    g.add(box(0.55, 1.1, 2.6, C.seating, 2.7, 0.85, 0));
    g.add(box(2.55, 0.3, 0.9, C.seating, -1.35, 1.4, -0.55));
    g.add(box(2.55, 0.3, 0.9, C.seating, 1.35, 1.4, -0.55));
    g.add(box(2.55, 0.3, 1.0, C.seating, -1.35, 1.4, 0.55));
    g.add(box(2.55, 0.3, 1.0, C.seating, 1.35, 1.4, 0.55));
    return g;
  },
  table() {
    const g = new THREE.Group();
    g.add(box(2.6, 0.15, 1.6, C.table, 0, 1.25, 0));
    for (const sx of [-1.2, 1.2]) {
      for (const sz of [-0.7, 0.7]) {
        g.add(box(0.12, 1.25, 0.12, C.table, sx, 0, sz));
      }
    }
    return g;
  },
  storage() {
    const g = new THREE.Group();
    g.add(box(2.8, 5.6, 0.9, C.storage, 0, 0, 0));
    for (let i = 1; i <= 3; i++) {
      g.add(box(2.6, 0.12, 0.7, C.storage, 0, i * 1.4, 0));
    }
    return g;
  },
  bed() {
    const g = new THREE.Group();
    g.add(box(4.8, 0.7, 5.8, C.bed, 0, 0, 0));
    g.add(box(4.5, 0.55, 5.4, 0xe7e0d2, 0, 0.7, 0));
    g.add(box(1.2, 0.35, 1.8, 0xf1ece2, -1.2, 1.25, -2.0));
    g.add(box(1.2, 0.35, 1.8, 0xf1ece2, 1.2, 1.25, -2.0));
    return g;
  },
  lighting() {
    const g = new THREE.Group();
    g.add(cylinder(0.45, 0.55, 0.12, C.lighting, 0, 0, 0));
    g.add(cylinder(0.06, 0.06, 5.2, C.lighting, 0, 0.12, 0));
    g.add(cylinder(0.42, 0.6, 0.85, C.lighting, 0, 5.32, 0, 20));
    return g;
  },
  decor() {
    const g = new THREE.Group();
    g.add(cylinder(0.4, 0.32, 0.85, 0xa5714f, 0, 0, 0));
    g.add(cylinder(0.05, 0.05, 1.0, 0x5c6b54, 0, 0.85, 0));
    g.add(sphere(0.55, 0x66805f, 0, 1.6, 0));
    g.add(sphere(0.32, 0x59704f, 0.35, 1.9, 0.2));
    return g;
  },
  rug() {
    const g = new THREE.Group();
    g.add(box(5.0, 0.08, 7.0, C.rug, 0, 0, 0));
    return g;
  },
  other() {
    const g = new THREE.Group();
    g.add(box(2.5, 0.5, 2.3, C.other, 0, 0.8, 0));
    g.add(box(2.5, 1.5, 0.55, C.other, 0, 0.95, -0.95));
    g.add(box(0.45, 1.0, 2.3, C.other, -1.2, 0.8, 0));
    g.add(box(0.45, 1.0, 2.3, C.other, 1.2, 0.8, 0));
    return g;
  },
};

const exporter = new GLTFExporter();

async function save(name, scene) {
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const buf = result instanceof ArrayBuffer ? Buffer.from(result) : Buffer.from(JSON.stringify(result));
        const file = join(outDir, `${name}.glb`);
        writeFileSync(file, buf);
        console.log(`wrote ${file} (${buf.length} bytes)`);
        resolve();
      },
      (err) => reject(err),
      { binary: true }
    );
  });
}

for (const [name, build] of Object.entries(models)) {
  const scene = new THREE.Scene();
  const group = build();
  scene.add(group);
  await save(name, group);
}