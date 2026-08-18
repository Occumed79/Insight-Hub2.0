import { useEffect, useRef, useState } from "react";

export type HologramRegionKey =
  | "head"
  | "neck"
  | "shoulder"
  | "chest"
  | "lowBack"
  | "upperExtremity"
  | "hand"
  | "hip"
  | "knee"
  | "lowerExtremity"
  | "foot"
  | "wholeBody";

type Props = {
  view: "front" | "back";
  tiltX: number;
  tiltY: number;
  activeRegion: HologramRegionKey | null;
  regionScores: Partial<Record<HologramRegionKey, number>>;
};

type RenderState = {
  renderer: any;
  group: any;
  geometry: any;
  regions: HologramRegionKey[];
  dispose: () => void;
};

const THREE_VERSION = "0.180.0";
const THREE_URL = `https://esm.sh/three@${THREE_VERSION}`;
const GLTF_LOADER_URL = `https://esm.sh/three@${THREE_VERSION}/examples/jsm/loaders/GLTFLoader.js`;
const SURFACE_SAMPLER_URL = `https://esm.sh/three@${THREE_VERSION}/examples/jsm/math/MeshSurfaceSampler.js`;
const HUMAN_ASSET_URL = "https://raw.githubusercontent.com/BoQsc/Godot-3D-Male-Base-Mesh/1.0.3/Original/male_base_mesh.glb";
const POINT_COUNT = 24000;

async function remoteImport(url: string): Promise<any> {
  return import(/* @vite-ignore */ url);
}

function classifyRegion(yNorm: number, xNorm: number): HologramRegionKey {
  if (yNorm >= 0.885) return "head";
  if (yNorm >= 0.82) return "neck";
  if (yNorm >= 0.70 && xNorm >= 0.15) return "shoulder";
  if (yNorm >= 0.40 && xNorm >= 0.19) return yNorm <= 0.50 && xNorm >= 0.24 ? "hand" : "upperExtremity";
  if (yNorm >= 0.54) return "chest";
  if (yNorm >= 0.43) return "lowBack";
  if (yNorm >= 0.34) return "hip";
  if (yNorm >= 0.245) return "lowerExtremity";
  if (yNorm >= 0.175) return "knee";
  if (yNorm >= 0.07) return "lowerExtremity";
  return "foot";
}

function heatColor(score: number): [number, number, number] {
  if (score >= 0.8) return [1, 0.34, 0.48];
  if (score >= 0.6) return [1, 0.70, 0.34];
  if (score >= 0.4) return [0.42, 0.95, 0.85];
  return [0.34, 0.83, 1];
}

function createPointSprite(THREE: any) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, "rgba(255,255,255,1)");
  gradient.addColorStop(0.24, "rgba(225,255,255,.98)");
  gradient.addColorStop(0.50, "rgba(96,235,255,.76)");
  gradient.addColorStop(0.78, "rgba(60,174,255,.20)");
  gradient.addColorStop(1, "rgba(30,120,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function applyRegionColors(
  state: RenderState | null,
  activeRegion: HologramRegionKey | null,
  regionScores: Partial<Record<HologramRegionKey, number>>,
) {
  if (!state) return;
  const colorAttribute = state.geometry.getAttribute("color");
  if (!colorAttribute) return;
  const colors = colorAttribute.array as Float32Array;
  const base: [number, number, number] = [0.40, 0.92, 1.0];

  for (let i = 0; i < state.regions.length; i += 1) {
    const region = state.regions[i];
    const score = regionScores[region] ?? 0;
    const target = activeRegion === region ? heatColor(score) : base;
    const scoreLift = activeRegion !== region && score > 0 ? Math.min(score * 0.08, 0.07) : 0;
    const offset = i * 3;
    colors[offset] = Math.min(1, target[0] + scoreLift);
    colors[offset + 1] = Math.min(1, target[1] + scoreLift);
    colors[offset + 2] = Math.min(1, target[2] + scoreLift);
  }
  colorAttribute.needsUpdate = true;
}

export default function HologramPointCloud({ view, tiltX, tiltY, activeRegion, regionScores }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const renderStateRef = useRef<RenderState | null>(null);
  const propsRef = useRef({ view, tiltX, tiltY, activeRegion, regionScores });
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    propsRef.current = { view, tiltX, tiltY, activeRegion, regionScores };
    applyRegionColors(renderStateRef.current, activeRegion, regionScores);
  }, [view, tiltX, tiltY, activeRegion, regionScores]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let disposed = false;
    let animationFrame = 0;
    let resizeObserver: ResizeObserver | null = null;

    const boot = async () => {
      try {
        setStatus("loading");
        const THREE = await remoteImport(THREE_URL);
        const [{ GLTFLoader }, { MeshSurfaceSampler }] = await Promise.all([
          remoteImport(GLTF_LOADER_URL),
          remoteImport(SURFACE_SAMPLER_URL),
        ]);
        if (disposed) return;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
        renderer.setClearColor(0x000000, 0);
        renderer.domElement.className = "hologram-point-cloud-canvas";
        renderer.domElement.setAttribute("aria-hidden", "true");
        host.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
        camera.position.set(0, 0.03, 6.25);
        camera.lookAt(0, 0, 0);
        const group = new THREE.Group();
        scene.add(group);

        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(HUMAN_ASSET_URL);
        if (disposed) {
          renderer.dispose();
          return;
        }

        gltf.scene.updateMatrixWorld(true);
        const meshes: any[] = [];
        gltf.scene.traverse((object: any) => {
          if (object?.isMesh && object.geometry?.attributes?.position) meshes.push(object);
        });
        if (!meshes.length) throw new Error("Human GLB contains no mesh geometry.");
        meshes.sort((a, b) => (b.geometry.attributes.position.count ?? 0) - (a.geometry.attributes.position.count ?? 0));
        const bodyMesh = meshes[0];
        bodyMesh.updateMatrixWorld(true);

        const sampler = new MeshSurfaceSampler(bodyMesh).build();
        const sample = new THREE.Vector3();
        const rawPoints: any[] = [];
        const bounds = new THREE.Box3();
        bounds.makeEmpty();
        for (let i = 0; i < POINT_COUNT; i += 1) {
          sampler.sample(sample);
          const worldPoint = sample.clone();
          bodyMesh.localToWorld(worldPoint);
          rawPoints.push(worldPoint);
          bounds.expandByPoint(worldPoint);
        }

        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const humanHeight = Math.max(size.y, 0.001);
        const scale = 3.8 / humanHeight;
        const positions = new Float32Array(POINT_COUNT * 3);
        const colors = new Float32Array(POINT_COUNT * 3);
        const regions: HologramRegionKey[] = new Array(POINT_COUNT);

        for (let i = 0; i < POINT_COUNT; i += 1) {
          const point = rawPoints[i];
          const offset = i * 3;
          positions[offset] = (point.x - center.x) * scale;
          positions[offset + 1] = (point.y - center.y) * scale;
          positions[offset + 2] = (point.z - center.z) * scale;
          const yNorm = Math.max(0, Math.min(1, (point.y - bounds.min.y) / humanHeight));
          const xNorm = Math.abs(point.x - center.x) / humanHeight;
          regions[i] = classifyRegion(yNorm, xNorm);
          colors[offset] = 0.40;
          colors[offset + 1] = 0.92;
          colors[offset + 2] = 1.0;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.computeBoundingSphere();
        const sprite = createPointSprite(THREE);
        const coreMaterial = new THREE.PointsMaterial({
          size: 0.035,
          sizeAttenuation: true,
          map: sprite,
          alphaTest: 0.015,
          transparent: true,
          opacity: 0.96,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const haloMaterial = new THREE.PointsMaterial({
          size: 0.09,
          sizeAttenuation: true,
          map: sprite,
          transparent: true,
          opacity: 0.12,
          vertexColors: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        group.add(new THREE.Points(geometry, haloMaterial), new THREE.Points(geometry, coreMaterial));

        const resize = () => {
          const rect = host.getBoundingClientRect();
          const width = Math.max(1, rect.width);
          const height = Math.max(1, rect.height);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };
        renderStateRef.current = {
          renderer,
          group,
          geometry,
          regions,
          dispose: () => {
            geometry.dispose();
            coreMaterial.dispose();
            haloMaterial.dispose();
            sprite?.dispose?.();
            renderer.dispose();
            renderer.domElement.remove();
          },
        };
        applyRegionColors(renderStateRef.current, propsRef.current.activeRegion, propsRef.current.regionScores);
        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        setStatus("ready");

        const start = performance.now();
        const animate = (now: number) => {
          if (disposed) return;
          const current = propsRef.current;
          const idleDrift = Math.sin((now - start) * 0.00038) * 0.018;
          group.rotation.y = (current.view === "back" ? Math.PI : 0) + current.tiltX * 0.12 + idleDrift;
          group.rotation.x = -current.tiltY * 0.055;
          group.rotation.z = current.tiltX * 0.01;
          renderer.render(scene, camera);
          animationFrame = requestAnimationFrame(animate);
        };
        animationFrame = requestAnimationFrame(animate);
      } catch (error) {
        console.error("Hologram mesh failed to load", error);
        if (!disposed) setStatus("error");
      }
    };

    void boot();
    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      renderStateRef.current?.dispose();
      renderStateRef.current = null;
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={`hologram-point-cloud-host is-${status}`}
      data-hologram-source="cc0-male-base-mesh-1.0.3"
      aria-label={`${view === "front" ? "Anterior" : "Posterior"} CC0 human-mesh point-cloud hologram`}
    >
      {status === "loading" && <div className="hologram-asset-state">Loading human mesh…</div>}
      {status === "error" && <div className="hologram-asset-state is-error">Human hologram asset unavailable</div>}
    </div>
  );
}
