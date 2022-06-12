import { getTrottle } from './trottle'
import { createAlchemyWeb3 } from '@alch/alchemy-web3'

export const networks = {
  Ethereum: {
    name: 'Ethereum',
    ticker: 'E',
    coinName: 'ETH',
    web3: createAlchemyWeb3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY_ETHEREUM}`),
    web3Trottle: getTrottle(300, 1000), // no more than 300 request per 1 second
    scanAPIURL: 'https://api.etherscan.io',
    scanAPIKey: process.env.ETHERSCAN_API_KEY,
    trottle: getTrottle(4, 1100), // no more than 4 request per 1.1 second
    bentoBoxV1Address: '0xF5BCE5077908a1b7370B9ae04AdC565EBd643966',
    kashPairMasterAddress: '0x2cBA6Ab6574646Badc84F0544d05059e57a5dc42',
  },
  Kovan: {
    name: 'Kovan',
    ticker: 'K',
    coinName: 'ETH',
    web3: createAlchemyWeb3(`https://eth-kovan.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY_KOVAN}`),
    web3Trottle: getTrottle(300, 1000), // no more than 300 request per 1 second
    scanAPIURL: 'https://api-kovan.etherscan.io',
    scanAPIKey: process.env.ETHERSCAN_API_KEY,
    trottle: getTrottle(4, 1100), // no more than 4 request per 1.1 second
    bentoBoxV1Address: '0xc381a85ed7C7448Da073b7d6C9d4cBf1Cbf576f0',
    kashPairMasterAddress: '0x2cBA6Ab6574646Badc84F0544d05059e57a5dc42',
  },
  Polygon: {
    name: 'Polygon',
    ticker: 'P',
    coinName: 'MATIC',
    web3: createAlchemyWeb3(`https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY_POLYGON}`),
    web3Trottle: getTrottle(300, 1000), // no more than 300 request per 1 second
    scanAPIURL: 'https://api.polygonscan.com',
    scanAPIKey: process.env.POLYGONSCAN_API_KEY,
    trottle: getTrottle(4, 1100), // no more than 4 request per 1.1 second
    bentoBoxV1Address: '0x0319000133d3AdA02600f0875d2cf03D442C3367',
    kashPairMasterAddress: '0xB527C5295c4Bc348cBb3a2E96B2494fD292075a7',
  },
}

export type Network = typeof networks.Ethereum
