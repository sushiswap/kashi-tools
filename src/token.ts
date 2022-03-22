import { Network } from "./networks"
import {AbiItem} from "web3-utils"
import { wrapPermCache } from "./permanentCache"

export class Token {
    private _address: string
    private _symbol: string
    private _decimals: number

    constructor(address: string, symbol: string, decimals: number) {
        this._address = address
        this._symbol = symbol
        this._decimals = decimals
    }

    address(): string {return this._address}
    symbol(): string {return this._symbol}
    decimals(): number {return this._decimals}
}

export async function getToken(network: Network, address: string): Promise<Token> {
    const symbol = await getTokenSymbol(network, address)
    const decimals = await getTokenDecimals(network, address)
    return new Token(address, symbol, decimals)
}

async function _getTokenSymbol(network: Network, token: string): Promise<string> {
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
    const result = await contractInstance.methods.symbol().call() as string
    return result
}

const getTokenSymbol = wrapPermCache(_getTokenSymbol, (_n: Network, t: string) => t)

async function _getTokenDecimals(network: Network, token: string): Promise<number> {
    const abi: AbiItem[] = [{
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{name: '', type: 'uint8'}],
        payable: false,
        stateMutability: "view",
        type: "function",
    }]
    const contractInstance = new network.web3.eth.Contract(abi, token)
    const result = await contractInstance.methods.decimals().call() as number
    return result
}

const getTokenDecimals = wrapPermCache(_getTokenDecimals, (_n: Network, t: string) => t)
