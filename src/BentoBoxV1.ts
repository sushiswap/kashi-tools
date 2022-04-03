import { AbiItem } from "web3-utils"
import { Contract } from "web3-eth-contract"
import { BigNumber } from "@ethersproject/bignumber";
import { Network } from "./networks";
import { Rebase } from "./Rebase";
import { callMethod } from "./webAPI";

const BentoV1ABI: AbiItem[] = [{
    inputs: [{internalType: 'contract IERC20', name: '', type: 'address'}],
    name: "totals",
    outputs: [
        {internalType: 'uint128', name: 'elastic', type: 'uint128'},
        {internalType: 'uint128', name: 'base', type: 'uint128'}
    ],
    stateMutability: "view",
    type: "function"
}]

export class BentoBoxV1 {
    _contractInstance: Contract
    _totals: Record<string, Rebase>
    _network: Network

    constructor(network: Network) {
        this._contractInstance = new network.web3.eth.Contract(BentoV1ABI, network.bentoBoxV1Address)
        this._totals = {}
        this._network = network
    }

    async totals(token: string): Promise<Rebase> {
        if (this._totals[token] === undefined) {
            const totals = await callMethod(this._network, this._contractInstance.methods.totals(token))
            this._totals[token] = new Rebase(totals)
        }
        return this._totals[token]
    }

    async toAmount(token: string, share: BigNumber): Promise<BigNumber> {
        const totals = await this.totals(token)
        return totals.toElastic(share)
    }
}