import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, Float, Html, Stars } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------- data types -------------------------------- */

type Word = {
  term: string;
  meaning: string;
  base_form?: string;
  example: string;
  example_en: string;
  mnemonic: string;
  similar: string;
  status: "new" | "learning" | "review";
  interval_days: number;
  health: number;
};

type SubIsland = {
  id: string;
  name: string;
  name_native: string;
  size: number;
  health: number;
  words: Word[];
};

type Domain = {
  id: string;
  name: string;
  name_native: string;
  islands: SubIsland[];
  size: number;
  health: number;
};

type Data = {
  generated_at: string;
  total_words: number;
  overall_health: number;
  domains: Domain[];
};

/* --------------------------------- helpers --------------------------------- */

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function healthColor(health: number) {
  const brown = new THREE.Color("#b08a63");
  const green = new THREE.Color("#3f8f4f");
  return brown.clone().lerp(green, health);
}

function plantColor(health: number) {
  const pale = new THREE.Color("#5f9d67");
  const deep = new THREE.Color("#1f6b3a");
  return pale.clone().lerp(deep, health);
}

/* ---------------------------------- island --------------------------------- */

function DomainIsland({
  domain,
  position,
  selected,
  onSelect,
}: {
  domain: Domain;
  position: [number, number, number];
  selected: boolean;
  onSelect: (id: string | null) => void;
}) {
  const scale = 0.85 + Math.sqrt(domain.size) * 0.24;
  const grass = healthColor(domain.health);
  const leaf = plantColor(domain.health);
  const treeCount = Math.max(1, Math.round(1 + domain.health * 4));

  const rockGeo = useMemo(() => {
    const g = new THREE.ConeGeometry(2.6, 4.2, 9, 5);
    const pos = g.attributes["position"] as THREE.BufferAttribute;
    const r = rng(domain.id.length * 7 + 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const f = y < 2.2 ? 0.4 : 0.05;
      pos.setX(i, pos.getX(i) + (r() - 0.5) * f);
      pos.setY(i, pos.getY(i) + (r() - 0.5) * f * 0.5);
      pos.setZ(i, pos.getZ(i) + (r() - 0.5) * f);
    }
    g.computeVertexNormals();
    return g;
  }, [domain.id]);

  const trees = useMemo(() => {
    const r = rng(domain.id.length * 13 + 9);
    return Array.from({ length: treeCount }, (_, i) => {
      const a = r() * Math.PI * 2;
      const rad = 0.4 + r() * 1.4;
      return {
        p: [Math.cos(a) * rad, 0, Math.sin(a) * rad] as [number, number, number],
        s: 0.55 + r() * 0.5,
        seed: i,
      };
    });
  }, [treeCount, domain.id]);

  const [hovered, setHovered] = useState(false);

  return (
    <Float speed={1.2} rotationIntensity={0.15} floatIntensity={0.8}>
      <group position={position} scale={scale}>
        <mesh geometry={rockGeo} position={[0, -1.6, 0]} rotation={[Math.PI, 0, 0]} castShadow>
          <meshStandardMaterial color="#7a6149" flatShading roughness={1} />
        </mesh>
        <mesh
          position={[0, 0.55, 0]}
          castShadow
          receiveShadow
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = "auto";
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
            onSelect(domain.id);
          }}
        >
          <cylinderGeometry args={[2.55, 2.45, 0.62, 12]} />
          <meshStandardMaterial color={grass} flatShading roughness={0.9} />
        </mesh>
        {trees.map((t, i) => (
          <group key={i} position={t.p} scale={t.s}>
            <mesh position={[0, 0.45, 0]} castShadow>
              <cylinderGeometry args={[0.06, 0.1, 0.9, 6]} />
              <meshStandardMaterial color="#6b4632" flatShading roughness={1} />
            </mesh>
            {[0, 1, 2].map((k) => (
              <mesh key={k} position={[0, 1.0 + k * 0.4, 0]} castShadow>
                <coneGeometry args={[0.5 - k * 0.13, 0.55, 6]} />
                <meshStandardMaterial color={leaf} flatShading roughness={0.95} />
              </mesh>
            ))}
          </group>
        ))}

        {/* floating label */}
        <Html center distanceFactor={14} position={[0, 2.6, 0]} zIndexRange={[20, 0]}>
          <button
            onClick={() => onSelect(domain.id)}
            className={`pointer-events-auto whitespace-nowrap rounded-full border px-3.5 py-1.5 text-left backdrop-blur transition-all ${
              selected || hovered
                ? "border-primary/70 bg-card/95 shadow-xl"
                : "border-border/50 bg-card/75"
            }`}
          >
            <span className="block text-[12px] font-semibold leading-tight text-card-foreground">
              {domain.name}
            </span>
            <span className="block text-[10px] leading-tight text-muted-foreground">
              {domain.name_native} · {domain.size} words
            </span>
          </button>
        </Html>
      </group>
    </Float>
  );
}

/* -------------------------------- camera rig -------------------------------- */

function CameraRig({ target }: { target: [number, number, number] }) {
  const dest = useRef(new THREE.Vector3(...target));
  dest.current.set(target[0], target[1], target[2]);
  useFrame(({ camera, controls }) => {
    const c = controls as unknown as { target: THREE.Vector3; update: () => void } | null;
    if (!c || !c.target) return;
    const prev = c.target.clone();
    if (prev.distanceTo(dest.current) < 0.01) return;
    c.target.lerp(dest.current, 0.05);
    camera.position.add(c.target.clone().sub(prev));
    c.update();
  });
  return null;
}

/* ----------------------------------- UI ------------------------------------ */

function statusBadge(status: Word["status"], days: number) {
  const base = "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ";
  if (status === "new") return `${base} bg-sky-200/70 text-sky-900`;
  if (status === "learning") return `${base} bg-amber-200/80 text-amber-900`;
  return `${base} bg-emerald-200/80 text-emerald-900`;
}

function Panel({ domain, onClose }: { domain: Domain | null; onClose: () => void }) {
  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center p-4 transition-all duration-500 sm:right-4 sm:left-auto sm:top-1/2 sm:bottom-auto sm:w-[340px] sm:-translate-y-1/2 sm:p-0 ${
        domain ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
      }`}
    >
      {domain && (
        <article className="pointer-events-auto relative max-h-[78vh] w-full overflow-y-auto rounded-xl border border-border/60 bg-card/90 p-4 pr-5 shadow-xl backdrop-blur-xl">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-primary">
            {domain.name_native} · {Math.round(domain.health * 100)}% healthy
          </p>
          <h2 className="mt-0.5 font-display text-lg leading-tight text-card-foreground">{domain.name}</h2>

          {domain.islands.map((isl) => (
            <section key={isl.id} className="mt-3 border-t border-border/60 pt-2">
              <h3 className="text-[11px] font-semibold text-card-foreground">
                {isl.name} <span className="font-normal text-muted-foreground">{isl.name_native}</span>
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  · {isl.size} words · {Math.round(isl.health * 100)}%
                </span>
              </h3>
              <ul className="mt-1.5 space-y-2">
                {isl.words.map((w) => (
                  <li key={w.term} className="text-[11px] leading-snug">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-card-foreground">
                        {w.term}
                        {w.base_form ? <span className="ml-1 font-normal text-muted-foreground">({w.base_form})</span> : null}
                      </span>
                      <span className={statusBadge(w.status, w.interval_days)}>
                        {w.status}
                        {w.status === "review" && w.interval_days ? ` · ${w.interval_days}d` : ""}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{w.meaning}</p>
                    {w.example ? <p className="italic text-muted-foreground/80">“{w.example}”</p> : null}
                    {w.example_en ? <p className="text-muted-foreground/70">{w.example_en}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </article>
      )}
    </div>
  );
}

/* ---------------------------------- scene ----------------------------------- */

export default function LanguageIslands() {
  const [data, setData] = useState<Data | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    fetch("/data.json")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  const positions = useMemo(() => {
    if (!data) return [];
    const n = data.domains.length;
    return data.domains.map((_, i) => {
      const a = (i / n) * Math.PI * 2;
      const rad = 9 + (n % 2 === 0 ? (i % 2) * 2 : 0);
      return [Math.cos(a) * rad, Math.sin(i * 1.7) * 0.8, Math.sin(a) * rad] as [
        number,
        number,
        number,
      ];
    });
  }, [data]);

  const selectedDomain = data?.domains.find((d) => d.id === selected) ?? null;
  const selectedTarget: [number, number, number] = selectedDomain
    ? (positions[data!.domains.findIndex((d) => d.id === selected)] ?? [0, 0, 0])
    : [0, 0, 0];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[var(--sky)]">
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-5 sm:p-8">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-primary">Your Korean, floating</p>
          <h1 className="font-display text-3xl leading-tight text-foreground sm:text-5xl">Korean Islands</h1>
          <p className="mt-2 max-w-xs text-sm text-muted-foreground">
            {data
              ? `${data.total_words} words across ${data.domains.length} domains · drag to orbit, tap an island.`
              : "Loading your world…"}
          </p>
        </header>
        <footer className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {data ? `${Math.round(data.overall_health * 100)}% overall health` : ""}
        </footer>
      </div>

      <Panel domain={selectedDomain} onClose={() => setSelected(null)} />

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 13, 18], fov: 45 }}
        onPointerMissed={() => setSelected(null)}
      >
        <color attach="background" args={["#f3d9c0"]} />
        <fog attach="fog" args={["#f3d9c0", 30, 80]} />
        <hemisphereLight args={["#ffe9c9", "#4a6b5a", 1.05]} />
        <directionalLight position={[8, 14, 6]} intensity={2.0} color="#fff0d4" castShadow shadow-mapSize={[1024, 1024]} />
        <ambientLight intensity={0.3} />

        <Suspense fallback={null}>
          {data?.domains.map((d, i) => (
            <DomainIsland
              key={d.id}
              domain={d}
              position={positions[i]!}
              selected={selected === d.id}
              onSelect={setSelected}
            />
          ))}
          <Stars radius={60} depth={30} count={1200} factor={2.5} fade speed={0.4} />
          <Environment preset="sunset" />
        </Suspense>
        <CameraRig target={selectedTarget} />
        <OrbitControls
          makeDefault
          enablePan={false}
          minDistance={9}
          maxDistance={40}
          minPolarAngle={Math.PI / 5}
          maxPolarAngle={Math.PI / 1.8}
          enableDamping
          dampingFactor={0.06}
          autoRotate={!selected}
          autoRotateSpeed={0.3}
          target={[0, 0, 0]}
        />
      </Canvas>
    </div>
  );
}
