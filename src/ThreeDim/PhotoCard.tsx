import * as THREE from "three";
import { Image, Outlines, useScroll } from "@react-three/drei";
import { useRef, useState, forwardRef, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { easing } from "maath";

const PhotoCard = forwardRef<
  THREE.Mesh,
  {
    url: string;
    vertical: boolean;
  }
>(({ url, vertical }, ref) => {
  return (
    <Image ref={ref} url={url}>
      <planeGeometry args={vertical ? [4, 6] : [6, 4]} />
      <Outlines thickness={0.1} color="black" />
    </Image>
  );
});

type Photo = {
  url: string;
  vertical: boolean;
};

export const PhotoStack = ({ position }: { position: THREE.Vector3 }) => {
  const photoStackRef = useRef<THREE.Group>(null);
  const photoRefs = useRef<(THREE.Mesh | null)[]>([]);
  const photos: Photo[] = [
    // botanical garden
    { url: "/images/2022/DSCF4505_bordered.webp", vertical: false },
    { url: "/images/2022/DSCF4507_bordered.webp", vertical: false },
    { url: "/images/2022/DSCF4509_bordered.webp", vertical: false },
    // pisco
    { url: "/images/2023/DSCF7582_bordered.webp", vertical: false },
    { url: "/images/2023/DSCF7635_bordered.webp", vertical: true },
    { url: "/images/2023/DSCF7602_bordered.webp", vertical: false },

    // other
    { url: "/images/2022/DSCF5091_bordered.webp", vertical: true },
    { url: "/images/2023/DSCF8140_bordered.webp", vertical: false },
    { url: "/images/2023/DSCF7683_bordered.webp", vertical: false },
    { url: "/images/2023/DSCF7704_bordered.webp", vertical: true },

    { url: "/images/2023/DSCF7995_bordered.webp", vertical: true },
    { url: "/images/2023/DSCF7867_bordered.webp", vertical: false },

    { url: "/images/2023/DSCF8837_bordered.webp", vertical: false },
    { url: "/images/2023/DSCF8814_bordered.webp", vertical: true },
  ];
  // const photos = [
  //   "/testimgs/1.jpg",
  //   "/testimgs/2.png",
  //   "/testimgs/3.jpg",
  //   "/testimgs/4.jpg",
  //   "/testimgs/5.jpg",
  // ];

  if (photoRefs.current.length !== photos.length) {
    photoRefs.current = Array(photos.length).fill(null);
  }
  const [topIndex, setTopIndex] = useState(0);
  const scroll = useScroll();

  const handlePhotoClick = (goBackward: boolean = false) => {
    // Scroll to bottom
    if (scroll.el && scroll.offset < 1) {
      scroll.el.scrollTo({
        top: scroll.el.scrollHeight,
        behavior: "smooth",
      });
    }

    if (scroll.offset > 0.9) {
      setTopIndex((topIndex + (goBackward ? -1 : 1)) % photos.length);
    }
  };

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
      onClick={() => handlePhotoClick()}
      onPointerOver={(e) => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      {photos.map((photo, index) => (
        <PhotoCard
          key={photo.url}
          ref={(el) => (photoRefs.current[index] = el)}
          url={photo.url}
          vertical={photo.vertical}
        />
      ))}
    </group>
  );
};
