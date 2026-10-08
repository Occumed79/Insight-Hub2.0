import { useEffect, useRef, useState } from "react";
import type { CustomDataSource, Viewer } from "cesium";
import { COMMANDS, type CommandId } from "@/components/insight/aor-command-registry";
import { findCountryAt, type CountryEntry, type CountryIndex, type Polygon } from "./aor-geo";
import { DIMENSION_COLORS, type Dimension, type EvidenceRecord, type WorldEvent } from "./aor-intel-types";

type CesiumModule = typeof import("cesium");

export type GlobeView = { level: "world" | "aor" | "country"; aorId: CommandId | null; iso2: string | null; nonce: number };
export type GlobeStatus = { state: "loading" | "ready" | "error"; message?: string };

type Props = {
  token: string;
  index: CountryIndex | null;
  view: GlobeView;
  evidence: EvidenceRecord[];
  activeLayers: ReadonlySet<Dimension>;
  worldEvents: WorldEvent[];
  focusEvidence: { id: string; nonce: number } | null;
  centerFallback: [number, number] | null;
  /** Elevation above which the CDC malaria text states no transmission; drawn as a terrain tint only when present. */
  altitudeLimitMeters: number | null;
  onPickCountry: (iso2: string) => void;
  onPickEvidence: (id: string) => void;
  onHoverCountry: (name: string | null) => void;
  onStatus: (status: GlobeStatus) => void;
};

// Camera range (metres) used when framing each combatant command.
const AOR_RANGE: Record<CommandId, number> = { northcom: 9_500_000, southcom: 8_500_000, eucom: 4_800_000, africom: 8_200_000, centcom: 4_600_000, indopacom: 11_500_000 };
const WORLD_VIEW = { lon: 12, lat: 18, height: 22_000_000 };

function ringPositions(Cesium: CesiumModule, ring: number[][]) {
  return Cesium.Cartesian3.fromDegreesArray(ring.flatMap(([lon, lat]) => [lon, lat]));
}

function addCountryOutline(Cesium: CesiumModule, source: CustomDataSource, entry: CountryEntry, color: string, alpha: number, width: number, name: string) {
  const material = Cesium.Color.fromCssColorString(color).withAlpha(alpha);
  entry.polygons.forEach((polygon: Polygon, i) => {
    source.entities.add({ id: `${name}:${entry.iso2}:${i}`, polyline: { positions: ringPositions(Cesium, polygon[0]), width, material, clampToGround: true } });
  });
}

function addCountryFill(Cesium: CesiumModule, source: CustomDataSource, entry: CountryEntry, color: string, alpha: number, name: string) {
  const material = Cesium.Color.fromCssColorString(color).withAlpha(alpha);
  entry.polygons.forEach((polygon: Polygon, i) => {
    source.entities.add({
      id: `${name}:${entry.iso2}:${i}`,
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(ringPositions(Cesium, polygon[0]), polygon.slice(1).map((hole) => new Cesium.PolygonHierarchy(ringPositions(Cesium, hole)))),
        material,
        classificationType: Cesium.ClassificationType.TERRAIN,
      },
    });
  });
}

function clusterIcon(count: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = 44;
  canvas.height = 44;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.fillStyle = "rgba(8,18,28,.88)";
  ctx.strokeStyle = "rgba(180,240,255,.85)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(22, 22, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#e8fbff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(count), 22, 23);
  return canvas.toDataURL();
}

export function AorCesiumGlobe(props: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const overlayRef = useRef<CustomDataSource | null>(null);
  const pointsRef = useRef<CustomDataSource | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  // Bumped once the viewer and its data sources exist so overlay effects re-run.
  const [revision, setRevision] = useState(0);

  // --- viewer lifecycle -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let viewer: Viewer | null = null;
    (async () => {
      try {
        const Cesium = await import("cesium");
        await import("cesium/Build/Cesium/Widgets/widgets.css");
        if (cancelled || !hostRef.current) return;
        cesiumRef.current = Cesium;
        Cesium.Ion.defaultAccessToken = propsRef.current.token;

        viewer = new Cesium.Viewer(hostRef.current, {
          animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
          sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
          selectionIndicator: false, vrButton: false,
          baseLayer: Cesium.ImageryLayer.fromProviderAsync(Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS })),
          terrain: Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true, requestWaterMask: true }),
          skyAtmosphere: new Cesium.SkyAtmosphere(),
        });
        viewerRef.current = viewer;
        const { scene, camera } = viewer;
        scene.globe.depthTestAgainstTerrain = true;
        scene.globe.showGroundAtmosphere = true;
        scene.backgroundColor = Cesium.Color.fromCssColorString("#01050a");
        viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        camera.setView({ destination: Cesium.Cartesian3.fromDegrees(WORLD_VIEW.lon, WORLD_VIEW.lat, WORLD_VIEW.height) });

        const overlay = new Cesium.CustomDataSource("aor-overlay");
        const points = new Cesium.CustomDataSource("aor-points");
        points.clustering.enabled = true;
        points.clustering.pixelRange = 38;
        points.clustering.minimumClusterSize = 3;
        points.clustering.clusterEvent.addEventListener((entities, cluster) => {
          cluster.label.show = false;
          cluster.point.show = false;
          cluster.billboard.show = true;
          cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER;
          cluster.billboard.disableDepthTestDistance = Number.POSITIVE_INFINITY;
          cluster.billboard.image = clusterIcon(entities.length);
        });
        await viewer.dataSources.add(overlay);
        await viewer.dataSources.add(points);
        overlayRef.current = overlay;
        pointsRef.current = points;
        if (!cancelled) setRevision((value) => value + 1);

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        const groundPoint = (position: { x: number; y: number }) => {
          if (!viewer) return null;
          const ray = viewer.camera.getPickRay(new Cesium.Cartesian2(position.x, position.y));
          const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
          if (!cartesian) return null;
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          return { lon: Cesium.Math.toDegrees(cartographic.longitude), lat: Cesium.Math.toDegrees(cartographic.latitude) };
        };
        handler.setInputAction((click: { position: { x: number; y: number } }) => {
          if (!viewer) return;
          const picked = viewer.scene.pick(new Cesium.Cartesian2(click.position.x, click.position.y));
          const id = picked?.id;
          if (Array.isArray(id)) {
            // A cluster: zoom to its members.
            const positions = id.map((entity: { position?: { getValue: (t: unknown) => unknown } }) => entity.position?.getValue(viewer!.clock.currentTime)).filter(Boolean) as InstanceType<typeof Cesium.Cartesian3>[];
            if (positions.length) viewer.camera.flyToBoundingSphere(Cesium.BoundingSphere.fromPoints(positions), { duration: 1.6, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-40), 0) });
            return;
          }
          const evidenceId = id?.properties?.evidenceId?.getValue?.();
          if (typeof evidenceId === "string") { propsRef.current.onPickEvidence(evidenceId); return; }
          const index = propsRef.current.index;
          const ground = groundPoint(click.position);
          if (!index || !ground) return;
          const hit = findCountryAt(index, ground.lon, ground.lat);
          if (hit) propsRef.current.onPickCountry(hit.iso2);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        let lastMove = 0;
        handler.setInputAction((move: { endPosition: { x: number; y: number } }) => {
          const now = performance.now();
          if (now - lastMove < 70 || !viewer) return;
          lastMove = now;
          const index = propsRef.current.index;
          const ground = groundPoint(move.endPosition);
          const hit = index && ground ? findCountryAt(index, ground.lon, ground.lat) : null;
          viewer.scene.canvas.style.cursor = hit ? "pointer" : "";
          propsRef.current.onHoverCountry(hit?.name ?? null);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Report readiness once the first terrain/imagery frame has rendered.
        const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((remaining: number) => {
          if (remaining === 0) { removeListener(); if (!cancelled) propsRef.current.onStatus({ state: "ready" }); }
        });
        viewer.scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
          if (!cancelled) propsRef.current.onStatus({ state: "error", message: error instanceof Error ? error.message : "Cesium render error." });
        });
        window.setTimeout(() => { if (!cancelled) propsRef.current.onStatus({ state: "ready" }); }, 12_000);
      } catch (error) {
        if (!cancelled) propsRef.current.onStatus({ state: "error", message: error instanceof Error ? error.message : "Cesium failed to start." });
      }
    })();
    return () => {
      cancelled = true;
      viewerRef.current = null;
      overlayRef.current = null;
      pointsRef.current = null;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [props.token]);

  // --- camera: World -> AOR -> Country (angled terrain view) -------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const { view, index, centerFallback } = props;
    if (!Cesium || !viewer || viewer.isDestroyed()) return;
    viewer.camera.cancelFlight();
    if (view.level === "world") {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(WORLD_VIEW.lon, WORLD_VIEW.lat, WORLD_VIEW.height), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }, duration: 2.4 });
      return;
    }
    if (view.level === "aor" && view.aorId) {
      const command = COMMANDS.find((item) => item.id === view.aorId);
      if (!command) return;
      const sphere = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(command.center[0], command.center[1], 0), 1);
      viewer.camera.flyToBoundingSphere(sphere, { duration: 2.6, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-52), AOR_RANGE[command.id]) });
      return;
    }
    if (view.level === "country" && view.iso2) {
      const entry = index?.byIso2.get(view.iso2);
      if (entry) {
        const { west, south, east, north } = entry.focus;
        const sphere = Cesium.BoundingSphere.fromRectangle3D(Cesium.Rectangle.fromDegrees(west, south, east, north));
        // Dive: orbital -> country framing, pitched into an angled terrain view.
        viewer.camera.flyToBoundingSphere(sphere, { duration: 3.4, offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(8), Cesium.Math.toRadians(-38), Math.max(sphere.radius * 2.7, 220_000)) });
      } else if (centerFallback) {
        const sphere = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(centerFallback[0], centerFallback[1], 0), 1);
        viewer.camera.flyToBoundingSphere(sphere, { duration: 3, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-40), 90_000) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view.nonce, props.index]);

  // --- malaria elevation limit: tint terrain above the elevation the source text states -------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || viewer.isDestroyed()) return;
    const limit = props.altitudeLimitMeters;
    if (!limit) { viewer.scene.globe.material = undefined as never; return; }
    viewer.scene.globe.material = Cesium.createElevationBandMaterial({
      scene: viewer.scene,
      layers: [{
        entries: [
          { height: limit - 1, color: new Cesium.Color(0.98, 0.75, 0.14, 0) },
          { height: limit, color: new Cesium.Color(0.98, 0.75, 0.14, 0.38) },
        ],
        extendDownwards: true,
        extendUpwards: true,
      }],
    });
    return () => { if (!viewer.isDestroyed()) viewer.scene.globe.material = undefined as never; };
  }, [props.altitudeLimitMeters, revision]);

  // --- terrain-level dive to one piece of evidence ----------------------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const focus = props.focusEvidence;
    if (!Cesium || !viewer || viewer.isDestroyed() || !focus) return;
    const record = props.evidence.find((item) => item.id === focus.id);
    if (!record || record.geometry.type !== "Point") return;
    const [lon, lat] = record.geometry.coordinates;
    viewer.camera.cancelFlight();
    viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(lon, lat, 0), 1), { duration: 2.4, offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(15), Cesium.Math.toRadians(-32), 45_000) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focusEvidence?.nonce]);

  // --- AOR boundary overlay ------------------------------------------------------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const overlay = overlayRef.current;
    const { index, view } = props;
    if (!Cesium || !overlay || !index) return;
    overlay.entities.removeAll();
    const command = COMMANDS.find((item) => item.id === view.aorId);
    if (!command || view.level === "world") return;
    const members = new Set<string>(command.countries);
    for (const iso2 of members) {
      const entry = index.byIso2.get(iso2);
      if (!entry) continue;
      const selected = view.iso2 === iso2;
      if (view.level === "aor") addCountryFill(Cesium, overlay, entry, command.color, 0.1, "aor-fill");
      addCountryOutline(Cesium, overlay, entry, command.color, selected ? 0.95 : view.level === "aor" ? 0.7 : 0.28, selected ? 3 : 1.4, "aor-line");
    }
    if (view.iso2) {
      const entry = index.byIso2.get(view.iso2);
      if (entry) addCountryOutline(Cesium, overlay, entry, "#e8ffff", 0.98, 3.2, "sel-line");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view.aorId, props.view.level, props.view.iso2, props.index, props.token, revision]);

  // --- evidence layers: country shading only where the source supports country geometry; points at real coordinates ---
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const overlay = overlayRef.current;
    const points = pointsRef.current;
    const { index, evidence, activeLayers, worldEvents, view } = props;
    if (!Cesium || !overlay || !points) return;
    points.entities.removeAll();
    overlay.entities.values.filter((entity) => String(entity.id).startsWith("layer-fill")).forEach((entity) => overlay.entities.remove(entity));

    const shaded = new Set<string>();
    for (const record of evidence) {
      if (!activeLayers.has(record.dimension)) continue;
      if (record.geometry.type === "Country" && index) {
        const key = `${record.dimension}:${record.geometry.iso2}`;
        if (shaded.has(key)) continue;
        shaded.add(key);
        const entry = index.byIso2.get(record.geometry.iso2);
        if (entry) addCountryFill(Cesium, overlay, entry, DIMENSION_COLORS[record.dimension], 0.1, `layer-fill-${record.dimension}`);
      } else if (record.geometry.type === "Point") {
        const [lon, lat] = record.geometry.coordinates;
        points.entities.add({
          id: `pt:${record.id}`,
          position: Cesium.Cartesian3.fromDegrees(lon, lat),
          properties: { evidenceId: record.id },
          point: { pixelSize: record.dimension === "disasters" ? 11 : 10, color: Cesium.Color.fromCssColorString(DIMENSION_COLORS[record.dimension]), outlineColor: Cesium.Color.WHITE.withAlpha(0.9), outlineWidth: 1.5, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
      }
    }
    if (view.level !== "country" && activeLayers.has("disasters")) {
      for (const event of worldEvents) {
        points.entities.add({
          id: `world:${event.id}`,
          position: Cesium.Cartesian3.fromDegrees(event.lon, event.lat),
          point: { pixelSize: 8, color: Cesium.Color.fromCssColorString(DIMENSION_COLORS.disasters).withAlpha(0.9), outlineColor: Cesium.Color.WHITE.withAlpha(0.7), outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
      }
    }
    // Re-trigger clustering after repopulating the data source.
    const range = points.clustering.pixelRange;
    points.clustering.pixelRange = 0;
    points.clustering.pixelRange = range;
  }, [props.evidence, props.activeLayers, props.worldEvents, props.view.level, props.index, props.token, revision]);

  return <div ref={hostRef} data-testid="aor-cesium-globe" className="aor-cesium-host absolute inset-0 z-0 isolate" aria-label="Interactive CesiumJS globe for AOR Factors" />;
}
