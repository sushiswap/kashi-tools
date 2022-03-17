import fetch, {Response} from 'node-fetch-commonjs'
//import { BigNumber } from '@ethersproject/bignumber'
import {getTrottle} from './trottle'
import {wrapPermCache} from './permanentCache.js'
import { createAlchemyWeb3 } from "@alch/alchemy-web3"
import {AbiItem} from "web3-utils"

const networks = {
    Ethereum: {
        name: 'Ethereum',
        ticker: 'E',
        coinName: 'ETH',
        web3: createAlchemyWeb3(`https://eth-mainnet.alchemyapi.io/v2/${process.env.ALCHEMY_API_KEY}`),
        scanAPIURL: 'https://api.etherscan.io',
        scanAPIKey: process.env.ETHERSCAN_API_KEY,
        trottle: getTrottle(4, 1100),     // no more than 4 request per 1.1 second
        bentoBoxV1Address: '0xF5BCE5077908a1b7370B9ae04AdC565EBd643966',
        kashPairMasterAddress: '0x2cBA6Ab6574646Badc84F0544d05059e57a5dc42'
    },
    // Polygon: {
    //     name: 'Polygon',
    //     ticker: 'P',
    //     coinName: 'MATIC',
    //     web3: createAlchemyWeb3(`https://polygon-mainnet.g.alchemy.com/v2/${keys.AlchemyWeb3}`),
    //     scanAPIURL: 'https://api.polygonscan.com',
    //     scanAPIKey: keys.PolygonscanAPI,
    //     trottle: getTrottle(4, 1100),     // no more than 4 request per 1.1 second
    // },
}

type Network = typeof networks.Ethereum

async function fetchAPI(network: Network, search: Record<string, string>) {
    const params = Object.entries(search).map(([k, v]) => `${k}=${v}`).join('&')
    for(;;) {
        await network.trottle()
        let response: Response
        try {
            response = await fetch(`${network.scanAPIURL}/api?${params}&apikey=${network.scanAPIKey}`)
        } catch(e) {
            continue
        }
        const result = await response.json() as Record<string, unknown>
        if (result.status === '1') return result.result
        if (result.status === '0' && result.message == 'No records found') return result.result
        if (result.result == 'Max rate limit reached') continue     // try till success
        console.error(`${network.name} Scan API error: ${result.message} ${result.result}`);
        console.error(`${network.scanAPIURL}/api?${params}&apikey=${network.scanAPIKey}`)
        return
    }
}

interface LogParams {
    tx?: {blockNumber: string, hash: string},
    address: string,
    address1?: string,
    address2?: string,
    event: string,
    topic0?: string | null,
    topic1?: string,
    topic2?: string,
    data?: number | string
}

interface Log {
    transactionHash: string, 
    data: string,
    topics: string[]
}

async function getLogs(network: Network, params: LogParams) {
    const search: Record<string, string> = {module: 'logs', action: 'getLogs'}
    if (params.tx) {
        search.fromBlock = params.tx.blockNumber
        search.toBlock = params.tx.blockNumber
    }
    if (params.address) search.address=params.address
    if (params.event) params.topic0 = network.web3.utils.sha3(params.event)
    if (params.topic0) search.topic0 = params.topic0
    if (params.address1) params.topic1 = '0x000000000000000000000000' + params.address1.substring(2)
    if (params.topic1) search.topic1 = params.topic1
    if (params.address2) params.topic2 = '0x000000000000000000000000' + params.address2.substring(2)
    if (params.topic2) search.topic2 = params.topic2
    let logs =  await fetchAPI(network, search) as Array<Log>
    if (params.tx) logs = logs.filter(l => l.transactionHash == params.tx?.hash)
    if (params.data) {
        if (typeof params.data == 'number') params.data = '0x' + params.data.toString(16).padStart(64, '0')
        return logs.filter(l => l.data == params.data)
    }
    return logs
}

interface PairData {
    address: string;
    collateral: string;
    collateralSymbol: string;
    asset: string;
    assetSymbol: string;
    oracle: string;
    //oracleData: string;
    notSolventBorrowers: string[];
}

async function getPairDataFromBentoV1Log(network: Network, log: Log): Promise<PairData> {
    const logParsed = await network.web3.eth.abi.decodeLog([{
            type: 'string',
            name: 'LogName',
            indexed: true
        }, {
            type: 'address',
            name: 'masterContract',
            indexed: true
        },{
            type: 'bytes',
            name: 'data'
        },{
            type: 'address',
            name: 'cloneAddress',
            indexed: true
        }],
        log.data,
        log.topics
    );
    const address = logParsed.cloneAddress

    const borrowLogs = await getLogs(networks.Ethereum, {
        address,
        event: 'LogBorrow(address,address,uint256,uint256,uint256)'
    })
    const borrowersSet = new Set<string>(borrowLogs.map(b => '0x' + b.topics[1].slice(26)))
    const borrowers = [...borrowersSet]
    
    const pairData = await network.web3.eth.abi.decodeParameters(['address', 'address', 'address', 'bytes'], logParsed.data)
    const collateral = pairData[0] as string
    const collateralSymbol = await getTokenSymbol(network, collateral)
    const asset = pairData[1] as string
    const assetSymbol = await getTokenSymbol(network, asset)
    
    console.log(`Checking pair ${collateralSymbol} -> ${assetSymbol} (${borrowers.length} borrowers`)    
    const notSolventBorrowers = await getNotSolventBorrowersBentoV1(network, address, borrowers)    

    return {
        address,
        collateral,
        collateralSymbol,
        asset,
        assetSymbol,
        oracle: pairData[2],
        //oracleData: pairData[3],
        notSolventBorrowers
    }
}

export async function getAllKashiPairsBentoV1(network: Network): Promise<PairData[]> {
    const logs = await getLogs(networks.Ethereum, {
        address: network.bentoBoxV1Address,
        event: 'LogDeploy(address,bytes,address)',
        address1: network.kashPairMasterAddress
    })

    const pairs = await Promise.all(logs.map(l => getPairDataFromBentoV1Log(network, l)))
    return pairs
}

const kashiPairABI: AbiItem[] = [{
    inputs: [],
    name: "exchangeRate",
    outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
    stateMutability: "view",
    type: "function"
}, {
    inputs: [],
    name: "totalBorrow",
    outputs: [
        {internalType: 'uint128', name: 'elastic', type: 'uint128'},
        {internalType: 'uint128', name: 'base', type: 'uint128'}
    ],
    stateMutability: "view",
    type: "function"
}, {
    inputs: [{internalType: 'address', name: '', type: 'address'}],
    name: "userCollateralShare",
    outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
    stateMutability: "view",
    type: "function"
}, {
    inputs: [{internalType: 'address', name: '', type: 'address'}],
    name: "userBorrowPart",
    outputs: [{internalType: 'uint256', name: '', type: 'uint256'}],
    stateMutability: "view",
    type: "function"
}, {
    inputs: [],
    name: "updateExchangeRate",
    outputs: [
        {internalType: 'bool', name: 'updated', type: 'bool'},
        {internalType: 'uint256', name: 'rate', type: 'uint256'}
    ],
    stateMutability: "nonpayable",
    type: "function"
}, {
    inputs: [
        {internalType: 'address[]', name: 'users', type: 'address[]'},
        {internalType: 'uint256[]', name: 'maxBorrowParts', type: 'uint256[]'},
        {internalType: 'address', name: 'to', type: 'address'},
        {internalType: 'contract ISwapper', name: 'swapper', type: 'address'},
        {internalType: 'bool', name: 'open', type: 'bool'},
    ],
    name: "liquidate",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
}, {
    inputs: [],
    name: "accrueInfo",
    outputs: [
        {internalType: 'uint64', name: 'interestPerSecond', type: 'uint64'},
        {internalType: 'uint64', name: 'lastAccrued', type: 'uint64'},
        {internalType: 'uint128', name: 'feesEarnedFraction', type: 'uint128'},
    ],
    stateMutability: "view",
    type: "function",
}]

async function getNotSolventBorrowersBentoV1(network: Network, kashiPair: string, borrowers: string[]) {
    console.log();
    
    if (borrowers.length === 0) return []
    const kashiPaircontractInstance = new network.web3.eth.Contract(kashiPairABI, kashiPair)
    const liquidated = []
    for (let i = 0; i < borrowers.length; ++i) {
        try {
            await kashiPaircontractInstance.methods.liquidate(
                [borrowers[i]], 
                [0], 
                '0x0000000000000000000000000000000000000000',
                '0x0000000000000000000000000000000000000000',
                true
            ).call()
        } catch(e) {
            continue
        }
        liquidated.push(borrowers[i])
        console.log("Liquidation: ", kashiPair, borrowers[i]);        
    }
    return liquidated
}

async function _getTokenSymbol(network: Network, token: string, ...args: unknown[]): Promise<string> {
    const abi: AbiItem[] = [{
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{name: '', type: 'string'}],
        payable: false,
        stateMutability: "view",
        type: "function",
    }]
    const contractInstance = new network.web3.eth.Contract(abi, token)
    const result = await contractInstance.methods.symbol(args.slice(3)).call() as string
    return result
}

const getTokenSymbol = wrapPermCache(_getTokenSymbol, (_n: Network, t: string) => t)

getAllKashiPairsBentoV1(networks.Ethereum)