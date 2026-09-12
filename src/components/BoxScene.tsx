"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { computeLayout, drawAtlas, remapBoxUVs } from "@/lib/box";
import type { FaceArtwork } from "@/lib/box";
import { useBoxStore } from "@/store/box";

function FitCamera({ L, W, H }: { L: number; W: number; H: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target?: THREE.Vector3;
    update?: () => void;
  } | null;
  useEffect(() => {
    const diag = Math.max(L, W, H);
    const dist = diag * 1.7 + 40;
    camera.position.set(0, dist * 0.38, dist * 1.15);
    camera.lookAt(0, 0, 0);
    if (controls && controls.target) controls.target.set(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [L, W, H, camera, controls]);
  return null;
}

function useDecodedImage(url: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!url) {
      setImg(null);
      return;
    }
    const image = new Image();
    image.crossOrigin = "anonymous";
    (async () => {
      try {
        await image.decode();
        if (!cancelled) setImg(image);
      } catch {
        image.onload = () => !cancelled && setImg(image);
        image.src = url;
      }
    })();
    image.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);
  return img;
}

function BoxMesh() {
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);
  const side = useBoxStore((s) => s.side);
  const showGuides = useBoxStore((s) => s.showGuides);

  const masterUrl = useBoxStore((s) => s.masterImage);
  const masterCrop = useBoxStore((s) => s.masterCrop);
  const masterScale = useBoxStore((s) => s.masterScale);
  const masterImg = useDecodedImage(masterUrl);

  const faces = useBoxStore((s) => s.faces);

  const face0Img = useDecodedImage(faces[0].image);
  const face1Img = useDecodedImage(faces[1].image);
  const face2Img = useDecodedImage(faces[2].image);
  const face3Img = useDecodedImage(faces[3].image);
  const face4Img = useDecodedImage(faces[4].image);
  const face5Img = useDecodedImage(faces[5].image);

  const faceImages = useMemo(
    () => [face0Img, face1Img, face2Img, face3Img, face4Img, face5Img],
    [face0Img, face1Img, face2Img, face3Img, face4Img, face5Img],
  );

  const artworks: (FaceArtwork | null)[] = useMemo(() => {
    return faces.map((face, i) => {
      const img = face.useOverride ? faceImages[i] : masterImg;
      if (!img) return null;
      const crop = face.useOverride ? face.crop : masterCrop;
      const scale = face.useOverride ? face.scale : masterScale;
      return { image: img, crop, scale };
    });
  }, [faces, faceImages, masterImg, masterCrop, masterScale]);

  const geometry = useMemo(() => {
    return new THREE.BoxGeometry(L, H, W);
  }, [L, W, H]);

  useEffect(() => {
    const layout = computeLayout(L, W, H);
    remapBoxUVs(geometry, layout);
  }, [L, W, H, geometry]);

  const texture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const layout = computeLayout(L, W, H);
    const canvas = drawAtlas(layout, artworks, { side, showGuides });
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }, []);

  const lastDrawn = useRef<string>("");
  useEffect(() => {
    if (!texture) return;
    const key = `${L}|${W}|${H}|${side}|${showGuides}|${artworks
      .map((a, i) => {
        if (!a || !a.image) return `${i}:0`;
        const img = a.image;
        const crop = a.crop ? `${a.crop.x},${a.crop.y},${a.crop.width},${a.crop.height}` : "full";
        return `${i}:1|${img.src}|${crop}|${a.scale}`;
      })
      .join("|")}`;
    if (key === lastDrawn.current) return;
    lastDrawn.current = key;

    const layout = computeLayout(L, W, H);
    const canvas = drawAtlas(layout, artworks, { side, showGuides });
    texture.image = canvas;
    texture.needsUpdate = true;
  }, [L, W, H, side, showGuides, artworks, texture]);

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

export function BoxCanvas() {
  const L = useBoxStore((s) => s.L);
  const W = useBoxStore((s) => s.W);
  const H = useBoxStore((s) => s.H);

  return (
    <div className="h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 38, position: [260, 180, 380] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
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
        <Environment resolution={256}>
          <Lightformer intensity={1.1} position={[0, 6, -8]} scale={[12, 8, 1]} color="#ffffff" />
          <Lightformer intensity={0.5} position={[-6, 2, 2]} rotation={[0, Math.PI / 2, 0]} scale={[6, 4, 1]} color="#cfe0ff" />
          <Lightformer intensity={0.35} position={[6, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[6, 3, 1]} color="#ffe9c4" />
          <Lightformer intensity={0.6} position={[0, -8, 0]} scale={[10, 10, 1]} color="#ffffff" />
        </Environment>
      </Canvas>
    </div>
  );
}
