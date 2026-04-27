export type Process = {
  num: string;
  title: string;
  description: string;
  image: ImageMetadata;
  keywords?: string[];
};

import img1 from '@/assets/process/img01.webp';
import img2 from '@/assets/process/img02.webp';
import img3 from '@/assets/process/img03.webp';
import img4 from '@/assets/process/img04.webp';

export const process: Process[] = [
  {
    num: '01',
    title: 'Discovery & Strategy',
    description:
      "Understanding your goals, pain points, audience, and what sets you apart.",
    image: img1,
    keywords: ['WORKFLOW AUDITS', 'MARKET RESEARCH', 'COMPETITOR ANALYSIS', 'STRATEGIC PLANNING']
  },
  {
    num: '02',
    title: 'Design & Prototyping',
    description:
      'Setting up projects, aligning on scope and milestones, and diving into the work.',
    image: img2,
    keywords: ['UI/UX DESIGN', 'WIREFRAMING', 'INTERACTIVE PROTOTYPING', 'DESIGN SYSTEMS']
  },
  {
    num: '03',
    title: 'Developing & Integration',
    description:
      'Sharing initial designs, gathering feedback, and fine-tuning together.',
    image: img3,
    keywords: ['FRONTEND DEVELOPMENT', 'BACKEND ARCHITECTURE', 'API INTEGRATION', 'QUALITY ASSURANCE']
  },
  {
    num: '04',
    title: 'Launch & Growth',
    description:
      'Launching with confidence and supporting your next extraordinary moves.',
    image: img4,
    keywords: ['PERFORMANCE OPTIMIZATION', 'SEO STRATEGY', 'POST-LAUNCH SUPPORT', 'SCALING']
  },
];
