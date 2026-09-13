import * as THREE from "three";
import { Image, Outlines, useScroll } from "@react-three/drei";
import {
  Component,
  ReactNode,
  Suspense,
  useCallback,
  useRef,
  useState,
  useEffect,
} from "react";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";
import { useRequestedPhotos, wrapPhotoIndex } from "./photoStackLoading";

type Photo = {
  url: string;
  aspectRatio: number;
  vertical: boolean;
};

const PHOTO_BASE_SIZE = 5;

type PhotoCardProps = { url: string; aspectRatio: number; requested: boolean };

class PhotoLoadBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

const PhotoCard = ({ url, aspectRatio, requested }: PhotoCardProps) => {
  const width =
    aspectRatio >= 1 ? PHOTO_BASE_SIZE : PHOTO_BASE_SIZE * aspectRatio;
  const height =
    aspectRatio >= 1 ? PHOTO_BASE_SIZE / aspectRatio : PHOTO_BASE_SIZE;

  const paper = (
    <mesh>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial color="white" />
      <Outlines thickness={0.1} color="black" />
    </mesh>
  );
  if (!requested) return paper;
  return (
    <PhotoLoadBoundary fallback={paper}>
      <Suspense fallback={paper}>
        <Image url={url}>
          <planeGeometry args={[width, height]} />
          <Outlines thickness={0.1} color="black" />
        </Image>
      </Suspense>
    </PhotoLoadBoundary>
  );
};

export const PhotoStack = ({ position }: { position: THREE.Vector3 }) => {
  const photoStackRef = useRef<THREE.Group>(null);
  const photoRefs = useRef<(THREE.Group | null)[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/images/threedimbox/manifest.json", { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("Photo manifest unavailable");
        return res.json();
      })
      .then((data: Photo[]) => setPhotos([...data].reverse()))
      .catch((err) => {
        if (err.name !== "AbortError")
          console.error("Failed to load photo manifest:", err);
      });
    return () => controller.abort();
  }, []);

  if (photoRefs.current.length !== photos.length) {
    photoRefs.current = Array(photos.length).fill(null);
  }
  const [topIndex, setTopIndex] = useState(0);
  const requested = useRequestedPhotos(topIndex, photos.length);
  const scroll = useScroll();

  const handlePhotoClick = useCallback(
    (goBackward: boolean = false) => {
      // Scroll to bottom
      if (scroll.el && scroll.offset < 1) {
        scroll.el.scrollTo({
          top: scroll.el.scrollHeight,
          behavior: "smooth",
        });
      }

      if (scroll.offset > 0.9 && photos.length > 0) {
        setTopIndex((index) =>
          wrapPhotoIndex(index + (goBackward ? -1 : 1), photos.length),
        );
      }
    },
    [scroll, photos.length],
  );

  // Add keyboard event listener for spacebar
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.code === "Space" || event.code === "ArrowRight") {
        event.preventDefault(); // Prevent page scroll
        handlePhotoClick();
      }
      if (event.code === "ArrowLeft") {
        event.preventDefault(); // Prevent page scroll
        handlePhotoClick(true);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [handlePhotoClick]);

  const getPhotoPos = (index: number) => {
    return new THREE.Vector3(
      Math.sin(index * 0.7) * 0.25,
      Math.sin(index * 0.9 + 0.5) * 0.25,
      (photos.length - index) * 0.01,
    );
  };

  const getPhotoRot = (index: number) => {
    return new THREE.Euler(0, 0, Math.sin(index * 0.5) * 0.2 + index * 0.1);
  };

  useFrame((state, delta) => {
    if (photoStackRef.current) {
      easing.damp3(
        photoStackRef.current.scale,
        scroll.offset > 0.9 ? 1.1 : 1,
        0.1,
        delta,
      );
      easing.damp3(
        photoStackRef.current.position,
        scroll.offset > 0.9
          ? new THREE.Vector3(0, window.innerWidth < 500 ? 4 : 6, 0)
          : position,
        0.1,
        delta,
      );
    }
    for (let i = 0; i < photos.length; i++) {
      const photo = photoRefs.current[i];
      if (photo) {
        const targetIndex = (i - topIndex + photos.length) % photos.length;
        easing.damp3(photo.position, getPhotoPos(targetIndex), 0.1, delta);
        easing.dampE(photo.rotation, getPhotoRot(targetIndex), 0.1, delta);
      }
    }
  });

  return (
    <group
      ref={photoStackRef}
      position={position}
      rotation={new THREE.Euler(-Math.PI / 2, 0, 0)}
      onClick={(event) => {
        // R3F also delivers a click to every intersected card behind this one.
        // Consume the nearest hit before the functional index update: one
        // physical click must advance once, not once per overlapping card.
        event.stopPropagation();
        handlePhotoClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {photos.map((photo, index) => (
        <group key={photo.url} ref={(el) => (photoRefs.current[index] = el)}>
          <PhotoCard
            url={photo.url}
            aspectRatio={photo.aspectRatio}
            requested={requested.has(index)}
          />
        </group>
      ))}
    </group>
  );
};
