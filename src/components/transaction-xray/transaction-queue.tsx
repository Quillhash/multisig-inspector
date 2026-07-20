import { History, Plus } from "lucide-react";
import { Button } from "../ui/button";
import {
  classifySafeTransaction,
  isPendingSafeTxImportError,
  type PendingSafeTxItem,
  type SafeTxQueueStatus,
} from "../../lib/tx-xray/fetchSafeTxFromApi";
import type { SafeTxInput } from "../../lib/tx-xray/types";
import { cn } from "@/lib/utils/cn";

export type TransactionQueueState = {
  view: "queue" | "history";
  chainId: number;
  safeAddress: SafeTxInput["safeAddress"];
  items: PendingSafeTxItem[];
};

type TransactionQueueProps = {
  queue: TransactionQueueState;
  loading: boolean;
  selectedKey: string | null;
  onSelect: (transaction: SafeTxInput) => void;
  onSwitchView: (view: TransactionQueueState["view"]) => void;
  onAddLocalDraft?: () => void;
};

const sections: ReadonlyArray<{
  status: SafeTxQueueStatus;
  heading: string;
  empty: string;
  chipClass: string;
}> = [
  {
    status: "awaiting",
    heading: "Awaiting signatures",
    empty: "No transaction is currently waiting for more signatures.",
    chipClass: "border-[#fed7aa] bg-[#fff7ed] text-medium",
  },
  {
    status: "ready",
    heading: "Ready to execute",
    empty: "No transaction has enough signatures to execute.",
    chipClass: "border-success-border bg-success-soft text-success",
  },
];

function shortenAddress(address: string) {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TransactionQueue({
  queue,
  loading,
  selectedKey,
  onSelect,
  onSwitchView,
  onAddLocalDraft,
}: TransactionQueueProps) {
  const validItems = queue.items.filter(
    (item): item is SafeTxInput => !isPendingSafeTxImportError(item),
  );
  const invalidItems = queue.items.filter(isPendingSafeTxImportError);
  const grouped: Record<SafeTxQueueStatus, SafeTxInput[]> = {
    awaiting: [],
    ready: [],
  };
  for (const item of validItems) {
    grouped[classifySafeTransaction(item)].push(item);
  }

  if (queue.view === "history") {
    return (
      <div className="glass-panel rounded-[12px] border p-4 lg:p-5">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[0.9375rem] font-semibold tracking-tight">
              Executed history
            </h2>
            <p className="mt-1 font-mono text-[0.75rem] text-muted-faint">
              {queue.safeAddress} · last 20
            </p>
          </div>
          <Button
            variant="secondary"
            className="h-8 px-3 text-[0.8125rem]"
            disabled={loading}
            onClick={() => onSwitchView("queue")}
          >
            Back to queue
          </Button>
        </div>
        <div className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1 [scrollbar-width:thin]">
          {validItems.length === 0 ? (
            <QueueEmpty>
              There are no executed transactions on this network.
            </QueueEmpty>
          ) : (
            validItems.map((transaction, index) => (
              <TransactionRow
                key={transactionKey(transaction, index)}
                transaction={transaction}
                loading={loading}
                selected={selectedKey === transactionKey(transaction, index)}
                onSelect={onSelect}
                history
              />
            ))
          )}
        </div>
        <ImportErrors items={invalidItems} />
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-[12px] border p-4 lg:p-5">
      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[0.9375rem] font-semibold tracking-tight">
            Queued transactions
          </h2>
          <p className="mt-1 break-all font-mono text-[0.75rem] text-muted-faint">
            {queue.safeAddress}
          </p>
        </div>
        <Button
          variant="secondary"
          className="h-8 px-3 text-[0.8125rem]"
          disabled={loading}
          onClick={() => onSwitchView("history")}
        >
          <History className="h-3.5 w-3.5" />
          History
        </Button>
      </div>

      <div className="glass-chip mb-3.5 flex flex-wrap gap-x-5 gap-y-2 rounded-[12px] border px-4 py-3 text-[0.8125rem] text-muted">
        <span>
          Local drafts — <strong className="font-semibold text-foreground tabular-nums">0</strong>
        </span>
        <span>
          Awaiting signatures —{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {grouped.awaiting.length}
          </strong>
        </span>
        <span>
          Ready to execute —{" "}
          <strong className="font-semibold text-foreground tabular-nums">
            {grouped.ready.length}
          </strong>
        </span>
      </div>

      <div className="grid gap-3 min-[900px]:grid-cols-3">
        <QueueColumn
          heading="Local drafts"
          count={0}
          chipClass="border-rule bg-white/60 text-muted"
        >
          <QueueEmpty>
            Unsigned Transaction Builder drafts stay in the creator&apos;s Safe
            app until they are proposed, so they cannot be discovered from a Safe
            address. Import one manually to check it before signing.
          </QueueEmpty>
          {onAddLocalDraft ? (
            <div className="mt-auto p-1">
              <Button
                variant="secondary"
                className="h-8 w-full px-3 text-[0.8125rem]"
                onClick={onAddLocalDraft}
              >
                <Plus className="h-3.5 w-3.5" />
                Add a local draft
              </Button>
              <p className="mt-2 px-1 text-[0.6875rem] leading-relaxed text-muted-faint">
                Paste the Transaction Builder JSON export, or switch to Manual to
                enter the fields shown in the Safe app.
              </p>
            </div>
          ) : null}
        </QueueColumn>

        {sections.map(({ status, heading, empty, chipClass }) => (
          <QueueColumn
            key={status}
            heading={heading}
            count={grouped[status].length}
            chipClass={chipClass}
          >
            {grouped[status].length === 0 ? (
              <QueueEmpty>{empty}</QueueEmpty>
            ) : (
              grouped[status].map((transaction, index) => (
                <TransactionRow
                  key={transactionKey(transaction, index)}
                  transaction={transaction}
                  loading={loading}
                  selected={selectedKey === transactionKey(transaction, index)}
                  onSelect={onSelect}
                  ready={status === "ready"}
                />
              ))
            )}
          </QueueColumn>
        ))}
      </div>
      <ImportErrors items={invalidItems} />
    </div>
  );
}

function QueueColumn({
  heading,
  count,
  chipClass,
  children,
}: {
  heading: string;
  count: number;
  chipClass: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass-chip flex min-h-[12rem] flex-col rounded-[12px] border">
      <div className="flex items-center justify-between gap-2 border-b border-white/70 px-3 py-2.5">
        <h2 className="text-[0.75rem] font-semibold tracking-[0.04em] text-muted uppercase">
          {heading}
        </h2>
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-full border px-1.5 text-[0.6875rem] font-semibold tabular-nums",
            chipClass,
          )}
        >
          {count}
        </span>
      </div>
      <div className="flex max-h-[24rem] flex-1 flex-col gap-1.5 overflow-y-auto p-2 [scrollbar-width:thin]">{children}</div>
    </section>
  );
}

function TransactionRow({
  transaction,
  loading,
  selected,
  onSelect,
  ready = false,
  history = false,
}: {
  transaction: SafeTxInput;
  loading: boolean;
  selected: boolean;
  onSelect: TransactionQueueProps["onSelect"];
  ready?: boolean;
  history?: boolean;
}) {
  const confirmations = transaction.confirmations ?? 0;
  const required = transaction.confirmationsRequired ?? "?";
  const confLabel = history
    ? `Executed · ${confirmations} / ${required}`
    : ready
      ? `${confirmations} / ${required} · ready`
      : `${confirmations} / ${required} confirmations`;

  return (
    <button
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md border p-2.5 text-left transition focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/15 focus-visible:outline-none",
        selected
          ? "border-accent bg-white/90 ring-2 ring-accent/15"
          : "border-white/80 bg-white/70 hover:border-[color-mix(in_srgb,var(--accent)_35%,white)] hover:bg-white/90",
      )}
      disabled={loading}
      onClick={() => onSelect(transaction)}
      type="button"
    >
      <span className="min-w-[2.5rem] font-mono text-[0.75rem] font-semibold text-muted">
        #{transaction.nonce}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[0.75rem] font-semibold">
          Nonce {transaction.nonce}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[0.75rem] text-muted">
          {shortenAddress(transaction.to)}
        </span>
        <span className="mt-0.5 block text-[0.6875rem] text-muted-faint">
          {confLabel}
        </span>
      </span>
      <span className="text-base text-muted-faint" aria-hidden>
        ›
      </span>
    </button>
  );
}

function QueueEmpty({ children }: { children: string }) {
  return (
    <p className="px-3 py-5 text-center text-[0.8125rem] leading-relaxed text-muted-faint">
      {children}
    </p>
  );
}

function ImportErrors({ items }: { items: PendingSafeTxItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {items.map((item, index) => {
        if (!isPendingSafeTxImportError(item)) return null;
        return (
          <div
            className="rounded-md border border-medium/40 bg-warning-soft p-3 text-xs"
            key={`${item.safeTxHash ?? "invalid"}-${index}`}
          >
            <div className="font-semibold text-medium">
              Could not import{" "}
              {item.nonce !== undefined
                ? `nonce ${item.nonce}`
                : `queue item ${item.index + 1}`}
            </div>
            <p className="mt-1 leading-relaxed text-muted">{item.message}</p>
          </div>
        );
      })}
    </div>
  );
}

function transactionKey(transaction: SafeTxInput, index: number) {
  return `${transaction.nonce}-${transaction.providedSafeTxHash ?? index}`;
}
