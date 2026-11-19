export type FaqEntry = { question: string; answer: string };

/**
 * Answer-first FAQ shown on the home page and mirrored into FAQPage JSON-LD.
 * Keep each answer self-contained: search and AI answer engines quote them
 * without the surrounding page.
 */
export const HOME_FAQ: FaqEntry[] = [
  {
    question: "What is Multisig Inspector?",
    answer:
      "Multisig Inspector is a free, read-only security toolkit by QuillAudits for Safe (formerly Gnosis Safe) multisig wallets. Safe Inspector scans a Safe's on-chain configuration for risky settings, and Transaction Inspector decodes a Safe transaction and recomputes its hash so signers can verify what they are approving before they sign.",
  },
  {
    question: "How do I check if a Safe multisig is configured securely?",
    answer:
      "Paste the Safe address or a Safe URL into Safe Inspector and run a scan. It reads the owners, approval threshold, enabled modules, guard, fallback handler, singleton and version directly from the chain, then reports findings such as a threshold of 1, a very small owner set, unknown modules or an unrecognized implementation, each with a severity and a recommendation.",
  },
  {
    question: "How do I verify a Safe transaction before signing?",
    answer:
      "Load the transaction into Transaction Inspector by Safe address, Safe URL, Transaction Builder JSON or manual fields. It decodes every action, including batched MultiSend calls, and recomputes the Safe transaction hash locally. Compare that hash character by character with the one on your hardware wallet or signing screen, and only sign if both the decoded intent and the hash match.",
  },
  {
    question: "Do I need to connect a wallet?",
    answer:
      "No. Multisig Inspector has no wallet connector. It never requests private keys, never creates signatures and never submits transactions.",
  },
  {
    question: "Is Multisig Inspector free?",
    answer:
      "Yes. There is no account, sign-up or paywall, and the source code is published under the MIT license.",
  },
  {
    question: "Which networks are supported?",
    answer:
      "Ethereum, Polygon, Arbitrum One, Optimism, Base, Gnosis Chain, BNB Smart Chain and Avalanche C-Chain, plus the Sepolia and Base Sepolia testnets. On mainnets the network is detected automatically from the Safe address.",
  },
  {
    question: "Does it store my Safe data?",
    answer:
      "Configuration snapshots are stored only in your browser's IndexedDB so the next scan can show what changed. There is no report database. Network requests are made for RPC reads and for the optional import, simulation and selector lookup features.",
  },
  {
    question: "Does a clean report mean the Safe is secure?",
    answer:
      "No. A clean report means no known configuration risk was detected. It cannot tell whether the owners are the right people, whether keys are stored safely or whether a matching transaction is actually authorized. Those checks stay with the signers.",
  },
  {
    question: "How is this different from the Safe interface?",
    answer:
      "It is a separate, independent review surface. If the interface a signer normally uses is compromised or misleading, an independent decoder and hash recomputation gives signers a second source to compare against, which is the gap exploited in several large multisig hacks.",
  },
];
