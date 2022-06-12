import { Network, networks } from './networks'
import { AbiItem } from 'web3-utils'

interface PairData {
  address: string
  collateral: string
  collateralSymbol: string
  asset: string
  assetSymbol: string
  oracle: string
  //oracleData: string;
  borrowers: string[]
}

const kashiPairABI: AbiItem[] = [
  {
    inputs: [],
    name: 'exchangeRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalBorrow',
    outputs: [
      { internalType: 'uint128', name: 'elastic', type: 'uint128' },
      { internalType: 'uint128', name: 'base', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'userCollateralShare',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'userBorrowPart',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'updateExchangeRate',
    outputs: [
      { internalType: 'bool', name: 'updated', type: 'bool' },
      { internalType: 'uint256', name: 'rate', type: 'uint256' },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'users', type: 'address[]' },
      { internalType: 'uint256[]', name: 'maxBorrowParts', type: 'uint256[]' },
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'contract ISwapper', name: 'swapper', type: 'address' },
      { internalType: 'bool', name: 'open', type: 'bool' },
    ],
    name: 'liquidate',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'accrueInfo',
    outputs: [
      { internalType: 'uint64', name: 'interestPerSecond', type: 'uint64' },
      { internalType: 'uint64', name: 'lastAccrued', type: 'uint64' },
      { internalType: 'uint128', name: 'feesEarnedFraction', type: 'uint128' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
]

async function testLiquidation(network: Network, kashiPair: string, borrowers: string[]) {
  if (borrowers.length === 0) return []
  const kashiPaircontractInstance = new network.web3.eth.Contract(kashiPairABI, kashiPair)
  //const inSolvent = []
  // for (let i = 0; i < borrowers.length; ++i) {
  borrowers = borrowers.concat(borrowers)
  borrowers = borrowers.concat(borrowers)
  borrowers = borrowers.concat(borrowers)
  //borrowers = borrowers.concat(borrowers)
  //borrowers = borrowers.concat(borrowers)
  console.log(borrowers.length)

  const inSolvent = await Promise.all(
    borrowers.map(async (b) => {
      try {
        await kashiPaircontractInstance.methods
          .liquidate(
            [b],
            [34444],
            '0x0000000000000000000000000000000000000001',
            '0x0000000000000000000000000000000000000000',
            true
          )
          .call({
            from: kashiPair,
          })
      } catch (e) {
        return false
      }
      return true
    })
  )
  // const inSolventData = await getBorrowerInfo(network, kashiPair, inSolvent)
  return inSolvent
}

async function test1() {
  const t = []
  for (let i = 0; i < 500; ++i) t.push(i)
  await Promise.all(
    t.map(async (n) => {
      console.log(n)

      await testLiquidation(networks.Ethereum, '0x3485A7C8913d640245e38564DDC05Bfb40104635', [
        '0x4bb4c1b0745ef7b4642feeccd0740dec417ca0a0',
        '0xc4f88c35bd1485c846847c093b5a77a126cf1b05',
        '0x39979745b166572c25b4c7e4e0939c9298efe79d',
        '0xd5d730a0cff08294473e54d0567f132005517050',
        '0x31b38710cae5581de367acd9117c64efcac03e04',
        '0x69d180742311a88b0112679621da853d1ee3ed59',
        '0x5fc79e21ceca2aa0f7a0aac71ef3ddde8f004e9e',
        '0xbfd011afe4b326817db13df58f0dea7188154aac',
        '0xe5057f7826262083038d9f60d07cb6799e3828df',
        '0x753b0dd94dda8098b256e3089028dbce9c220470',
        '0x1824db66ae6d644f0be2aec44eb0638b76e9a6a7',
        '0x26eccf0498462fea34ba8713d66e953395d93e85',
        '0x8ecc077a92b3b3cc5acc8faf6b19afca80b2b278',
        '0x9893b3de4db2a91b610590c86295032de1edfea2',
        '0xa19d1bdacdd0dd77d98d0c60ea385e3c2df2ab82',
        '0x38fc2810a6deaa62aeecb2670462f93e492d31e9',
        '0xfeecd74f40e0500853610e9439e8160fb5c6e670',
        '0x0ca1263cc5e5d431541ebdbef55395aadc35cf46',
        '0x632d79a9fafeeeb09d1500cc71f926b6d2f2d407',
        '0x2836c63b7eb161b45678da6999d6db015f461b5d',
        '0x821acf4602b9d57da21dee0c3db45e71143c0b45',
        '0x6744a9c6e3a9b8f7243ace5b20d51a500fcd0353',
        '0xa3f181996780237a10a64057cb760e755fe917d3',
        '0x568a1dfb8544cbc21078e5d9d1767c65f0ece10d',
        '0x4d4008253b3e27b65606e896537fbdd85e780e15',
        '0xa4ee91dbc1a1da6df174255069aba538baad7019',
        '0x710d24bcdc76517731f81758a4ab5884caf08ac8',
        '0xa0cd0f654d7cc3f59ce1f6ab766721c7c78a12bd',
        '0x7df6c4aa3144d6f5335f49bf8383f3dee6ca7334',
        '0x8de0cbb5ac966d3e5718221bc25e1fc2bd059e60',
        '0xc8e206c0fb4c1c17b8c53ec4aa8f049228eb6b16',
        '0x69c7858b9477d8680ce60be1cf36930a0cdd8a58',
        '0xd30ad1986bfefe85264af30e28704ce4f803a67e',
      ])
    })
  )
}

test1()
