"use client";

import { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { computeLayout, drawAtlas, remapBoxUVs } from "@/lib/box";
import { useBoxStore } from "@/store/box";

/** Clamp camera so the box never flies out of frame regardless of size. */
function FitCamera({ L, W, H }: { L: number; W: number; H: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;
  useEffect(() => {
    // Look at the front (+z) artwork face, slightly above for depth.
    const diag = Math.max(L, W, H);
    const dist = diag * 1.7 + 40;
    camera.position.set(0, dist * 0.38, dist * 1.15);
    camera.lookAt(0, 0, 0);
    if (controls && controls.target) controls.target.set(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [L, W, H, camera, controls]);
  return null;
}

/**
 * Box with a shared "dieline" atlas texture. Artwork decodes asynchronously, so we
 * (a) await decode() before ever drawing it and (b) keep ONE persistent CanvasTexture
 * and flip needsUpdate=true on every redraw — three.js only re-uploads a canvas to the
 * GPU when the texture is flagged, so a fresh draw after async decode must flag it.
 */
function BoxMesh() {
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);
  const side = useBoxStore((s) => s.side);
  const showGuides = useBoxStore((s) => s.showGuides);
  const artworkUrl = useBoxStore((s) => s.artworkUrl);

  // Decode the artwork image up-front; keep the decoded element in state so the atlas
  // is never drawn before the pixels are ready.
  const [artImage, setArtImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!artworkUrl) {
      setArtImage(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    (async () => {
      try {
        await img.decode(); // throws until pixels are available
        if (!cancelled) setArtImage(img);
      } catch {
        // fallback: wait for load event
        img.onload = () => !cancelled && setArtImage(img);
        img.src = artworkUrl;
      }
    })();
    img.src = artworkUrl; // needed for decode() to have a source in all browsers
    return () => {
      cancelled = true;
    };
  }, [artworkUrl]);

  // geometry rebuilt on dim change (BoxGeometry is indexed w/ per-face groups)
  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(L, H, W); // x=width(L), y=height(H), z=depth(W)
  }, [L, W, H]);

  // layout + per-face UV remap
  useEffect(() => {
    const layout = computeLayout(L, W, H);
    remapBoxUVs(geometry, layout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [L, W, H, geometry]);

  // One persistent CanvasTexture. Redraw into its canvas and flag needsUpdate whenever
  // dims / side / guides / artwork change.
  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const layout = computeLayout(L, W, H);
    const canvas = drawAtlas(layout, null, { side, showGuides });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // texture identity stable for the life of the component

  const lastDrawn = useRef<string>("");
  useEffect(() => {
    if (!texture) return;
    const key = `${L}|${W}|${H}|${side}|${showGuides}|${artImage ? 1 : 0}|${artImage?.src ?? ""}`;
    if (key === lastDrawn.current) return;
    lastDrawn.current = key;

    const layout = computeLayout(L, W, H);
    const canvas = drawAtlas(layout, artImage, { side, showGuides });
    // swap the canvas the texture points at and re-upload to the GPU
    texture.image = canvas;
    texture.needsUpdate = true;
  }, [L, W, H, side, showGuides, artImage, texture]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial map={texture} roughness={0.85} metalness={0.02} />
    </mesh>
  );
}

function Ground() {
  return (
    <ContactShadows
      position={[0, -0.01, 0]}
      opacity={0.4}
      scale={8}
      blur={2.4}
      far={3}
      resolution={512}
      color="#1b1b1b"
    />
  );
}

export interface ExportHandle {
  gl: THREE.WebGLRenderer | null;
  scene: THREE.Scene | null;
  camera: THREE.Camera | null;
}

export const BoxCanvas = forwardRef<ExportHandle>(function BoxCanvas(
  _props,
  ref,
) {
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);

  const internalRef = useRef<ExportHandle>({
    gl: null,
    scene: null,
    camera: null,
  });

  useImperativeHandle(ref, () => internalRef.current, []);

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 38, position: [260, 180, 380] }}
        onCreated={({ gl, scene, camera }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
          internalRef.current = { gl, scene, camera };
        }}
      >
        <color attach="background" args={["#101318"]} />
        <ambientLight intensity={0.35} />
        <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#666666" />
        <directionalLight position={[200, 260, 160]} intensity={1.1} castShadow />
        <directionalLight position={[-220, 120, -180]} intensity={0.35} color="#bfd6ff" />
        <pointLight position={[0, 220, 0]} intensity={0.5} />
        <BoxMesh />
        <Ground />
        <FitCamera L={L} W={W} H={H} />
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={40}
          maxDistance={1600}
          maxPolarAngle={Math.PI / 2}
        />
        {/* Deterministic, offline studio env — no CDN fetch */}
        <Environment resolution={256}>
          <Lightformer
            intensity={1.1}
            position={[0, 6, -8]}
            scale={[12, 8, 1]}
            color="#ffffff"
          />
          <Lightformer
            intensity={0.5}
            position={[-6, 2, 2]}
            rotation={[0, Math.PI / 2, 0]}
            scale={[6, 4, 1]}
            color="#cfe0ff"
          />
          <Lightformer
            intensity={0.35}
            position={[6, 1, 2]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[6, 3, 1]}
            color="#ffe9c4"
          />
          <Lightformer
            intensity={0.6}
            position={[0, -8, 0]}
            scale={[10, 10, 1]}
            color="#ffffff"
          />
        </Environment>
      </Canvas>
    </div>
  );
});
