import { AbiItem } from "web3-utils"
import { Contract } from "web3-eth-contract"
import { BigNumber, BigNumberish } from "@ethersproject/bignumber";
import { Network } from "./networks";

class Rebase {
    elastic: BigNumber
    base: BigNumber

    constructor(init: {elastic: BigNumberish, base: BigNumberish}) {
        this.elastic = BigNumber.from(init.elastic)
        this.base = BigNumber.from(init.base)
    }

    toBase(
        elastic: BigNumber
    ): BigNumber {
        if (this.elastic.isZero()) return elastic
        return elastic.mul(this.base).div(this.elastic)
    }

    toElastic(
        base: BigNumber
    ): BigNumber {
        if (this.base.isZero()) return base
        return base.mul(this.elastic).div(this.base)
    }

}

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

    constructor(network: Network) {
        this._contractInstance = new network.web3.eth.Contract(BentoV1ABI, network.bentoBoxV1Address)
        this._totals = {}
    }

    async totals(token: string): Promise<Rebase> {
        if (this._totals[token] == undefined) {
            const totals = await this._contractInstance.methods.totals(token).call()
            this._totals[token] = new Rebase(totals)
        }
        return this._totals[token]
    }

    async toAmount(token: string, share: BigNumber): Promise<BigNumber> {
        const totals = await this.totals(token)
        return totals.toElastic(share)
    }
}