import { AbiItem } from "web3-utils"
import { Contract } from "web3-eth-contract"
import { BigNumber } from "@ethersproject/bignumber";
import { Network } from "./networks";
import { Rebase } from "./Rebase";

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

const E18 = BigNumber.from(1e9).mul(1e9);

export class KashiPair {
    _network: Network
    _contractInstance: Contract
    _kashiPairAddress: string
    _totalBorrow: Rebase | undefined
    _userCollateralShare: Record<string, BigNumber>
    _userBorrowPart: Record<string, BigNumber>

    constructor(network: Network, kashiPairAddress: string) {
        this._contractInstance = new network.web3.eth.Contract(kashiPairABI, kashiPairAddress)
        this._kashiPairAddress = kashiPairAddress
        this._network = network
        this._userCollateralShare = {}
        this._userBorrowPart = {}
    }

    async totalBorrow(): Promise<Rebase> {
        if (this._totalBorrow === undefined) {
            const totalBorrow = await this._contractInstance.methods.totalBorrow().call()
            this._totalBorrow = new Rebase(totalBorrow)
        }
        return this._totalBorrow as Rebase
    }

    async userCollateralShare(user: string): Promise<BigNumber> {
        if (this._userCollateralShare[user] === undefined) {
            const userCollateralShare = await this._contractInstance.methods.userCollateralShare(user).call()
            this._userCollateralShare[user] =BigNumber.from(userCollateralShare)
        }
        return this._userCollateralShare[user]
    }

    async userBorrowPart(user: string): Promise<BigNumber> {
        if (this._userBorrowPart[user] === undefined) {
            const userBorrowPart = await this._contractInstance.methods.userBorrowPart(user).call()
            this._userBorrowPart[user] =BigNumber.from(userBorrowPart)
        }
        return this._userBorrowPart[user]
    }

    async canBeLiquidated(borrower: string): Promise<boolean> {
        try {
            await this._contractInstance.methods.liquidate(
                [borrower], 
                [34444], 
                '0x0000000000000000000000000000000000000001',
                '0x0000000000000000000000000000000000000000',
                true
            ).call({
                from: this._kashiPairAddress
            })
        } catch(e) {
            return false
        }
        return true
    }

    async _accruedTotalBorrow(): Promise<Rebase> {
        const totalBorrow = await this.totalBorrow()
        const accrueInfo = await this._contractInstance.methods.accrueInfo().call()
        accrueInfo.interestPerSecond = BigNumber.from(accrueInfo.interestPerSecond)
        const blockNumber = await this._network.web3.eth.getBlockNumber()
        const timeStamp = (await this._network.web3.eth.getBlock(blockNumber)).timestamp as number
        const elapsedTime = timeStamp - accrueInfo.lastAccrued
        const extraAmount = totalBorrow.elastic.mul(accrueInfo.interestPerSecond).mul(elapsedTime).div(E18);
        totalBorrow.elastic = totalBorrow.elastic.add(extraAmount);
        return totalBorrow
    }

    // TODO: calc timeStamp in advance to make it faster ?
    async accruedTotalBorrow(): Promise<Rebase> {
        const [totalBorrow, accrueInfo, blockNumber] = await Promise.all([
            this.totalBorrow(),
            this._contractInstance.methods.accrueInfo().call(),
            this._network.web3.eth.getBlockNumber()
        ])
        const timeStamp = (await this._network.web3.eth.getBlock(blockNumber)).timestamp as number
        const elapsedTime = timeStamp - accrueInfo.lastAccrued
        accrueInfo.interestPerSecond = BigNumber.from(accrueInfo.interestPerSecond)
        const extraAmount = totalBorrow.elastic.mul(accrueInfo.interestPerSecond).mul(elapsedTime).div(E18);
        totalBorrow.elastic = totalBorrow.elastic.add(extraAmount);
        return totalBorrow
    }

    async updateExchangeRate(): Promise<BigNumber> {
        try {
            const { _updated, rate} = await this._contractInstance.methods.updateExchangeRate().call()
            return BigNumber.from(rate)
        } catch (e) {
            throw new Error(`KashiPair ${this._kashiPairAddress}: Error trying to updateExchangeRate`)
        }
    }
    
}