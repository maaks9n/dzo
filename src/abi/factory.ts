// pons v2 factory ABI — subset used by DZO.
// Full ABI at docs.ponsfamily.com/v2. Kept minimal to reduce bundle noise.

export const factoryAbi = [
  {
    type: 'event',
    name: 'TokenLaunched',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'deployer', type: 'address', indexed: true },
      { name: 'curve', type: 'address', indexed: false },
      { name: 'pair', type: 'address', indexed: false },
      { name: 'launchBlock', type: 'uint256', indexed: false },
      { name: 'metadataURI', type: 'string', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PoolGraduated',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'pool', type: 'address', indexed: false },
      { name: 'sqrtPriceX96', type: 'uint160', indexed: false },
    ],
  },
  { type: 'function', name: 'snipeTaxStartBps', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'snipeTaxSeconds', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'launchFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'graduationThreshold', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'currentSnipeTaxBps',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }, { name: 'buyer', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'launchInfo',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'deployer', type: 'address' },
      { name: 'feeRecipient', type: 'address' },
      { name: 'creatorTaxBps', type: 'uint256' },
      { name: 'phase', type: 'uint8' },      // 0 = curve, 1 = sweeping, 2 = pool
      { name: 'pair', type: 'address' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'poolFee', type: 'uint24' },
    ],
  },
  {
    type: 'function',
    name: 'exemptWallets',
    stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [{ type: 'address[]' }],
  },
] as const;
