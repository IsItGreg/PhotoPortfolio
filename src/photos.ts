export type Photo = {
  src: string;
  title: string;
  location: string;
  date: string;
  aspect?: "horizontal" | "vertical" | "square";
};

type PhotoRow = Photo[];

export type PhotoCard = {
  rows: PhotoRow[];
};

export const photos: Photo[] = [
  {
    src: "https://drscdn.500px.org/photo/1081223759/m%3D900/v2?sig=851ff8559d6d541db1b84744d363844b0a962bf075ae54f96e236e47cc2e5c04",
    title: "Containers",
    location: "Barcelona, Spain",
    date: "Jan, 2022",
  },
  {
    src: "https://drscdn.500px.org/photo/1081223761/m%3D900/v2?sig=a52f98f7e317497114566207c08e3e4f766c9c7b16a12065a2ad570a54d21a50",
    title: "Faro Verde",
    location: "Barcelona, Spain",
    date: "Jan, 2022",
  },
  {
    src: "https://drscdn.500px.org/photo/1081223765/m%3D900/v2?sig=f67e973138aa71c1324f7eb2fc251175db63964a8b56f025668d1f0b7a6f287c",
    title: "Boston Light",
    location: "Little Brewster Island, USA",
    date: "Aug, 2022",
  },
];

export const photoCards2022: PhotoCard[] = [
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4507.jpg`,
          title: "Botanical Garden 2",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4509.jpg`,
          title: "Botanical Garden 3",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4505.jpg`,
          title: "Botanical Garden 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF3526.jpg`,
          title: "Gondola 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4120.jpg`,
          title: "Ferris Wheel 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF3574.jpg`,
          title: "New World",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4257.jpg`,
          title: "Lighthouse 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4064.jpg`,
          title: "del Jardi'",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF3840.jpg`,
          title: "Containers",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4132.jpg`,
          title: "Gondola 2",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4873.jpg`,
          title: "Bird",
          location: "Not sure",
          date: "Not sure",
          aspect: "horizontal",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4878.jpg`,
          title: "Telephone Pole",
          location: "Not sure",
          date: "Not sure",
          aspect: "vertical",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF5091.jpg`,
          title: "Lighthouse 2",
          location: "Cape Cod, MA",
          date: "Jul, 2022",
          aspect: "vertical",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2022/DSCF4881.jpg`,
          title: "Ferris Wheel 2",
          location: "Montreal, Canada",
          date: "Jun, 2022",
          aspect: "horizontal",
        },
      ],
    ],
  },
];

export const photoCards2023: PhotoCard[] = [
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF6006.jpg`,
          title: "Painters",
          location: "Zasnse Schans, Netherlands",
          date: "Jun, 2023",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF6091.jpg`,
          title: "Library",
          location: "Amsterdam, Netherlands",
          date: "Jun, 2023",
          aspect: "vertical",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF5752.jpg`,
          title: "Speed",
          location: "Netherlands",
          date: "Jun, 2023",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7683.jpg`,
          title: "Desert",
          location: "Huacachina Peru",
          date: "Nov, 2023",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8198.jpg`,
          title: "Rainforest Lake",
          location: "Puerto Maldonado, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7704.jpg`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8140.jpg`,
          title: "Rainforest Boat",
          location: "Puerto Maldonado, Peru",
          date: "Nov, 2023",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8837.jpg`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8814.jpg`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8817.jpg`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8803.jpg`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8739.jpg`,
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8763.jpg`,
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8750.jpg`,
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7635.jpg`,
          title: "Pisco Fishermen",
          location: "Pisco, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7582.jpg`,
          title: "Pisco Fishermen",
          location: "Pisco, Peru",
          date: "Nov, 2023",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7602.jpg`,
          title: "Pisco Fishermen",
          location: "Pisco, Peru",
          date: "Nov, 2023",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7867.jpg`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
        },
        {
          src: "https://drscdn.500px.org/photo/1081461869/m%3D900/v2?sig=6f7993087195014ead0c0b5513957271ffaf4aaea36b8731b789543e4c64f970",
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          src: "https://drscdn.500px.org/photo/1081461868/m%3D900/v2?sig=83cae1831844633d756c46d99b1d131fd29631488e26c939ebc023446bf324ea",
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
        {
          src: "https://drscdn.500px.org/photo/1081461871/m%3D900/v2?sig=89faaa684c357250406ad00d970526195fccadd3b7c891ce674e9a33c6496b6b",
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
        },
      ],
    ],
  },
];

export const photoCards2024: PhotoCard[] = [
  {
    rows: [
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1820.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1896.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1933.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
          aspect: "square",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1897.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
          aspect: "square",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1962.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
          aspect: "square",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1938.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2024/DSCF1998.jpg`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
      ],
    ],
  },
];
