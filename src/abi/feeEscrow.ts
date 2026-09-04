export const feeEscrowAbi = [
  {
    type: 'event',
    name: 'Credited',
    inputs: [
      { name: 'token', type: 'address', indexed: true },
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'source', type: 'uint8', indexed: false },  // 0 = curve, 1 = pool
    ],
  },
  {
    type: 'event',
    name: 'Claimed',
    inputs: [
      { name: 'recipient', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'pending',
    stateMutability: 'view',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  { type: 'function', name: 'claim', stateMutability: 'nonpayable', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;
