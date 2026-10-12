import { useEffect, useRef, useState } from "react";
import type { CustomDataSource, Viewer } from "cesium";
import { COMMAND_VIEW, type DirectoryIndex } from "./aor-directory";
import { findCountryAt, type CountryEntry, type CountryIndex, type Polygon } from "./aor-geo";
import { DIMENSION_COLORS, type Dimension, type EvidenceRecord, type WorldEvent } from "./aor-intel-types";
import type { GlobeStatus, GlobeView } from "./aor-view";

type CesiumModule = typeof import("cesium");

export type { GlobeStatus, GlobeView } from "./aor-view";

type Props = {
  token: string;
  index: CountryIndex | null;
  directory: DirectoryIndex | null;
  view: GlobeView;
  evidence: EvidenceRecord[];
  activeLayers: ReadonlySet<Dimension>;
  worldEvents: WorldEvent[];
  focusEvidence: { id: string; nonce: number } | null;
  centerFallback: [number, number] | null;
  /** Elevation above which the CDC malaria text states no transmission; drawn as a terrain tint only when present. */
  altitudeLimitMeters: number | null;
  showAorShading: boolean;
  showMarkers: boolean;
  /** Width of the panel docked on the right; the camera aims past the subject so it sits in the visible map area. */
  rightInsetPx?: number;
  onPickLocation: (id: string) => void;
  onPickSplit: (iso3: string) => void;
  onPickEvidence: (id: string) => void;
  onHoverCountry: (name: string | null) => void;
  onStatus: (status: GlobeStatus) => void;
};

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
  const membersRef = useRef<CustomDataSource | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  // Bumped once the viewer and its data sources exist so overlay effects re-run.
  const [revision, setRevision] = useState(0);

  // --- viewer lifecycle -------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let viewer: Viewer | null = null;
    // A fatal report is final: later terrain/ready/render events must not overwrite it before the workspace has switched to the 2D map.
    let failed = false;
    const report = (next: GlobeStatus) => { if (failed || cancelled) return; if (next.state === "error" && next.fatal) failed = true; propsRef.current.onStatus(next); };
    (async () => {
      try {
        const Cesium = await import("cesium");
        await import("cesium/Build/Cesium/Widgets/widgets.css");
        if (cancelled || !hostRef.current) return;
        cesiumRef.current = Cesium;
        Cesium.Ion.defaultAccessToken = propsRef.current.token;

        // Imagery and terrain come from Cesium ion. If ion rejects the token or cannot be reached the globe would be an empty void,
        // so a failed imagery layer is reported as fatal (the workspace then shows the working 2D map and says why).
        const imageryLayer = Cesium.ImageryLayer.fromProviderAsync(Cesium.createWorldImageryAsync({ style: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS }));
        const terrain = Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true, requestWaterMask: true });
        imageryLayer.errorEvent.addEventListener((error: { message?: string }) => {
          report({ state: "error", fatal: true, message: `Cesium ion imagery did not load${error?.message ? `: ${error.message}` : ""}. The ion token may be invalid or ion unreachable` });
        });
        terrain.errorEvent.addEventListener((error: { message?: string }) => {
          const reason = error?.message || "";
          // A token rejection / exhausted quota needs the alternate account,
          // not a terrain-only fallback that keeps using a throttled token.
          if (/\b(401|403|429)\b|rate[\s-]*limit|quota|too many requests|unauthorized|forbidden|invalid token/i.test(reason)) {
            report({ state: "error", fatal: true, message: `Cesium ion World Terrain authorization or rate limit failure${reason ? `: ${reason}` : ""}.` });
            return;
          }
          // Other terrain errors keep imagery visible on a smooth ellipsoid.
          // Fall back to the smooth ellipsoid so imagery, boundaries and markers still render.
          if (viewer && !viewer.isDestroyed()) { viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider(); viewer.scene.requestRender(); }
          report({ state: "error", message: `Cesium World Terrain did not load${error?.message ? `: ${error.message}` : ""}. Showing imagery without terrain relief.` });
        });

        viewer = new Cesium.Viewer(hostRef.current, {
          animation: false, timeline: false, baseLayerPicker: false, geocoder: false, homeButton: false,
          sceneModePicker: false, navigationHelpButton: false, fullscreenButton: false, infoBox: false,
          selectionIndicator: false, vrButton: false,
          // Render on change instead of every frame: the globe is idle most of the time and the effects below request a frame when they change the scene.
          requestRenderMode: true, maximumRenderTimeChange: Number.POSITIVE_INFINITY,
          baseLayer: imageryLayer,
          terrain,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
        });
        viewerRef.current = viewer;
        const { scene, camera } = viewer;
        scene.globe.depthTestAgainstTerrain = true;
        scene.globe.showGroundAtmosphere = true;
        scene.backgroundColor = Cesium.Color.fromCssColorString("#01050a");
        // Cesium-native image quality only: device-resolution rendering, finer terrain/imagery tiles and edge smoothing.
        viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, 2);
        scene.globe.maximumScreenSpaceError = 1.6;
        scene.postProcessStages.fxaa.enabled = true;
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
        const members = new Cesium.CustomDataSource("aor-members");
        await viewer.dataSources.add(overlay);
        await viewer.dataSources.add(members);
        await viewer.dataSources.add(points);
        overlayRef.current = overlay;
        membersRef.current = members;
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
        const pickIso2 = (iso2: string) => {
          const directory = propsRef.current.directory;
          const location = directory?.byBoundaryIso2.get(iso2);
          if (location) { propsRef.current.onPickLocation(location.id); return; }
          const split = directory?.splitByBoundaryIso2.get(iso2);
          if (split) { propsRef.current.onPickSplit(split.iso3); return; }
          // Directory unavailable: fall back to the polygon's own ISO code so the country can still be opened.
          if (!directory) propsRef.current.onPickLocation(propsRef.current.index?.byIso2.get(iso2)?.iso3 ?? iso2);
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
          const memberId = id?.properties?.locationId?.getValue?.();
          if (typeof memberId === "string") { propsRef.current.onPickLocation(memberId); return; }
          const index = propsRef.current.index;
          const ground = groundPoint(click.position);
          if (!index || !ground) return;
          const hit = findCountryAt(index, ground.lon, ground.lat);
          if (hit) pickIso2(hit.iso2);
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
          const directory = propsRef.current.directory;
          propsRef.current.onHoverCountry(hit ? directory?.byBoundaryIso2.get(hit.iso2)?.name ?? directory?.splitByBoundaryIso2.get(hit.iso2)?.name ?? hit.name : null);
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        // Report readiness once the first terrain/imagery frame has rendered.
        const removeListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener((remaining: number) => {
          if (remaining === 0) { removeListener(); report({ state: "ready" }); }
        });
        viewer.scene.renderError.addEventListener((_scene: unknown, error: unknown) => {
          report({ state: "error", message: error instanceof Error ? error.message : "Cesium render error." });
        });
        window.setTimeout(() => { report({ state: "ready" }); }, 12_000);
      } catch (error) {
        report({ state: "error", fatal: true, message: error instanceof Error ? error.message : "Cesium failed to start." });
      }
    })();
    return () => {
      cancelled = true;
      viewerRef.current = null;
      overlayRef.current = null;
      pointsRef.current = null;
      membersRef.current = null;
      if (viewer && !viewer.isDestroyed()) viewer.destroy();
    };
  }, [props.token]);

  // --- camera: World -> AOR -> Country / territory (angled terrain view) -------------------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    const { view, index, directory, centerFallback } = props;
    if (!Cesium || !viewer || viewer.isDestroyed()) return;
    viewer.camera.cancelFlight();
    // Aim east of the subject by half the docked panel's share of the view, so the subject lands in the visible part of the map.
    const withInset = (sphere: InstanceType<typeof Cesium.BoundingSphere>, range: number) => {
      const inset = propsRef.current.rightInsetPx ?? 0;
      const width = viewer.canvas.clientWidth || 1;
      if (!inset || inset >= width * 0.6) return sphere;
      const fovy = (viewer.camera.frustum as { fovy?: number }).fovy ?? Math.PI / 3;
      const halfHorizontal = Math.tan(fovy / 2) * (width / (viewer.canvas.clientHeight || 1));
      const meters = (inset / width) * range * halfHorizontal;
      const center = Cesium.Cartographic.fromCartesian(sphere.center);
      return new Cesium.BoundingSphere(Cesium.Cartesian3.fromRadians(center.longitude + meters / (6_378_137 * Math.max(Math.cos(center.latitude), 0.2)), center.latitude, 0), sphere.radius);
    };
    if (view.level === "world") {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(WORLD_VIEW.lon, WORLD_VIEW.lat, WORLD_VIEW.height), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 }, duration: 2.4 });
      return;
    }
    if (view.level === "aor" && view.aorId) {
      const command = COMMAND_VIEW[view.aorId];
      const sphere = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(command.center[0], command.center[1], 0), 1);
      viewer.camera.flyToBoundingSphere(withInset(sphere, command.range), { duration: 2.6, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-52), command.range) });
      return;
    }
    if (view.level === "country") {
      const location = view.locationId ? directory?.byId.get(view.locationId) ?? null : null;
      const split = view.splitIso3 ? directory?.splitByIso3.get(view.splitIso3) ?? null : null;
      const boundaryIso2 = location?.boundaryIso2 ?? split?.boundaryIso2 ?? (!directory && view.locationId ? index?.list.find((item) => item.iso3 === view.locationId)?.iso2 : null) ?? null;
      const entry = boundaryIso2 ? index?.byIso2.get(boundaryIso2) : null;
      if (entry) {
        const { west, south, east, north } = entry.focus;
        const sphere = Cesium.BoundingSphere.fromRectangle3D(Cesium.Rectangle.fromDegrees(west, south, east, north));
        // Dive: orbital -> country framing, pitched into an angled terrain view.
        const range = Math.max(sphere.radius * 2.7, 220_000);
        viewer.camera.flyToBoundingSphere(withInset(sphere, range), { duration: 3.4, offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(8), Cesium.Math.toRadians(-38), range) });
        return;
      }
      // No polygon: aim at the directory's reference point. No boundary is invented for it.
      const point = location?.referencePoint ?? (centerFallback ? { lon: centerFallback[0], lat: centerFallback[1] } : null);
      if (point) {
        const sphere = new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(point.lon, point.lat, 0), 1);
        const range = location?.referencePoint ? 420_000 : 90_000;
        viewer.camera.flyToBoundingSphere(withInset(sphere, range), { duration: 3, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-40), range) });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view.nonce, props.index, props.directory, revision]);

  // --- malaria elevation limit: tint terrain above the elevation the source text states -------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!Cesium || !viewer || viewer.isDestroyed()) return;
    const limit = props.altitudeLimitMeters;
    if (!limit) { viewer.scene.globe.material = undefined as never; viewer.scene.requestRender(); return; }
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
    viewer.scene.requestRender();
    return () => { if (!viewer.isDestroyed()) { viewer.scene.globe.material = undefined as never; viewer.scene.requestRender(); } };
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

  // --- AOR boundary overlay: every located polygon is shaded by the registry's command, never by a frontend list --------------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const overlay = overlayRef.current;
    const { index, view, directory, showAorShading } = props;
    if (!Cesium || !overlay || !index) return;
    overlay.entities.removeAll();
    if (!directory || !showAorShading) return;
    const selectedLocation = view.locationId ? directory.byId.get(view.locationId) ?? null : null;
    const selectedIso2 = selectedLocation?.boundaryIso2 ?? (view.splitIso3 ? directory.splitByIso3.get(view.splitIso3)?.boundaryIso2 ?? null : null);
    for (const location of directory.directory.locations) {
      if (!location.boundaryIso2 || !location.command) continue;
      const entry = index.byIso2.get(location.boundaryIso2);
      if (!entry || entry.iso2 === "AQ") continue; // the south-polar ring is not a valid ground polygon; Antarctica is shown as a marker
      const color = COMMAND_VIEW[location.command].color;
      const inAor = location.command === view.aorId;
      const selected = selectedIso2 === entry.iso2;
      if (view.level === "world") addCountryFill(Cesium, overlay, entry, color, 0.16, "aor-fill");
      else if (view.level === "aor") {
        addCountryFill(Cesium, overlay, entry, color, inAor ? 0.24 : 0.04, "aor-fill");
        if (inAor) addCountryOutline(Cesium, overlay, entry, color, 0.7, 1.4, "aor-line");
      } else if (inAor) addCountryOutline(Cesium, overlay, entry, color, selected ? 0.95 : 0.28, selected ? 3 : 1.4, "aor-line");
    }
    // A split ISO entity (United States, French Southern Territories) belongs to more than one command: outline only, neutral.
    for (const split of directory.directory.splitParents) {
      const entry = split.boundaryIso2 ? index.byIso2.get(split.boundaryIso2) : null;
      if (entry) addCountryOutline(Cesium, overlay, entry, "#cbd5e1", 0.55, 1.2, "split-line");
    }
    if (selectedIso2) {
      const entry = index.byIso2.get(selectedIso2);
      if (entry) addCountryOutline(Cesium, overlay, entry, "#e8ffff", 0.98, 3.2, "sel-line");
    }
    viewerRef.current?.scene.requestRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.view.aorId, props.view.level, props.view.locationId, props.view.splitIso3, props.index, props.directory, props.showAorShading, props.token, revision]);

  // --- directory markers: locations with no polygon are points at their reference coordinate (no boundary is drawn) --------------
  useEffect(() => {
    const Cesium = cesiumRef.current;
    const members = membersRef.current;
    const { directory, view, showMarkers } = props;
    if (!Cesium || !members) return;
    members.entities.removeAll();
    if (!directory || !showMarkers) { viewerRef.current?.scene.requestRender(); return; }
    for (const location of directory.directory.locations) {
      if ((location.boundaryIso2 && location.boundaryIso2 !== "AQ") || !location.referencePoint) continue;
      const selected = location.id === view.locationId;
      if (view.level !== "world" && !selected && location.command !== view.aorId) continue;
      const color = Cesium.Color.fromCssColorString(location.command ? COMMAND_VIEW[location.command].color : "#94a3b8");
      members.entities.add({
        id: `member:${location.id}`,
        name: location.name,
        position: Cesium.Cartesian3.fromDegrees(location.referencePoint.lon, location.referencePoint.lat),
        properties: { locationId: location.id },
        point: { pixelSize: selected ? 14 : 8, color: color.withAlpha(0.92), outlineColor: Cesium.Color.WHITE.withAlpha(selected ? 1 : 0.7), outlineWidth: selected ? 2.5 : 1.2, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        label: selected || view.level === "aor" ? { text: location.name, font: "600 12px sans-serif", fillColor: Cesium.Color.fromCssColorString("#e8fbff"), outlineColor: Cesium.Color.fromCssColorString("#020a12"), outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12), disableDepthTestDistance: Number.POSITIVE_INFINITY, scale: 0.9, translucencyByDistance: new Cesium.NearFarScalar(1.5e6, 1, 2.2e7, 0.0) } : undefined,
      });
    }
    viewerRef.current?.scene.requestRender();
  }, [props.directory, props.view.level, props.view.aorId, props.view.locationId, props.showMarkers, props.token, revision]);

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
        if (points.entities.getById(`world:${event.id}`)) continue;
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
    viewerRef.current?.scene.requestRender();
  }, [props.evidence, props.activeLayers, props.worldEvents, props.view.level, props.index, props.token, revision]);

  return <div ref={hostRef} data-testid="aor-cesium-globe" className="aor-cesium-host absolute inset-0 z-0 isolate" aria-label="Interactive CesiumJS globe for AOR Factors" />;
}
