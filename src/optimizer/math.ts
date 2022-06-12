import { BigNumber } from "@ethersproject/bignumber"

const MAX_GAS_SHARE = 0.005
const MIN_SIGNIFICANT_UTILIZATION = 0.0025

export interface Rebase {
    base: BigNumber
    elastic: BigNumber
}

export interface KashiPair {
    address: string
    totalAsset: Rebase
    totalBorrow: Rebase
    interestPerSecond: BigNumber
}

interface KashiPairAmounts {
    address: string
    lended: number
    borrowed: number
    interestPerSecond?: number
}

export type Distribution = Map<string, BigNumber>  // <KashiPairAddress, AssetQuantityShares>
type DistributionInternal = Map<string, number>  // <KashiPairAddress, AssetQuantityAmount>

function getSortOrder<T>(a: T[], cmp: (x:T, y:T)=>number): number[] {
    const b: [T, number][] = a.map((e, i) => [e, i])
    const c: [T, number][] = b.sort((x, y) => cmp(x[0], y[0]))
    return c.map(e => e[1])
}

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);
const closeValues = (a: number, b: number) => Math.abs(a/b-1) < 1e-12

function sharesToAmount(shares: BigNumber, total: Rebase): number {
    const amount = shares.mul(total.elastic).div(total.base)
    return parseFloat(amount.toString())
}

function amountToShares(amount: number, total: Rebase): BigNumber {
    return getBigNumber(amount).mul(total.base).div(total.elastic)
}

export function getBigNumber(
    value: number
): BigNumber {
    const v = Math.abs(value)
    if (v < Number.MAX_SAFE_INTEGER) return BigNumber.from(Math.round(value));
  
    const exp = Math.floor(Math.log(v) / Math.LN2);
    console.assert(exp >= 51, "Internal Error 314");
    const shift = exp - 51;
    const mant = Math.round(v / Math.pow(2, shift));
    const res = BigNumber.from(mant).mul(BigNumber.from(2).pow(shift));
    return value > 0 ? res : res.mul(-1);
}

function kashiPairToAmounts(pair: KashiPair, total: Rebase): KashiPairAmounts {
    return {
        address: pair.address,
        lended: sharesToAmount(pair.totalAsset.elastic, total),
        borrowed: parseFloat(pair.totalBorrow.elastic.toString()),
        interestPerSecond: parseFloat(pair.interestPerSecond.toString())
    }
}

function distributionInternalToDistribution(distr: DistributionInternal, total: Rebase, assetSharesTotal: BigNumber): Distribution {
    const res = new Map<string, BigNumber>()
    if (distr.size == 0) return res

    let assetDistributed = BigNumber.from(0)
    let maxDistributed = -1
    let maxDistributedPair = ''
    distr.forEach((v, k) => {
        const shares = amountToShares(v, total)
        res.set(k, shares)
        assetDistributed = assetDistributed.add(shares)
        if (v > maxDistributed) {
            maxDistributed = v
            maxDistributedPair = k
        }
    })
    if (!assetDistributed.eq(assetSharesTotal)) {    // arithmetic roundings
        {   // check - to comment off for production
            if (assetDistributed.sub(assetSharesTotal).abs().gt(10)) {
                const a = parseFloat(assetDistributed.toString())
                const b = parseFloat(assetSharesTotal.toString())
                console.assert(Math.abs(a/b-1) < 1e-12)
            }
        }
        const diff = assetSharesTotal.sub(assetDistributed)
        const prev = res.get(maxDistributedPair) as BigNumber
        res.set(maxDistributedPair, prev.add(diff))        
    }
    return res
}

function addLiquidityStable(
    assetAmount: number,
    pairs: KashiPairAmounts[],
    depositCost: number
): DistributionInternal {
    const res = new Map<string, number>()
    if (pairs.length == 0 || assetAmount <= 0) return res
    if (pairs.length == 1) {
        res.set(pairs[0].address, assetAmount)
        return res
    }

    const maxPairs = clamp(Math.round(assetAmount*MAX_GAS_SHARE/depositCost), 1, pairs.length)
    const utilizations = pairs.map(p => p.lended == 0 ? 0 : p.borrowed/p.lended)
    utilizations.push(MIN_SIGNIFICANT_UTILIZATION)
    const order = getSortOrder(utilizations, (a, b) => a-b)

    let lendAcc = 0
    let borrowAcc = 0
    let distrAcc = 0
    const distr: number[] = []
    for (let i = 0; i < maxPairs; ++i) {
        if (assetAmount <= 0) break
        const utilNext = utilizations[i+1]
        if (utilNext < MIN_SIGNIFICANT_UTILIZATION) break
        const {lended, borrowed} = pairs[order[i]]
        lendAcc += lended
        borrowAcc += borrowed
        const distrAmount = clamp(borrowAcc/utilNext - lendAcc, 0, assetAmount)
        console.assert( (borrowAcc/utilNext - lendAcc) >= -1e-12)
        for (let j = 0; j <= i; ++j) {
            distr[j] += pairs[order[j]].borrowed*distrAmount/borrowAcc
        }
        distrAcc += distrAmount
        assetAmount -= distrAmount
    }
    { // check - to comment off for production
        console.assert(closeValues(distr.reduce((a,b) => a+b, 0), assetAmount + distrAcc))
        const utilFinal = pairs[order[0]].borrowed/(pairs[order[0]].lended + distr[0])
        for (let i = 1; i < distr.length; ++i) {
            console.assert(closeValues(pairs[order[i]].borrowed/(pairs[order[i]].lended + distr[i]), utilFinal))
        }
    }
    if (assetAmount > 0) {
        const part = assetAmount/pairs.length
        for (let i = 0; i < pairs.length; ++i) {
            distr[i] += part
        }
    }
    distr.forEach((d, i) => res.set(pairs[order[i]].address, d))
    return res
}

export function addLiquidity(
    assetShares: BigNumber,
    pairs: KashiPair[],
    bentoAssetTotal: Rebase,
    pairDepositCostInAssetAmount: number
): Distribution {
    const distr = addLiquidityStable(
        sharesToAmount(assetShares, bentoAssetTotal), 
        pairs.map(p => kashiPairToAmounts(p, bentoAssetTotal)), 
        pairDepositCostInAssetAmount
    )
    return distributionInternalToDistribution(distr, bentoAssetTotal, assetShares)
}

// export function removeLiquidity(
//     assetShares: BigNumber,
//     pairs: KashiPair[], 
//     optimizerLiquidity: Distribution, 
//     pairWithdrawCost: number
// ): Distribution {

// }

// export function rebalance(
//     pairs: KashiPair[], 
//     optimizerLiquidity: Distribution,
//     pairDepositCost: number,
//     pairWithdrawCost: number
// ): Distribution {

// }