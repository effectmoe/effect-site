import type { ImageMetadata } from 'astro';

type Service = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  image: ImageMetadata;
};

import img1 from '@/assets/services/design.webp';
import img2 from '@/assets/services/develop.webp';
import img3 from '@/assets/services/mobile.webp';
import img4 from '@/assets/services/marketing.webp';

export const services: Service[] = [
  {
    id: "01",
    title: "Design",
    description: "Design web that fuses aesthetics and functionality. Structure, colors and typography aligned with your brand.",
    tags: ["UI/UX Design", "Responsive", "Prototyping"],
    image: img1,
  },
  {
    id: "02",
    title: "Development",
    description: "Clean and optimized code. We create fast, secure and scalable sites using the latest technologies.",
    tags: ["Frontend", "Backend", "Performance"],
    image: img2,
  },
  {
    id: "03",
    title: "Mobile Apps",
    description: "Mobile apps and progressive web apps that bring your business to your users' pockets with maximum efficiency.",
    tags: ["iOS/Android", "PWA", "React Native"],
    image: img3,
  },
  {
    id: "04",
    title: "Marketing",
    description: "Digital strategies that connect. We boost your visibility and convert visitors into loyal customers.",
    tags: ["SEO/SEM", "Content", "Analytics"],
    image: img4,
  }
];
