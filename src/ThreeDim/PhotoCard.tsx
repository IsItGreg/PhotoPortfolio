import * as THREE from "three";
import { Image, useScroll } from "@react-three/drei";
import { useRef, useState, forwardRef } from "react";
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
    <Image ref={ref} url={url} transparent={false}>
      <planeGeometry args={vertical ? [4, 6] : [6, 4]} />
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
    { url: "/images/2022/DSCF4505.webp", vertical: false },
    { url: "/images/2022/DSCF4507.webp", vertical: false },
    { url: "/images/2022/DSCF4509.webp", vertical: false },
    // pisco
    { url: "/images/2023/DSCF7582.webp", vertical: false },
    { url: "/images/2023/DSCF7635.webp", vertical: true },
    { url: "/images/2023/DSCF7602.webp", vertical: false },

    // other
    { url: "/images/2022/DSCF5091.webp", vertical: true },
    { url: "/images/2023/DSCF8140.webp", vertical: false },
    { url: "/images/2023/DSCF7683.webp", vertical: false },
    { url: "/images/2023/DSCF7704.webp", vertical: false },

    { url: "/images/2023/DSCF7995.webp", vertical: true },
    { url: "/images/2023/DSCF7867.webp", vertical: false },

    { url: "/images/2023/DSCF8837.webp", vertical: false },
    { url: "/images/2023/DSCF8814.webp", vertical: true },
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

  const handlePhotoClick = () => {
    // Scroll to bottom
    if (scroll.el && scroll.offset < 1) {
      scroll.el.scrollTo({
        top: scroll.el.scrollHeight,
        behavior: "smooth",
      });
    }

    if (scroll.offset > 0.9) {
      setTopIndex((topIndex + 1) % photos.length);
    }
  };

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
      onClick={handlePhotoClick}
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
