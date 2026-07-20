import {
  getCompatibilityFallbackHandlerDeployments,
  getCreateCallDeployments,
  getDefaultCallbackHandlerDeployments,
  getExtensibleFallbackHandlerDeployments,
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
  getSafeL2SingletonDeployments,
  getSafeSingletonDeployments,
  getSignMessageLibDeployments,
  getSimulateTxAccessorDeployments,
} from "@safe-global/safe-deployments";

export type KnownComponentType =
  | "singleton"
  | "fallback_handler"
  | "module"
  | "guard"
  | "factory"
  | "library";

export type KnownComponent = {
  address: string;
  chainId: number;
  type: KnownComponentType;
  label: string;
  source: string;
};

export type KnownComponentClassification = {
  status: "known" | "unknown";
  label: string;
  source?: string;
};

type Deployment = {
  contractName: string;
  version: string;
  networkAddresses: Record<string, string | string[]>;
};

type DeploymentGetter = (filter?: {
  version?: string;
  released?: boolean;
  network?: string;
}) => Deployment | undefined;

export const SAFE_DEPLOYMENTS_SOURCE_LABEL = "Safe Official Deployment Registry";

const SAFE_DEPLOYMENT_VERSIONS = [
  "1.0.0",
  "1.1.1",
  "1.2.0",
  "1.3.0",
  "1.4.1",
  "1.5.0",
];

const deploymentSources: Array<{
  type: KnownComponentType;
  label: string;
  getDeployment: DeploymentGetter;
}> = [
  {
    type: "singleton",
    label: "Safe Singleton",
    getDeployment: getSafeSingletonDeployments as DeploymentGetter,
  },
  {
    type: "singleton",
    label: "SafeL2 Singleton",
    getDeployment: getSafeL2SingletonDeployments as DeploymentGetter,
  },
  {
    type: "fallback_handler",
    label: "Compatibility Fallback Handler",
    getDeployment: getCompatibilityFallbackHandlerDeployments as DeploymentGetter,
  },
  {
    type: "fallback_handler",
    label: "Extensible Fallback Handler",
    getDeployment: getExtensibleFallbackHandlerDeployments as DeploymentGetter,
  },
  {
    type: "fallback_handler",
    label: "Default Callback Handler",
    getDeployment: getDefaultCallbackHandlerDeployments as DeploymentGetter,
  },
  {
    type: "factory",
    label: "Proxy Factory",
    getDeployment: getProxyFactoryDeployments as DeploymentGetter,
  },
  {
    type: "library",
    label: "MultiSend",
    getDeployment: getMultiSendDeployments as DeploymentGetter,
  },
  {
    type: "library",
    label: "MultiSendCallOnly",
    getDeployment: getMultiSendCallOnlyDeployments as DeploymentGetter,
  },
  {
    type: "library",
    label: "SignMessageLib",
    getDeployment: getSignMessageLibDeployments as DeploymentGetter,
  },
  {
    type: "library",
    label: "CreateCall",
    getDeployment: getCreateCallDeployments as DeploymentGetter,
  },
  {
    type: "library",
    label: "SimulateTxAccessor",
    getDeployment: getSimulateTxAccessorDeployments as DeploymentGetter,
  },
];

let cachedComponents: KnownComponent[] | undefined;

export function getKnownSafeComponents(): KnownComponent[] {
  cachedComponents ??= buildKnownComponents();

  return cachedComponents;
}

export function classifyKnownComponent(
  address: string | null | undefined,
  chainId: number,
  type: KnownComponentType,
): KnownComponentClassification {
  if (!address) {
    return {
      status: "unknown",
      label: `Unknown ${type}`,
    };
  }

  const normalizedAddress = address.toLowerCase();
  const match = getKnownSafeComponents().find(
    (component) =>
      component.address === normalizedAddress &&
      component.chainId === chainId &&
      component.type === type,
  );

  if (!match) {
    return {
      status: "unknown",
      label: `Unknown ${type}`,
    };
  }

  return {
    status: "known",
    label: match.label,
    source: match.source,
  };
}

export function findKnownSafeComponent(
  address: string,
  chainId: number,
): KnownComponent | undefined {
  const normalized = address.toLowerCase();
  return getKnownSafeComponents().find(
    (component) =>
      component.address === normalized && component.chainId === chainId,
  );
}

export function findKnownSafeComponentAnyChain(
  address: string,
): { component: KnownComponent; chainIds: number[] } | undefined {
  const normalized = address.toLowerCase();
  const matches = getKnownSafeComponents().filter(
    (component) => component.address === normalized,
  );
  if (matches.length === 0) return undefined;
  const chainIds = [...new Set(matches.map((match) => match.chainId))];
  return { component: matches[0], chainIds };
}

function buildKnownComponents(): KnownComponent[] {
  const components = new Map<string, KnownComponent>();

  for (const source of deploymentSources) {
    for (const version of SAFE_DEPLOYMENT_VERSIONS) {
      const deployment = source.getDeployment({ version, released: true });

      if (!deployment) {
        continue;
      }

      for (const [chainId, addresses] of Object.entries(
        deployment.networkAddresses,
      )) {
        for (const address of normalizeNetworkAddresses(addresses)) {
          const component: KnownComponent = {
            address,
            chainId: Number(chainId),
            type: source.type,
            label: `${source.label} v${deployment.version}`,
            source: SAFE_DEPLOYMENTS_SOURCE_LABEL,
          };

          components.set(
            `${component.chainId}:${component.type}:${component.address}`,
            component,
          );
        }
      }
    }
  }

  return [...components.values()];
}

function normalizeNetworkAddresses(addresses: string | string[]): string[] {
  return (Array.isArray(addresses) ? addresses : [addresses]).map((address) =>
    address.toLowerCase(),
  );
}
