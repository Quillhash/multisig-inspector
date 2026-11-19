"use client";

import { ChevronDown } from "lucide-react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import {
  getChainIconUrl,
  getSupportedChain,
  getVisibleChains,
  type SupportedChain,
} from "@/lib/chains/chains";
import { cn } from "@/lib/utils/cn";

type NetworkSelectProps = {
  value: number | null;
  onChange: (chainId: number | null) => void;
  className?: string;
  allowedChainIds?: readonly number[];
  ariaLabel?: string;
};

export function NetworkSelect({ value, onChange, className, allowedChainIds, ariaLabel }: NetworkSelectProps) {
  const [open, setOpen] = useState(false);
  const [showTestnets, setShowTestnets] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const toggleId = useId();

  const visibleChains = getVisibleChains(showTestnets).filter(
    (chain) => !allowedChainIds || allowedChainIds.includes(chain.id),
  );
  const mainnetChains = visibleChains.filter(
    (chain) => chain.networkType === "mainnet",
  );
  const testnetChains = visibleChains.filter(
    (chain) => chain.networkType === "testnet",
  );

  const selectedChain = value ? getSupportedChain(value) : null;

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  function toggleTestnets() {
    setShowTestnets((current) => {
      const next = !current;
      if (!next && selectedChain?.networkType === "testnet") {
        onChange(null);
      }
      return next;
    });
  }

  function selectChain(chain: SupportedChain) {
    onChange(chain.id);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className={cn(
          inputClassName,
          "mt-2 flex w-full items-center justify-between gap-2 text-left",
          !selectedChain && "text-muted",
        )}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {selectedChain ? (
            <>
              <ChainIcon chain={selectedChain} />
              <span className="truncate">{selectedChain.name}</span>
            </>
          ) : (
            "Choose a network"
          )}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Networks"
          className="glass-panel absolute top-[calc(100%+6px)] z-50 max-h-80 w-full overflow-hidden rounded-2xl border text-left shadow-[var(--shadow-pop)]"
        >
          <div className="flex items-center justify-between gap-3 border-b border-rule bg-accent-soft px-3 py-2.5">
            <label
              htmlFor={toggleId}
              className="text-[0.8rem] font-medium text-muted"
            >
              Show testnets
            </label>
            <button
              id={toggleId}
              type="button"
              role="switch"
              aria-label="Show testnets"
              aria-checked={showTestnets}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                showTestnets ? "bg-accent" : "bg-rule-strong",
              )}
              onClick={(event) => {
                event.stopPropagation();
                toggleTestnets();
              }}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform",
                  showTestnets && "translate-x-4",
                )}
              />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            <ChainGroup
              label="Mainnets"
              chains={mainnetChains}
              selectedChainId={value}
              onSelect={selectChain}
            />
            {showTestnets ? (
              <ChainGroup
                label="Testnets"
                chains={testnetChains}
                selectedChainId={value}
                onSelect={selectChain}
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChainGroup({
  label,
  chains,
  selectedChainId,
  onSelect,
}: {
  label: string;
  chains: SupportedChain[];
  selectedChainId: number | null;
  onSelect: (chain: SupportedChain) => void;
}) {
  if (!chains.length) {
    return null;
  }

  return (
    <div className="px-1 py-1">
      <div className="px-2 py-1.5 text-[0.667rem] font-semibold tracking-[0.06em] text-muted-faint uppercase">
        {label}
      </div>
      {chains.map((chain) => (
        <button
          key={chain.id}
          type="button"
          role="option"
          aria-label={chain.name}
          aria-selected={selectedChainId === chain.id}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-2xl px-2 py-2 text-left text-[0.867rem] transition",
            selectedChainId === chain.id
              ? "bg-accent-soft text-accent"
              : "hover:bg-accent-soft",
          )}
          onClick={() => onSelect(chain)}
        >
          <ChainIcon chain={chain} />
          <span className="truncate">{chain.name}</span>
        </button>
      ))}
    </div>
  );
}

function ChainIcon({ chain }: { chain: SupportedChain }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[0.6rem] font-bold text-accent uppercase">
        {chain.name.slice(0, 1)}
      </span>
    );
  }

  return (
    <Image
      src={getChainIconUrl(chain)}
      alt=""
      width={20}
      height={20}
      unoptimized
      className="h-5 w-5 shrink-0 rounded-full object-contain"
      onError={() => setFailed(true)}
    />
  );
}

const inputClassName =
  "glass-input h-14 border px-5 text-base outline-none transition-colors";
