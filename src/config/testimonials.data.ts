export type Testimonial = {
  id: number;
  quote: string;
  author: string;
  role: string;
  company: string;
};

export type Stat = {
  num: string;
  suffix: string;
  label: string;
};

export const testimonials: Testimonial[] = [
  {
    id: 1,
    quote: "Acacia revamped our website and branding, boosting customer inquiries by 55%. Their creativity, strategy, and attention to detail made the process seamless, exceeding our expectations!",
    author: "Joe Glodberg",
    role: "CEO",
    company: "Larch Agency"
  },
  {
    id: 2,
    quote: "Acacia ransformed our website and brand—customer inquiries jumped 55%! Their creativity and strategic approach exceeded all expectations.",
    author: "Sarah Miller",
    role: "Homeowner",
    company: "Cipres Energy"
  },
  {
    id: 3,
    quote: "We saw a 37% increase in inquiries after Acacia redesign. Their blend of strategy, creativity, and precision made the entire experience effortless.",
    author: "David Chen",
    role: "Operations Director",
    company: "Olmo Studio"
  }
];

export const stats: Stat[] = [
  { num: '10', suffix: '+', label: 'WORKFLOWS AUTOMATED' },
  { num: '60', suffix: '%', label: 'TIME SAVED' },
  { num: '4', suffix: 'x', label: 'PROCESS EFFICIENCY' },
  { num: '90', suffix: '%', label: 'LESS HUMAN ERROR' },
];
