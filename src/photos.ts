export type Photo = {
  src: string;
  title: string;
  location: string;
  date: string;
  vertical?: boolean;
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

type PhotoRow = Photo[];

export type PhotoCard = {
  rows: PhotoRow[];
};

export const photoCards: PhotoCard[] = [
  {
    rows: [
      [
        {
          src: "https://drscdn.500px.org/photo/1081223763/m%3D900/v2?sig=2644ee6b56bda6cd5afe00379dde4b75e4331116ec91425082c9422d6f06b822",
          title: "Botanical Garden 2",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
        {
          src: "https://drscdn.500px.org/photo/1081223764/m%3D900/v2?sig=fc9c7d486800cc95ab450ce16998f721bbcf02a587632b983a8251e68e689e1c",
          title: "Botanical Garden 3",
          location: "Barcelona, Spain",
          date: "Jan, 2022",
        },
      ],
      [
        {
          src: "https://drscdn.500px.org/photo/1081223762/m%3D900/v2?sig=ac83285524e7fc320cb6bfeace465fbb0c091dd6625415d71ffae8881b013c24",
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
          src: "https://drscdn.500px.org/photo/1081340893/m%3D900/v2?sig=82c9a30d2f2a66f87ce36debc45a6d29abf3a892c1effe4a4c97ae4fde1448bb",
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          src: "https://drscdn.500px.org/photo/1081340891/m%3D900/v2?sig=13b392310b98606f0a0ff1c0ed8c255837247092481b8acc46eceb63a420aeac",
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
          vertical: true,
        },
      ],
      [
        {
          src: "https://drscdn.500px.org/photo/1081340892/m%3D900/v2?sig=96c1228a6d698d3ff228eb41a2f5dcc99e86856061bea253d2d699db9d631e0c",
          title: "Mountains",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          src: "https://drscdn.500px.org/photo/1081340890/m%3D900/v2?sig=2323dab955085b622fa9bbcc8891e6290db5b6d2a9687fbfdee07b7934ad8a39",
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
          src: "https://drscdn.500px.org/photo/1081340887/m%3D900/v2?sig=493ce29038b73cb1ec36cbdf51cc0cf0ae2b8dd9a2f60d95153b01a9e062f26f",
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
      ],
      [
        {
          src: "https://drscdn.500px.org/photo/1081340889/m%3D900/v2?sig=955abe7298a1f031fd1a3ae8d850587e08e1def2e7b198490e959def25c1aba7",
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
        },
        {
          src: "https://drscdn.500px.org/photo/1081340888/m%3D900/v2?sig=d57038c9ea2ced8f461bfb7638e30c21c05e6d1c2c282115fff60735eb85e265",
          title: "Aguas Calientes in the Rain",
          location: "Machupicchu, Peru",
          date: "Nov, 2023",
          vertical: true,
        },
      ],
    ],
  },
  {
    rows: [
      [
        {
          src: "https://drscdn.500px.org/photo/1081460855/m%3D900/v2?sig=471b88e942d6585a95204145d258bfb4eba96762cda65aaec1365e124129aa70",
          title: "Pisco Fishermen",
          location: "Pisco, Peru",
          date: "Nov, 2023",
          vertical: true,
        },
        {
          src: "https://drscdn.500px.org/photo/1081340883/m%3D900/v2?sig=cc61a5b179eb503d38ae0c348d86f2fa2993141e47bba2895088ec08161db33d",
          title: "Pisco Fishermen",
          location: "Pisco, Peru",
          date: "Nov, 2023",
        },
      ],
      [
        {
          src: "https://drscdn.500px.org/photo/1081340884/m%3D900/v2?sig=8f7f7233787d1dcca4736f93ba081e03088508275a6f77e087c471d58ad284cf",
          title: "Pisco Fishermen",
          location: "Pisco, Peru",
          date: "Nov, 2023",
        },
      ],
    ],
  },
];
