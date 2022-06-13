import { BigNumber } from "@ethersproject/bignumber"
import {addLiquidity, KashiPair, Rebase, Distribution, MIN_SIGNIFICANT_UTILIZATION, MAX_GAS_SHARE} from '../../src/optimizer/math'

const closeValues = (a: number, b: number, threshould = 1e-12) => Math.abs(a/b-1) < threshould

function checkStableDistribution(
    assetShares: BigNumber,
    pairs: KashiPair[],
    bentoAssetTotal: Rebase,
    pairDepositCostInAssetAmount: number,
): Distribution {
    const distr = addLiquidity(
        assetShares,
        pairs,
        bentoAssetTotal,
        pairDepositCostInAssetAmount,
    )

    if (assetShares.isZero() || pairs.length == 0) {
        expect(distr.size).toBe(0)
        return distr
    }

    expect(distr.size).toBeGreaterThan(0)
    expect(distr.size).toBeLessThanOrEqual(pairs.length)

    const totalDistr = Array.from(distr).reduce((a: BigNumber, [_, v]) => a.add(v), BigNumber.from(0) )
    expect(totalDistr.toString()).toBe(assetShares.toString())

    distr.forEach((_, k) => expect(pairs.some(p => p.address == k)).toBeTruthy())    
    distr.forEach(v => expect(v.gt(0)).toBeTruthy())

    const utilAfter: number[] = []
    const used: boolean[] = []
    let utilAfterMin = 2
    pairs.forEach((p, i) => {
        const addedShared = distr.get(p.address) || BigNumber.from(0)
        const added = addedShared.mul(bentoAssetTotal.elastic).div(bentoAssetTotal.base)        
        const borrowed = parseFloat(p.totalBorrow.elastic.toString())
        const lended = parseFloat(p.totalAsset.elastic.mul(bentoAssetTotal.elastic).div(bentoAssetTotal.base).toString())
        expect(borrowed/lended).toBeLessThanOrEqual(1)
        utilAfter[i] = borrowed/(lended+parseFloat(added.toString()))
        used[i] = added.gt(0)        
        if (used[i] && utilAfter[i] < utilAfterMin) utilAfterMin = utilAfter[i]
    })
    
    if (utilAfterMin < MIN_SIGNIFICANT_UTILIZATION) {
        expect(distr.size).toBe(pairs.length)
        for(let i = 0; i < pairs.length; ++i) {
            expect(utilAfter[i]).toBeLessThanOrEqual(MIN_SIGNIFICANT_UTILIZATION)
        }
    } else {
        expect(distr.size).toBeLessThanOrEqual(pairs.length)
        const assetAmount = parseFloat(assetShares.mul(bentoAssetTotal.elastic).div(bentoAssetTotal.base).toString())
        const maxPairs = Math.max(Math.round(assetAmount*MAX_GAS_SHARE/pairDepositCostInAssetAmount), 1)        
        for(let i = 0; i < pairs.length; ++i) { 
            if (used[i]) expect(closeValues(utilAfter[i], utilAfterMin, 1e-6)).toBeTruthy()
            else if (distr.size !== maxPairs) expect(utilAfter[i] as number).toBeLessThan(utilAfterMin)
        }
    }

    return distr
}

describe('Optimizer: Add Liquidity', () => {
    it('No pairs', () => {
        const res = checkStableDistribution(
            BigNumber.from(1000),
            [],
            {base: BigNumber.from(1_000_000), elastic: BigNumber.from(1_000_000)},
            10
        )
        expect(res.size).toBe(0)
    })

    it('0 input', () => {
        const inputShares = 0
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress',
                totalAsset: {base: BigNumber.from(1_100_643), elastic: BigNumber.from(1_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            10
        )
        expect(res.size).toBe(0)
    })

    it('1 pair', () => {
        const inputShares = 1_234_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            10
        )
        expect(res.size).toBe(1)
        expect(res.get('KashiPairAddress')?.toString()).toBe(inputShares.toString())
    })

    it('2 equal pairs', () => {
        const inputShares = 1_234_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            10
        )
        expect(res.size).toBe(2)
        const d0 = parseFloat(res.get('KashiPairAddress0')?.toString() || '0')
        const d1 = parseFloat(res.get('KashiPairAddress1')?.toString() || '0')
        expect(d0+d1).toBe(inputShares)
        expect(Math.abs(d0-inputShares/2)).toBeLessThan(10)
    })

    it('3 equal pairs', () => {
        const inputShares = 1_234_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }, {
                address: 'KashiPairAddress2',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }],
            {base: BigNumber.from(700_931), elastic: BigNumber.from(1_050_874)},
            10
        )
        expect(res.size).toBe(3)
        const d0 = parseFloat(res.get('KashiPairAddress0')?.toString() || '0')
        const d1 = parseFloat(res.get('KashiPairAddress1')?.toString() || '0')
        const d2 = parseFloat(res.get('KashiPairAddress2')?.toString() || '0')
        expect(d0+d1+d2).toBe(inputShares)
        expect(Math.abs(d0-inputShares/3)).toBeLessThan(10)
        expect(Math.abs(d1-inputShares/3)).toBeLessThan(10)
    })

    it('2 different pairs', () => {
        const inputShares = 12_934_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(100)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(4_100_643), elastic: BigNumber.from(5_050_874)},
                totalBorrow: {base: BigNumber.from(540_432), elastic: BigNumber.from(590_011)},
                interestPerSecond: BigNumber.from(200)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            100
        )
        expect(res.size).toBe(2)
    })

    
    it('3 different pairs', () => {
        const inputShares = 33_934_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(4_100_643), elastic: BigNumber.from(5_050_874)},
                totalBorrow: {base: BigNumber.from(540_432), elastic: BigNumber.from(590_011)},
                interestPerSecond: BigNumber.from(10)
            }, {
                address: 'KashiPairAddress2',
                totalAsset: {base: BigNumber.from(5_100_643), elastic: BigNumber.from(6_050_874)},
                totalBorrow: {base: BigNumber.from(600_432), elastic: BigNumber.from(660_000)},
                interestPerSecond: BigNumber.from(10)
            }],
            {base: BigNumber.from(700_931), elastic: BigNumber.from(1_050_874)},
            10
        )
        expect(res.size).toBe(3)
    })

    it('2 empty pairs', () => {
        const inputShares = 1_934_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(0), elastic: BigNumber.from(0)},
                interestPerSecond: BigNumber.from(100)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(4_100_643), elastic: BigNumber.from(5_050_874)},
                totalBorrow: {base: BigNumber.from(0), elastic: BigNumber.from(0)},
                interestPerSecond: BigNumber.from(200)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            100
        )
        expect(res.size).toBe(2)
        const d0 = parseFloat(res.get('KashiPairAddress0')?.toString() || '0')
        const d1 = parseFloat(res.get('KashiPairAddress1')?.toString() || '0')
        expect(Math.abs(d0-inputShares/2)).toBeLessThan(10)
        expect(Math.abs(d1-inputShares/2)).toBeLessThan(10)
    })

    it('2 low utilized pairs', () => {
        const inputShares = 1_934_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(1230), elastic: BigNumber.from(1234)},
                interestPerSecond: BigNumber.from(100)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(4_100_643), elastic: BigNumber.from(5_050_874)},
                totalBorrow: {base: BigNumber.from(555), elastic: BigNumber.from(567)},
                interestPerSecond: BigNumber.from(200)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            100
        )
        expect(res.size).toBe(2)
        const d0 = parseFloat(res.get('KashiPairAddress0')?.toString() || '0')
        const d1 = parseFloat(res.get('KashiPairAddress1')?.toString() || '0')
        expect(Math.abs(d0-inputShares/2)).toBeLessThan(10)
        expect(Math.abs(d1-inputShares/2)).toBeLessThan(10)
    })

    it('high+low utilised pairs', () => {
        const inputShares = 1_934_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(1_807_654), elastic: BigNumber.from(1_876_987)},
                interestPerSecond: BigNumber.from(100)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(4_100_643), elastic: BigNumber.from(5_050_874)},
                totalBorrow: {base: BigNumber.from(555), elastic: BigNumber.from(567)},
                interestPerSecond: BigNumber.from(200)
            }],
            {base: BigNumber.from(1_005_765), elastic: BigNumber.from(1_050_874)},
            100
        )
        expect(res.size).toBeGreaterThanOrEqual(1)
        const d0 = parseFloat(res.get('KashiPairAddress0')?.toString() || '0')
        const d1 = parseFloat(res.get('KashiPairAddress1')?.toString() || '0')
        expect(d0).toBeGreaterThan(d1)
    })

    it('high gas costs', () => {
        const inputShares = 1_234_567
        const res = checkStableDistribution(
            BigNumber.from(inputShares),
            [{
                address: 'KashiPairAddress0',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }, {
                address: 'KashiPairAddress1',
                totalAsset: {base: BigNumber.from(2_100_643), elastic: BigNumber.from(2_050_874)},
                totalBorrow: {base: BigNumber.from(500_432), elastic: BigNumber.from(560_000)},
                interestPerSecond: BigNumber.from(10)
            }],
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
            100_000
        )
        expect(res.size).toBe(1)
    })
})