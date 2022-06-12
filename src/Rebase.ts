import { BigNumber, BigNumberish } from '@ethersproject/bignumber'

export class Rebase {
  elastic: BigNumber
  base: BigNumber

  constructor(init: { elastic: BigNumberish; base: BigNumberish }) {
    this.elastic = BigNumber.from(init.elastic)
    this.base = BigNumber.from(init.base)
  }

  toBase(elastic: BigNumber): BigNumber {
    if (this.elastic.isZero()) return elastic
    return elastic.mul(this.base).div(this.elastic)
  }

  toElastic(base: BigNumber): BigNumber {
    if (this.base.isZero()) return base
    return base.mul(this.elastic).div(this.base)
  }
}
