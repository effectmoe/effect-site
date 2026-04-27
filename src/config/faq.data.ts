export interface FAQ {
  question: string;
  answer: string;
}

export const faqs: FAQ[] = [
  {
    question: "What’s your typical process for a new project?",
    answer:
      'We start with a discovery phase to understand your goals, audience, and competitors. From there, we move into strategy, design, and development—keeping you in the loop at every stage. Each service has its own milestones, but collaboration is constant throughout.',
  },
  {
    question: 'How long does a project usually take?',
    answer:
      'Most projects take 4–10 weeks depending on scope, content readiness, and feedback cycles. After discovery, we’ll share a clear timeline with milestones so you always know what’s next.',
  },
  {
    question: 'Do you offer packages or custom quotes?',
    answer:
      'Both. We have starting packages for common needs, and we also create custom quotes for complex builds. Tell us your goals and we’ll recommend the best path.',
  },
  {
    question: "What’s included in a branding package?",
    answer:
      'Typically: brand strategy, visual identity, logo system, typography & color palette, and usage guidelines. We can also include motion and social templates depending on your needs.',
  },
  {
    question: 'Can you work with our existing dev or marketing team?',
    answer:
      'Yes. We often collaborate with in-house teams, agencies, or freelancers. We can plug into your existing workflow and ship work that’s easy to maintain.',
  }
]
