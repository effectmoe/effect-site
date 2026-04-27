export type SocialLink = {
  href: string;
  label: string;
  icon?: string;
};

export type ContactInfo = {
  address: {
    street: string;
    city: string;
    country: string;
  };
  email: string;
  phone: string;
  workingHours: string;
  workingDays: string;
};

export const socialLinks: SocialLink[] = [
  { href: 'https://www.instagram.com/', label: 'Instagram', icon: 'instagram' },
  { href: 'https://www.facebook.com/', label: 'Facebook', icon: 'facebook' },
  { href: 'https://www.linkedin.com/', label: 'LinkedIn', icon: 'linkedin' },
  { href: 'https://twitter.com/', label: 'X.com', icon: 'x' },
];


export const contactInfo: ContactInfo = {
  address: {
    street: "Mendoza, New York",
    city: "NY 11111",
    country: "United States",
  },
  email: "hello@acacia.studio",
  phone: "(+000) 111 222 333",
  workingHours: "Monday - Friday | 9AM - 5PM",
  workingDays: "Sat-Sun: Closed",
};
