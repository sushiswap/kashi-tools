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
})