// FAQ data - exported separately from client components for use in server-side SEO scripts

export const faqs = [
  {
    question: 'What is Durabull?',
    answer:
      'Durabull is a modern, powerful dashboard for managing BullMQ queues. It provides real-time monitoring, job debugging, worker tracking, and team collaboration features — all in a beautiful, developer-focused interface.',
  },
  {
    question: 'Do I need to modify my existing BullMQ code?',
    answer:
      "No! Durabull connects directly to your Redis instance and reads BullMQ data structures. Your existing queues, workers, and jobs work without any code changes. Just point us to your Redis and you're ready to go.",
  },
  {
    question: 'Is my data secure?',
    answer:
      'Absolutely. Durabull uses encrypted connections to your Redis instance and never stores your job data. We only read queue metadata for display purposes. Your job payloads and results stay in your Redis.',
  },
  {
    question: 'Can I use Durabull with multiple Redis instances?',
    answer:
      'Yes! Durabull supports multiple connections, making it easy to switch between production, staging, and development environments. Manage all your Redis instances from a single dashboard.',
  },
  {
    question: 'How does pricing work?',
    answer:
      "Durabull is completely free while in beta. When we introduce pricing, it will be kept as low as possible — just enough to cover our cloud compute costs. We're a group of dedicated engineers running this as a break-even venture to create a better BullMQ experience for the community, not to maximize profits.",
  },
  {
    question: 'How can I install Durabull?',
    answer:
      'You can start in the hosted web app, install the native desktop app on Apple Silicon macOS or Windows, or self-host Durabull with Docker or from source. Apple Silicon Macs can also be rolled out with Homebrew using `brew install --cask durabullhq/tap/durabull`, and the documentation includes a dedicated desktop installation guide with direct download links.',
  },
  {
    question: 'Can I run Durabull in authless mode?',
    answer:
      'Yes. Durabull supports authless mode, and you can choose stateful (Postgres) or stateless (PGlite) persistence based on your environment and durability needs. For production, keep authless mode behind private network controls.',
  },
  {
    question: 'What versions of BullMQ are supported?',
    answer:
      'Durabull supports BullMQ v4 and above. We stay up-to-date with the latest BullMQ releases and data structures to ensure compatibility.',
  },
  {
    question: 'Do you offer support?',
    answer:
      'Free tier users have access to our documentation and community Discord. Pro users get priority email support, and Enterprise customers receive dedicated support with SLAs.',
  },
]
