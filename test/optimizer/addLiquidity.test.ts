import { BigNumber } from "@ethersproject/bignumber"
import {addLiquidity} from '../../src/optimizer/math'

describe('Optimizer: Add Liquidity', () => {
    it('No pairs', () => {
        const res = addLiquidity(
            BigNumber.from(1000),
            [],
            {base: BigNumber.from(1_000_000), elastic: BigNumber.from(1_000_000)},
            10
        )
        expect(res.size).toBe(0)
    })

    it('0 input', () => {
        const inputShares = 0
        const res = addLiquidity(
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
        const res = addLiquidity(
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
        expect(res.size).toBe(1)
        expect(res.get('KashiPairAddress')?.toString()).toBe(inputShares.toString())
    })

    it('2 equal pairs', () => {
        const inputShares = 1_234_567
        const res = addLiquidity(
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
        const res = addLiquidity(
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
            {base: BigNumber.from(2_100_931), elastic: BigNumber.from(1_050_874)},
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
})