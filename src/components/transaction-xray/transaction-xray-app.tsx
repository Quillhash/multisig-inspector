"use client";

import { useState } from "react";
import { ArrowLeft, Loader2, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { inputClassName as inputClass } from "../ui/input";
import { Switch } from "../ui/switch";
import { TabBar } from "../ui/tabs";
import { NetworkSelect } from "../safe-inspector/network-select";
import { SiteHeader } from "../safe-inspector/site-header";
import { analyzeTransaction } from "../../lib/tx-xray/transactionXray";
import { enrichTransaction } from "../../lib/tx-xray/enrichTransaction";
import { parseManualInput } from "../../lib/tx-xray/parseManualInput";
import { parseSafeTxJson } from "../../lib/tx-xray/parseSafeTxJson";
import { parseSafeUrl } from "../../lib/tx-xray/parseSafeUrl";
import { fetchAllSafeTransactions, fetchSafeTransactions, filterExecutableNonceRange, resolveSafeTransaction } from "../../lib/tx-xray/fetchSafeTxFromApi";
import { parseSafeAddressInput } from "../../lib/safe/address";
import { safeAbi } from "../../lib/safe/abi";
import { detectSafeChainsForAddress } from "../../lib/safe/detectChain";
import { createRpcClient } from "../../lib/chains/rpc";
import { resolveCalls } from "../../lib/tx-xray/resolveCalldata";
import { simulateTransaction } from "../../lib/tx-xray/simulate";
import { isSimulationSupportedChain } from "../../lib/tx-xray/simulationChains";
import type { CallResolver, SafeTxInput, TransactionSimulation, XRayResult } from "../../lib/tx-xray/types";
import { TransactionResult } from "./transaction-result";
import { TransactionQueue, type TransactionQueueState } from "./transaction-queue";

type Mode = "manual" | "json" | "safe";
const modeTabs = [
  { value: "safe" as const, label: "Safe Address" },
  { value: "json" as const, label: "JSON" },
  { value: "manual" as const, label: "Manual Input" },
];
const ZERO = "0x0000000000000000000000000000000000000000";

const STORAGE_KEYS = {
  enabled: "xray.layer1.enabled",
  resolve: "xray.resolve.enabled",
};

type TransactionXRayAppProps = {
  enrich?: typeof enrichTransaction;
  detectChains?: typeof detectSafeChainsForAddress;
  fetchQueue?: typeof fetchAllSafeTransactions;
  fetchPage?: typeof fetchSafeTransactions;
  readCurrentNonce?: typeof readCurrentSafeNonce;
};

async function readCurrentSafeNonce(chainId: number, safeAddress: `0x${string}`) {
  try {
    return await createRpcClient(chainId).readContract({
      address: safeAddress,
      abi: safeAbi,
      functionName: "nonce",
    });
  } catch {
    throw new Error("SAFE_NONCE_UNREADABLE");
  }
}

export function TransactionXRayApp(props: TransactionXRayAppProps) {
  return <TransactionXRayAppContent {...props} />;
}

function TransactionXRayAppContent({
  enrich = enrichTransaction,
  detectChains = detectSafeChainsForAddress,
  fetchQueue = fetchAllSafeTransactions,
  fetchPage = fetchSafeTransactions,
  readCurrentNonce = readCurrentSafeNonce,
}: TransactionXRayAppProps) {
  const [mode, setMode] = useState<Mode>("safe");
  const [chainId, setChainId] = useState<number | null>(null);
  const [safeChainId, setSafeChainId] = useState<number | null>(null);
  const [chainChoices, setChainChoices] = useState<number[]>([]);
  const [manual, setManual] = useState<Record<string, string>>({ safeAddress: "", to: "", value: "0", data: "0x", operation: "0", nonce: "0", safeTxHash: "", signatures: "", confirmationsRequired: "" });
  const [json, setJson] = useState("");
  const [jsonSafeAddress, setJsonSafeAddress] = useState("");
  const [jsonSafeError, setJsonSafeError] = useState("");
  const [jsonNetworkError, setJsonNetworkError] = useState("");
  const [safeInput, setSafeInput] = useState("");
  const [txList, setTxList] = useState<TransactionQueueState | null>(null);
  const [selectedPendingKey, setSelectedPendingKey] = useState<string | null>(null);
  const [result, setResult] = useState<XRayResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // External simulation is opt-in because transaction fields leave the browser.
  // Provider credentials stay exclusively in the server environment.
  const [layer1Enabled, setLayer1Enabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.enabled) === "true";
  });

  function persistLayer1(enabled: boolean) {
    setLayer1Enabled(enabled);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEYS.enabled, enabled ? "true" : "false");
  }

  // Online call resolution is a separate opt-in: only the target address and
  // 4-byte selector of an otherwise-unknown call leave the browser.
  const [resolveEnabled, setResolveEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEYS.resolve) === "true";
  });

  function persistResolve(enabled: boolean) {
    setResolveEnabled(enabled);
    if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEYS.resolve, enabled ? "true" : "false");
  }

  async function run(input: SafeTxInput) {
    setLoading(true);
    setError("");
    setSelectedPendingKey(`${input.nonce}-${input.providedSafeTxHash ?? input.safeAddress}`);
    try {
      const enrichment = await enrich(input);
      let simulation: TransactionSimulation | undefined;
      if (layer1Enabled) {
        simulation = await simulateTransaction(input, enrichment);
      }
      let resolver: CallResolver | undefined;
      if (resolveEnabled) {
        resolver = await resolveCalls(input);
      }
      const finalResult = analyzeTransaction(input, enrichment, simulation, resolver);
      setResult(finalResult);
    } catch (cause) {
      setError(humanizeTransactionError(cause));
    } finally {
      setLoading(false);
    }
  }

  async function analyze() {
    setJsonSafeError("");
    setJsonNetworkError("");
    try {
      if (mode === "json") {
        return await run(parseSafeTxJson(json, {
          chainId: chainId ?? undefined,
          safeAddress: jsonSafeAddress.trim() || undefined,
        }));
      }
      if (mode === "manual") {
        if (!chainId) throw new Error("Choose a network.");
        const manualPayload: Record<string, unknown> = { source: "manual", chainId, safeAddress: manual.safeAddress, to: manual.to, value: manual.value, data: manual.data, operation: Number(manual.operation), nonce: manual.nonce, gasToken: ZERO, refundReceiver: ZERO };
        if (manual.safeTxHash.trim()) manualPayload.providedSafeTxHash = manual.safeTxHash.trim();
        if (manual.signatures.trim()) manualPayload.signatures = manual.signatures.trim();
        if (manual.confirmationsRequired.trim()) manualPayload.confirmationsRequired = manual.confirmationsRequired.trim();
        return await run(parseManualInput(manualPayload as Omit<import("../../lib/tx-xray/normalizeSafeTx").RawSafeTx, "source">));
      }
      setLoading(true);
      setError("");
      if (safeInput.trim().startsWith("http")) {
        const parsedUrl = parseSafeUrl(safeInput);
        if (parsedUrl.kind === "transaction" && parsedUrl.transactionId) {
          await run(await resolveSafeTransaction(parsedUrl.chainId, parsedUrl.transactionId));
          return;
        }
      }

      const parsed = parseSafeAddressInput(safeInput);
      const selectedUpFront = parsed.chainId ?? safeChainId;
      const detectedChainIds = selectedUpFront
        ? [selectedUpFront]
        : await detectChains(parsed.address);
      if (detectedChainIds.length === 0) {
        throw new Error("No Safe deployment was found during mainnet auto-detection. If this Safe is on a testnet, choose its network above and try again.");
      }
      if (detectedChainIds.length > 1 && (!safeChainId || !detectedChainIds.includes(safeChainId))) {
        setSafeChainId(null);
        setChainChoices(detectedChainIds);
        throw new Error("This Safe exists on multiple networks. Choose a network and load again.");
      }
      const selectedChainId = selectedUpFront
        ?? (detectedChainIds.length === 1 ? detectedChainIds[0] : safeChainId);
      if (!selectedChainId) {
        throw new Error("Choose a network where this Safe is deployed.");
      }
      if (!detectedChainIds.includes(selectedChainId)) {
        throw new Error("Choose a network where this Safe is deployed.");
      }
      const items = await fetchQueue(selectedChainId, parsed.address, { executed: false });
      const currentNonce = await readCurrentNonce(selectedChainId, parsed.address);
      const executableItems = filterExecutableNonceRange(items, currentNonce);
      setChainChoices([]);
      setChainId(selectedChainId);
      setTxList({ view: "queue", chainId: selectedChainId, safeAddress: parsed.address, items: executableItems });
      setResult(null);
      setSelectedPendingKey(null);
      setLoading(false);
    } catch (cause) {
      const message = humanizeTransactionError(cause);
      if (mode === "json") {
        const technicalMessage = cause instanceof Error ? cause.message : "";
        if (/safeAddress|Safe address/i.test(technicalMessage)) {
          setJsonSafeError("Enter the Safe address for this transaction.");
        }
        if (/chainId/i.test(technicalMessage)) {
          setJsonNetworkError("Choose the network for this transaction.");
        }
      }
      setError(message);
      setLoading(false);
    }
  }

  async function switchView(view: TransactionQueueState["view"]) {
    if (!txList || txList.view === view) return;
    setLoading(true);
    setError("");
    try {
      const items = view === "history"
        ? (await fetchPage(txList.chainId, txList.safeAddress, { executed: true, limit: 20 })).results
        : filterExecutableNonceRange(
            await fetchQueue(txList.chainId, txList.safeAddress, { executed: false }),
            await readCurrentNonce(txList.chainId, txList.safeAddress),
          );
      setTxList({
        view,
        chainId: txList.chainId,
        safeAddress: txList.safeAddress,
        items,
      });
      setResult(null);
      setSelectedPendingKey(null);
    } catch (cause) {
      setError(humanizeTransactionError(cause));
    } finally {
      setLoading(false);
    }
  }

  const importButtonLabel = getImportButtonLabel(mode, safeInput, loading);

  function switchMode(nextMode: Mode) {
    if (nextMode === "json" && !jsonSafeAddress.trim() && safeInput.trim()) {
      try {
        setJsonSafeAddress(parseSafeAddressInput(safeInput).address);
      } catch {
        // Keep the fallback empty until a valid Safe address is known.
      }
    }
    setMode(nextMode);
    setError("");
    setJsonSafeError("");
    setJsonNetworkError("");
    setTxList(null);
    setChainChoices([]);
    setSelectedPendingKey(null);
    setResult(null);
  }

  function updateJson(nextJson: string) {
    setJson(nextJson);
    setJsonSafeError("");
    setJsonNetworkError("");
    const embeddedSafeAddress = readEmbeddedSafeAddress(nextJson);
    if (embeddedSafeAddress) setJsonSafeAddress(embeddedSafeAddress);
  }

  return (
    <div className="text-foreground">
      <SiteHeader active="xray" />
      <section className="qa-container qa-hero qa-hero--tight page-enter">
        <p className="qa-eyebrow qa-eyebrow--hero qa-center-mobile">Transaction Inspector</p>
        <h1 className="qa-h1 qa-h1--product qa-center-mobile mt-4 max-w-[24ch] max-lg:mx-auto">Decode and verify a Safe transaction <span className="qa-accent">before signing.</span></h1>
        <p className="qa-body-lg qa-center-mobile mt-6 max-w-[64ch] text-muted max-lg:mx-auto">Transaction Inspector shows what a Safe transaction changes and recomputes its hash so you can match it against your signing device. Decoding, hash verification, and reputation checks run locally by default.</p>
      </section>
      <main id="main" className="qa-container page-enter page-enter-delay-1 grid items-start gap-4 pt-12 pb-24 lg:grid-cols-[400px_1fr]">
        <aside className="space-y-3 lg:sticky lg:top-28 lg:self-start">
        <Card>
          <TabBar tabs={modeTabs} active={mode} onChange={switchMode} />
          <div className="p-4">
            {mode === "manual" ? <Manual chainId={chainId} setChainId={setChainId} value={manual} setValue={setManual} /> : mode === "json" ? (
              <div className="space-y-3">
                <label className="block text-sm font-semibold">Network <span className="font-normal text-muted">(if JSON omits chainId)</span><NetworkSelect value={chainId} onChange={(nextChainId) => { setChainId(nextChainId); setJsonNetworkError(""); }} className={jsonNetworkError ? "rounded-2xl ring-2 ring-critical/25" : undefined} />{jsonNetworkError ? <span className="mt-1.5 block text-xs font-medium text-critical">{jsonNetworkError}</span> : null}</label>
                <label className="block text-sm font-semibold">Safe address <span className="font-normal text-muted">(required if JSON omits it)</span><input aria-label="JSON Safe address" aria-invalid={Boolean(jsonSafeError)} className={`${inputClass} ${jsonSafeError ? "border-critical/50 bg-critical-soft ring-2 ring-critical/15" : ""}`} value={jsonSafeAddress} onChange={(event) => { setJsonSafeAddress(event.target.value); setJsonSafeError(""); }} placeholder="0x..." />{jsonSafeError ? <span className="mt-1.5 block text-xs font-medium text-critical">{jsonSafeError}</span> : null}</label>
                <label className="block text-sm font-semibold">Safe transaction JSON<textarea aria-label="Safe transaction JSON" className={`${inputClass} h-56 py-3 font-mono text-xs`} value={json} onChange={(event) => updateJson(event.target.value)} /></label>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-semibold">Safe address or transaction URL<input className={inputClass} value={safeInput} onChange={(event) => { setSafeInput(event.target.value); setChainId(safeChainId); setChainChoices([]); }} placeholder="0x… or https://app.safe.global/…" /></label>
                <div className="mt-3 text-sm font-semibold">
                  <div>Network <span className="font-normal text-muted">(optional)</span></div>
                  <NetworkSelect
                    value={safeChainId}
                    onChange={(nextChainId) => {
                      setSafeChainId(nextChainId);
                      setChainId(nextChainId);
                      setChainChoices([]);
                    }}
                    allowedChainIds={chainChoices.length > 1 ? chainChoices : undefined}
                    ariaLabel="Network"
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted">Leave the network empty to auto-detect supported mainnets. If you know the network, select it to skip detection, including Sepolia and Base Sepolia.</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">Safe Transaction Service is used only as a convenience importer. Imported fields remain untrusted and are independently checked locally where possible.</p>
              </div>
            )}
            <Button className="mt-4 w-full" disabled={loading} onClick={analyze}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {importButtonLabel}
            </Button>
            {error ? <p role="alert" className="mt-3 rounded-2xl border border-critical/30 bg-critical-soft p-3 text-sm text-critical">{error}</p> : null}
            {/* Layer-1 external enrichment controls */}
            <Layer1Controls
              enabled={layer1Enabled}
              setEnabled={persistLayer1}
              chainId={chainId}
            />
            <ResolveControls enabled={resolveEnabled} setEnabled={persistResolve} />
          </div>
        </Card>

        </aside>
        <section>
          {result ? (
            <div className="space-y-3">
              {txList ? <Button variant="secondary" onClick={() => setResult(null)}><ArrowLeft className="h-4 w-4" />Back to transactions</Button> : null}
              <TransactionResult result={result} resolveEnabled={resolveEnabled} />
            </div>
          ) : loading && !txList ? (
            <LoadingPanel mode={mode} />
          ) : txList ? (
              <TransactionQueue
                queue={txList}
                loading={loading}
                selectedKey={selectedPendingKey}
                onSelect={(tx) => run(tx)}
                onSwitchView={switchView}
                onAddLocalDraft={() => {
                  setMode("json");
                  setChainId(txList.chainId);
                  setError("");
                }}
              />
          ) : (
            <div className="glass-panel flex min-h-[28rem] flex-col items-center justify-center gap-3 rounded-3xl border px-6 py-10 text-center">
              <div className="mb-1 grid h-14 w-14 place-items-center rounded-3xl border border-dashed border-rule-strong bg-background text-muted-faint">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 7h16M4 12h10M4 17h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="18" cy="12" r="2" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <h2 className="text-[1.0625rem] font-semibold tracking-tight">No transaction analyzed</h2>
              <p className="max-w-[24rem] text-[0.875rem] leading-relaxed text-muted">Paste a Safe address, enter fields, or paste transaction JSON to begin.</p>
              <p className="text-xs text-muted-faint">The network is detected automatically. If the address exists on multiple networks, choose the intended deployment above.</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function ResolveControls({ enabled, setEnabled }: { enabled: boolean; setEnabled: (value: boolean) => void }) {
  const toggleId = "resolve-unknown-toggle";
  return (
    <div className="glass-chip mt-3 rounded-2xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={toggleId} className="min-w-0 break-words text-sm font-semibold">
          <span className="sm:hidden">Resolve unknown calls</span>
          <span className="hidden sm:inline">Resolve unknown calls online</span>
        </label>
        <Switch
          id={toggleId}
          checked={enabled}
          aria-label="Resolve unknown calls online"
          onClick={() => setEnabled(!enabled)}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Off by default. When on, only the target address and 4-byte selector of
        undecoded calls are sent to public directories (Sourcify for verified
        ABI, then a 4-byte signature database as fallback). Nothing else leaves
        the browser.
      </p>
    </div>
  );
}

function LoadingPanel({ mode }: { mode: Mode }) {
  const title = mode === "safe" ? "Loading transactions" : "Analyzing transaction";
  const sub =
    mode === "safe"
      ? "Fetching the Safe queue and signature status…"
      : "Decoding, verifying the hash, and scoring risk locally…";
  return (
    <div className="glass-panel flex min-h-[28rem] flex-col items-center justify-center gap-3 rounded-3xl border px-6 py-10 text-center">
      <div className="scan-orb mb-1 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border-2 border-rule bg-accent-soft text-accent">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M4 6h16v12H4z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 10h8M8 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-[1.0625rem] font-semibold tracking-tight">{title}</h2>
      <p className="max-w-[22rem] text-[0.875rem] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}

function getImportButtonLabel(mode: Mode, safeInput: string, loading: boolean) {
  if (loading) {
    return mode === "safe" ? "Loading…" : "Analyzing…";
  }

  if (mode === "safe") {
    try {
      const parsed = parseSafeUrl(safeInput.trim());
      if (parsed.kind === "transaction") return "Import and analyze";
    } catch {
      return "Load transactions";
    }
    return "Load transactions";
  }

  return "Analyze transaction";
}

function readEmbeddedSafeAddress(json: string): string | undefined {
  try {
    const value = JSON.parse(json) as Record<string, unknown>;
    const meta = value.meta && typeof value.meta === "object"
      ? value.meta as Record<string, unknown>
      : undefined;
    const candidate = value.safeAddress ?? value.safe ?? meta?.createdFromSafeAddress;
    if (typeof candidate !== "string") return undefined;
    return parseSafeAddressInput(candidate).address;
  } catch {
    return undefined;
  }
}

function humanizeTransactionError(cause: unknown): string {
  if (!(cause instanceof Error)) return "We could not analyze this transaction. Check the details and try again.";
  const message = cause.message;

  const knownErrors: Array<[RegExp, string]> = [
    [/SAFE_NONCE_UNREADABLE/i, "This wallet no longer behaves like a standard Safe. Its implementation may have been changed or compromised."],
    [/chainId must be a supported positive integer|chainId must be selected/i, "Choose the network for this transaction."],
    [/safeAddress must be a valid address|Safe address must be a valid address/i, "Enter the Safe address for this transaction."],
    [/to must be a valid address|target must be a valid address/i, "Enter a valid transaction target address."],
    [/operation must be 0 \(CALL\) or 1 \(DELEGATECALL\)/i, "Choose a valid operation type: Call or Delegate call."],
    [/data must be 0x-prefixed calldata/i, "Enter valid transaction data beginning with 0x."],
    [/nonce must be an unsigned integer|Safe nonce is required/i, "Enter a valid transaction nonce using numbers only."],
    [/value must be an unsigned integer/i, "Enter a valid transaction value using numbers only."],
    [/safeTxGas must be an unsigned integer/i, "Safe transaction gas must contain numbers only."],
    [/baseGas must be an unsigned integer/i, "Base gas must contain numbers only."],
    [/gasPrice must be an unsigned integer/i, "Gas price must contain numbers only."],
    [/gasToken must be a valid address/i, "Enter a valid gas-token address."],
    [/refundReceiver must be a valid address/i, "Enter a valid refund-receiver address."],
    [/safeTxHash must be 32 bytes/i, "The Safe transaction hash is incomplete or invalid."],
    [/signatures must be a 0x-prefixed hex string/i, "The transaction signatures are not in a valid format."],
    [/Transaction JSON is not valid JSON/i, "The pasted transaction JSON is incomplete or incorrectly formatted."],
  ];

  return knownErrors.find(([pattern]) => pattern.test(message))?.[1] ?? message;
}

function Layer1Controls(props: {
  enabled: boolean;
  setEnabled: (value: boolean) => void;
  chainId: number | null;
}) {
  const supported = isSimulationSupportedChain(props.chainId);
  const toggleId = "external-analysis-toggle";
  return (
    <div className="glass-chip mt-5 rounded-2xl border p-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={toggleId} className="min-w-0 break-words text-sm font-semibold">
          <span className="sm:hidden">GoPlus simulation</span>
          <span className="hidden sm:inline">External Simulation by GoPlus</span>
        </label>
        <Switch
          id={toggleId}
          checked={props.enabled && supported}
          aria-label="External Simulation by GoPlus"
          disabled={!supported}
          onClick={() => supported && props.setEnabled(!props.enabled)}
        />
      </div>
      {props.enabled && supported ? (
        <div className="mt-3 rounded-2xl border border-accent/20 bg-accent-soft p-3">
          <p className="text-xs leading-relaxed text-muted">
            Off by default. When enabled, transaction fields are sent to GoPlus only for a current-state dry run. Provider credentials remain server-side, and results remain in memory until refresh.
          </p>
          <p className="mt-3 text-xs text-muted">Simulation is advisory and does not guarantee later Safe execution.</p>
        </div>
      ) : null}
      {!supported ? (
        <p className="mt-2 text-xs text-muted-faint">GoPlus simulation is available on Ethereum, BNB Chain, and Base only. Select one of these networks to enable.</p>
      ) : null}
    </div>
  );
}
function Manual({ chainId, setChainId, value, setValue }: { chainId: number | null; setChainId: (value: number | null) => void; value: Record<string, string>; setValue: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const field = (name: keyof typeof value) => ({ value: value[name], onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setValue((current) => ({ ...current, [name]: event.target.value })) });
  return (
    <div className="space-y-3">
      <label className="block text-sm font-semibold">Network<NetworkSelect value={chainId} onChange={setChainId} /></label>
      {(["safeAddress", "to", "value", "nonce", "data"] as const).map((name) => (
        <label className="block text-sm font-semibold capitalize" key={name}>{name === "safeAddress" ? "Safe address" : name}<input className={`${inputClass} ${name === "data" || name.includes("Address") ? "font-mono text-xs" : ""}`} {...field(name)} /></label>
      ))}
      <label className="block text-sm font-semibold">Operation<select className={inputClass} {...field("operation")}><option value="0">CALL</option><option value="1">DELEGATECALL</option></select></label>
      <label className="block text-sm font-semibold">Safe transaction hash <span className="font-normal text-muted">(optional, for comparison)</span><input className={`${inputClass} font-mono text-xs`} {...field("safeTxHash")} /></label>
      <label className="block text-sm font-semibold">Confirmations required <span className="font-normal text-muted">(optional)</span><input className={inputClass} {...field("confirmationsRequired")} /></label>
      <label className="block text-sm font-semibold">Packed signatures <span className="font-normal text-muted">(optional, for execution calldata)</span><textarea className={`${inputClass} h-24 py-3 font-mono text-xs`} {...field("signatures")} /></label>
    </div>
  );
}
