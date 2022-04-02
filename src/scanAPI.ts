import fetch, {Response} from 'node-fetch-commonjs'
import { Network } from './networks'

async function fetchAPI(network: Network, search: Record<string, string|number>) {
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
        if (result.status === '0' && result.message == 'No transactions found') return result.result
        if (result.result == 'Max rate limit reached') continue     // try till success
        console.error(`${network.name} Scan API error: ${result.message} ${result.result}`);
        console.error(`${network.scanAPIURL}/api?${params}&apikey=${network.scanAPIKey}`)
        return
    }
}

export interface LogParams {
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

export interface Log {
    transactionHash: string, 
    data: string,
    topics: string[]
}

export async function getLogs(network: Network, params: LogParams): Promise<Log[]> {
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

export interface Transaction {
    from: string,
    to: string,
    input?: string,
    isError? : string,
}

export async function getAddrTransactions(network: Network, address: string, startblock = 0): Promise<Transaction[]> {
    const txs =  await fetchAPI(network, {
        module: 'account',
        action: 'txlist',
        address,
        startblock,
        endblock: 'latest',
        sort: 'asc'
    }) as Transaction[]
    if (txs === undefined) return []
    return txs.filter(tx => tx.isError === undefined || tx.isError === '0')
}
