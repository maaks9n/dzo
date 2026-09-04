// pons v2 bonding curve ABI — subset.

export const curveAbi = [
  {
    type: 'event',
    name: 'CurveBuy',
    inputs: [
      { name: 'buyer', type: 'address', indexed: true },
      { name: 'ethIn', type: 'uint256', indexed: false },
      { name: 'tokensOut', type: 'uint256', indexed: false },
      { name: 'taxBps', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'CurveSell',
    inputs: [
      { name: 'seller', type: 'address', indexed: true },
      { name: 'tokensIn', type: 'uint256', indexed: false },
      { name: 'ethOut', type: 'uint256', indexed: false },
      { name: 'taxBps', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'payable',
    inputs: [{ name: 'minTokensOut', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tokensIn', type: 'uint256' }, { name: 'minEthOut', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'reserveEth', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'reserveTokens', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'realQuoteIn', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  {
    type: 'function',
    name: 'quoteBuy',
    stateMutability: 'view',
    inputs: [{ name: 'ethIn', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'quoteSell',
    stateMutability: 'view',
    inputs: [{ name: 'tokensIn', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;
