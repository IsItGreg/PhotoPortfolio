export type Photo = {
  yearFilename: string;
  title: string;
  location: string;
  date: string;
  aspect?: "horizontal" | "vertical" | "square";
};

export const getCompressedImageSrc = (yearFilename: string) => {
  return `${process.env.PUBLIC_URL}/images/${yearFilename}.webp`;
};

export const getFullresImageSrc = (yearFilename: string) => {
  return `${process.env.PUBLIC_URL}/images/${yearFilename}.jpg`;
};

type PhotoRow = Photo[];

export type PhotoCard = {
  rows: PhotoRow[];
};

const barcelonaBotanicalGarden: PhotoCard = {
  rows: [
    [
      {
        yearFilename: `2022/DSCF4507`,
        title: "Botanical Garden 2",
        location: "Barcelona, Spain",
        date: "Jan, 2022",
      },
      {
        yearFilename: `2022/DSCF4509`,
        title: "Botanical Garden 3",
        location: "Barcelona, Spain",
        date: "Jan, 2022",
      },
    ],
    [
      {
        yearFilename: `2022/DSCF4505`,
        title: "Botanical Garden 1",
        location: "Barcelona, Spain",
        date: "Jan, 2022",
      },
    ],
  ],
};

const piscoFishermen: PhotoCard = {
  rows: [
    [
      {
        yearFilename: `2023/DSCF7635`,
        title: "Pisco Fishermen",
        location: "Pisco, Peru",
        date: "Nov, 2023",
        aspect: "vertical",
      },
      {
        yearFilename: `2023/DSCF7582`,
        title: "Pisco Fishermen",
        location: "Pisco, Peru",
        date: "Nov, 2023",
      },
    ],
    [
      {
        yearFilename: `2023/DSCF7602`,
        title: "Pisco Fishermen",
        location: "Pisco, Peru",
        date: "Nov, 2023",
      },
    ],
  ],
};

export const photoCards2022: PhotoCard[] = [
  barcelonaBotanicalGarden,
  {
    rows: [
      [
        {
          yearFilename: `2022/DSCF3526`,
          title: "Gondola 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          yearFilename: `2022/DSCF4120`,
          title: "Ferris Wheel 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
      [
        {
          yearFilename: `2022/DSCF3574`,
          title: "New World",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          yearFilename: `2022/DSCF4257`,
          title: "Lighthouse 1",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          yearFilename: `2022/DSCF4064`,
          title: "del Jardi'",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
      [
        {
          yearFilename: `2022/DSCF3840`,
          title: "Containers",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          yearFilename: `2022/DSCF4132`,
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
          yearFilename: `2022/DSCF4873`,
          title: "Bird",
          location: "Not sure",
          date: "Not sure",
          aspect: "horizontal",
        },
        {
          yearFilename: `2022/DSCF4878`,
          title: "Telephone Pole",
          location: "Not sure",
          date: "Not sure",
          aspect: "vertical",
        },
      ],
      [
        {
          yearFilename: `2022/DSCF5091`,
          title: "Lighthouse 2",
          location: "Cape Cod, MA",
          date: "Jul, 2022",
          aspect: "vertical",
        },
        {
          yearFilename: `2022/DSCF4881`,
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
          yearFilename: `2023/DSCF8837`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          yearFilename: `2023/DSCF8814`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          yearFilename: `2023/DSCF8817`,
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          yearFilename: `2023/DSCF8803`,
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
          yearFilename: `2023/DSCF8739`,
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
      ],
      [
        {
          yearFilename: `2023/DSCF8763`,
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          yearFilename: `2023/DSCF8750`,
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
    ],
  },
  piscoFishermen,
  {
    rows: [
      [
        {
          yearFilename: `2023/DSCF7867`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
        },
        {
          yearFilename: `2023/DSCF7909`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          yearFilename: `2023/DSCF7995`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
        {
          yearFilename: `2023/DSCF8025`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          yearFilename: `2023/DSCF6006`,
          title: "Painters",
          location: "Zasnse Schans, Netherlands",
          date: "Jun, 2023",
        },
      ],
      [
        {
          yearFilename: `2023/DSCF6091`,
          title: "Library",
          location: "Amsterdam, Netherlands",
          date: "Jun, 2023",
          aspect: "vertical",
        },
        {
          yearFilename: `2023/DSCF5752`,
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
          yearFilename: `2023/DSCF7683`,
          title: "Desert",
          location: "Huacachina Peru",
          date: "Nov, 2023",
        },
        {
          yearFilename: `2023/DSCF8198`,
          title: "Rainforest Lake",
          location: "Puerto Maldonado, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          yearFilename: `2023/DSCF7704`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
        {
          yearFilename: `2023/DSCF8140`,
          title: "Rainforest Boat",
          location: "Puerto Maldonado, Peru",
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
          yearFilename: `2024/DSCF1820`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
        {
          yearFilename: `2024/DSCF1896`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
      ],
      [
        {
          yearFilename: `2024/DSCF1933`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
          aspect: "square",
        },
        {
          yearFilename: `2024/DSCF1897`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
          aspect: "square",
        },
        {
          yearFilename: `2024/DSCF1962`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
          aspect: "square",
        },
      ],
      [
        {
          yearFilename: `2024/DSCF1938`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
        {
          yearFilename: `2024/DSCF1998`,
          title: "Eclipse",
          location: "Chazy, NY",
          date: "Apr, 2024",
        },
      ],
    ],
  },
];

export const homeCards: PhotoCard[] = [
  barcelonaBotanicalGarden,
  piscoFishermen,
];
