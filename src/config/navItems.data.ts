export type NavItem = {
  title: string;
  href: string;
};

export const navItems: NavItem[] = [
  { title: "Home", href: "/" },
  { title: "Works", href: "/works" },
  { title: "Blog", href: "/blog" },
  { title: "Contact", href: "/contact" },
];

export const footerOtherItems: NavItem[] = [
  { title: "Term of Use", href: "/terms-of-service" },
  { title: "Privacy Policy", href: "/privacy-policy" },
  { title: "Licensing", href: "/licensing" },
  { title: "FAQ", href: "/contact/#faq-section" },
];
