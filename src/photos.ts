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

const barcelonaBotanicalGarden: PhotoCard = {
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
};

const piscoFishermen: PhotoCard = {
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
};

export const photoCards2022: PhotoCard[] = [
  barcelonaBotanicalGarden,
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
  piscoFishermen,
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
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7909.jpg`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
      ],
      [
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF7995.jpg`,
          title: "Colca Canyon",
          location: "Arequipa, Peru",
          date: "Nov, 2023",
          aspect: "vertical",
        },
        {
          src: `${process.env.PUBLIC_URL}/images/2023/DSCF8025.jpg`,
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

export const homeCards: PhotoCard[] = [
  barcelonaBotanicalGarden,
  piscoFishermen,
];
