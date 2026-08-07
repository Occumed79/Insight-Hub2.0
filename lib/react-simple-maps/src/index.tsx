import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
  type SVGProps,
} from "react";

type Point = [number, number];

type TopologyTransform = {
  scale: [number, number];
  translate: [number, number];
};

type TopologyGeometry = {
  id?: string | number;
  type: "Polygon" | "MultiPolygon";
  arcs: number[][] | number[][][];
};

type Topology = {
  type: "Topology";
  transform?: TopologyTransform;
  arcs: Point[][];
  objects: {
    states?: {
      type: "GeometryCollection";
      geometries: TopologyGeometry[];
    };
    [key: string]: unknown;
  };
};

export type GeographyData = {
  id?: string | number;
  rsmKey: string;
  d: string;
};

type ProjectionContextValue = {
  width: number;
  height: number;
  scale: number;
};

const ProjectionContext = createContext<ProjectionContextValue>({
  width: 800,
  height: 600,
  scale: 1000,
});

type ComposableMapProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & {
  width?: number;
  height?: number;
  projection?: "geoAlbersUsa" | string;
  projectionConfig?: {
    scale?: number;
  };
  children?: ReactNode;
};

export function ComposableMap({
  width = 800,
  height = 600,
  projection: _projection = "geoAlbersUsa",
  projectionConfig,
  children,
  ...svgProps
}: ComposableMapProps) {
  const value = useMemo(
    () => ({ width, height, scale: projectionConfig?.scale ?? 1000 }),
    [height, projectionConfig?.scale, width],
  );

  return (
    <ProjectionContext.Provider value={value}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} {...svgProps}>
        {children}
      </svg>
    </ProjectionContext.Provider>
  );
}

function decodeArc(topology: Topology, arcRef: number): Point[] {
  const index = arcRef < 0 ? ~arcRef : arcRef;
  const encoded = topology.arcs[index] ?? [];
  const transform = topology.transform;
  let x = 0;
  let y = 0;

  const decoded = encoded.map(([dx, dy]) => {
    x += dx;
    y += dy;
    if (!transform) return [x, y] as Point;
    return [
      x * transform.scale[0] + transform.translate[0],
      y * transform.scale[1] + transform.translate[1],
    ] as Point;
  });

  return arcRef < 0 ? decoded.reverse() : decoded;
}

function stitchRing(topology: Topology, refs: number[]): Point[] {
  const points: Point[] = [];
  refs.forEach((ref, index) => {
    const arc = decodeArc(topology, ref);
    if (index > 0 && arc.length > 0) arc.shift();
    points.push(...arc);
  });
  return points;
}

function radians(value: number): number {
  return (value * Math.PI) / 180;
}

function albersRaw(
  lon: number,
  lat: number,
  centerLon = -96,
  centerLat = 37.5,
  parallel1 = 29.5,
  parallel2 = 45.5,
): Point {
  const lambda = radians(lon);
  const phi = radians(lat);
  const lambda0 = radians(centerLon);
  const phi0 = radians(centerLat);
  const phi1 = radians(parallel1);
  const phi2 = radians(parallel2);

  const n = (Math.sin(phi1) + Math.sin(phi2)) / 2;
  const c = Math.cos(phi1) ** 2 + 2 * n * Math.sin(phi1);
  const rho = Math.sqrt(Math.max(0, c - 2 * n * Math.sin(phi))) / n;
  const rho0 = Math.sqrt(Math.max(0, c - 2 * n * Math.sin(phi0))) / n;
  const theta = n * (lambda - lambda0);

  return [rho * Math.sin(theta), rho0 - rho * Math.cos(theta)];
}

function projectPoint(
  lon: number,
  lat: number,
  id: string | number | undefined,
  context: ProjectionContextValue,
): Point {
  const fips = id === undefined || id === null ? "" : String(id).padStart(2, "0");

  if (fips === "02") {
    const normalizedLon = lon > 0 ? lon - 360 : lon;
    return [
      context.width * 0.055 + ((normalizedLon + 180) / 50) * context.width * 0.245,
      context.height * 0.675 + ((72 - lat) / 22) * context.height * 0.265,
    ];
  }

  if (fips === "15") {
    return [
      context.width * 0.285 + ((lon + 161) / 7) * context.width * 0.15,
      context.height * 0.79 + ((23 - lat) / 6) * context.height * 0.14,
    ];
  }

  if (fips === "72") {
    return [
      context.width * 0.77 + ((lon + 68.2) / 3) * context.width * 0.11,
      context.height * 0.82 + ((19 - lat) / 2.2) * context.height * 0.11,
    ];
  }

  const [x, y] = albersRaw(lon, lat);
  return [
    context.width / 2 + x * context.scale,
    context.height / 2 - y * context.scale,
  ];
}

function ringToPath(
  topology: Topology,
  refs: number[],
  id: string | number | undefined,
  context: ProjectionContextValue,
): string {
  const points = stitchRing(topology, refs);
  if (points.length === 0) return "";

  return `${points
    .map(([lon, lat], index) => {
      const [x, y] = projectPoint(lon, lat, id, context);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join("")}Z`;
}

function geometryToPath(
  topology: Topology,
  geometry: TopologyGeometry,
  context: ProjectionContextValue,
): string {
  if (geometry.type === "Polygon") {
    return (geometry.arcs as number[][])
      .map((ring) => ringToPath(topology, ring, geometry.id, context))
      .join("");
  }

  return (geometry.arcs as number[][][])
    .flatMap((polygon) =>
      polygon.map((ring) => ringToPath(topology, ring, geometry.id, context)),
    )
    .join("");
}

function isTopology(value: unknown): value is Topology {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Topology>;
  return (
    candidate.type === "Topology" &&
    Array.isArray(candidate.arcs) &&
    !!candidate.objects &&
    typeof candidate.objects === "object"
  );
}

type GeographiesProps = {
  geography: string | Topology;
  children: (args: { geographies: GeographyData[] }) => ReactNode;
};

export function Geographies({ geography, children }: GeographiesProps) {
  const context = useContext(ProjectionContext);
  const [topology, setTopology] = useState<Topology | null>(
    typeof geography === "string" ? null : geography,
  );

  useEffect(() => {
    if (typeof geography !== "string") {
      setTopology(geography);
      return;
    }

    const controller = new AbortController();
    let active = true;

    void fetch(geography, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`Map geometry returned HTTP ${response.status}`);
        return response.json() as Promise<unknown>;
      })
      .then((payload) => {
        if (!active || !isTopology(payload)) return;
        setTopology(payload);
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === "AbortError")) return;
        console.error("[state-map] Unable to load map geometry", error);
        setTopology(null);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [geography]);

  const geographies = useMemo<GeographyData[]>(() => {
    if (!topology) return [];
    const states = topology.objects.states;
    if (!states || states.type !== "GeometryCollection") return [];

    return states.geometries.map((geometry, index) => ({
      id: geometry.id,
      rsmKey: `state-${geometry.id ?? index}`,
      d: geometryToPath(topology, geometry, context),
    }));
  }, [context, topology]);

  return <>{children({ geographies })}</>;
}

type GeographyStyle = {
  default?: CSSProperties;
  hover?: CSSProperties;
  pressed?: CSSProperties;
};

type GeographyProps = Omit<SVGProps<SVGPathElement>, "style"> & {
  geography: GeographyData;
  style?: GeographyStyle;
};

export function Geography({
  geography,
  style,
  onMouseEnter,
  onMouseLeave,
  onMouseDown,
  onMouseUp,
  onFocus,
  onBlur,
  ...pathProps
}: GeographyProps) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const resolvedStyle = pressed
    ? { ...(style?.default ?? {}), ...(style?.pressed ?? {}) }
    : hovered
      ? { ...(style?.default ?? {}), ...(style?.hover ?? {}) }
      : style?.default;

  return (
    <path
      {...pathProps}
      d={geography.d}
      style={resolvedStyle}
      onMouseEnter={(event) => {
        setHovered(true);
        onMouseEnter?.(event);
      }}
      onMouseLeave={(event) => {
        setHovered(false);
        setPressed(false);
        onMouseLeave?.(event);
      }}
      onMouseDown={(event) => {
        setPressed(true);
        onMouseDown?.(event);
      }}
      onMouseUp={(event) => {
        setPressed(false);
        onMouseUp?.(event);
      }}
      onFocus={(event) => {
        setHovered(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setHovered(false);
        setPressed(false);
        onBlur?.(event);
      }}
    />
  );
}
