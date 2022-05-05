import { Network } from './networks'
import { BigNumber } from '@ethersproject/bignumber'
import { getToken, Token } from './token'
import { BentoBoxV1 } from './BentoBoxV1'
import { KashiPair } from './KashiPair'
import { getLogs, Log } from './scanAPI'

interface PairData {
  address: string
  collateral: Token
  asset: Token
  oracle: string
  borrowers: string[]
}

interface BorrowerInfo {
  address: string
  kashiPair: PairData
  coverage: number
  borrowAmount: number
}

async function getPairBorrowers(network: Network, log: Log): Promise<BorrowerInfo[]> {
  const logParsed = network.web3.eth.abi.decodeLog(
    [
      {
        type: 'string',
        name: 'LogName',
        indexed: true,
      },
      {
        type: 'address',
        name: 'masterContract',
        indexed: true,
      },
      {
        type: 'bytes',
        name: 'data',
      },
      {
        type: 'address',
        name: 'cloneAddress',
        indexed: true,
      },
    ],
    log.data,
    log.topics
  )
  const address = logParsed.cloneAddress
  const pairInfo = network.web3.eth.abi.decodeParameters(['address', 'address', 'address', 'bytes'], logParsed.data)

  const borrowLogs = await getLogs(network, {
    address,
    event: 'LogBorrow(address,address,uint256,uint256,uint256)',
  })
  const borrowersSet = new Set<string>(borrowLogs.map((b) => '0x' + b.topics[1].slice(26)))
  const borrowers = [...borrowersSet]

  const [collateral, asset] = await Promise.all([getToken(network, pairInfo[0]), getToken(network, pairInfo[1])])

  console.log(`Checking pair ${collateral.symbol()} -> ${asset.symbol()} (${borrowers.length} borrowers)`)

  const pairData: PairData = {
    address,
    collateral,
    asset,
    oracle: pairInfo[2],
    borrowers,
  }

  const bento = new BentoBoxV1(network)
  const pair = new KashiPair(network, address)
  return await getBorrowerInfo(network, bento, pair, pairData, borrowers)
}

const E18 = BigNumber.from(1e9).mul(1e9)
async function getBorrowerInfo(
  network: Network,
  bento: BentoBoxV1,
  pair: KashiPair,
  kashiPair: PairData,
  borrowers: string[]
): Promise<BorrowerInfo[]> {
  if (borrowers.length === 0) return []

  try {
    const [totalBorrow, exchangeRate] = await Promise.all([pair.accruedTotalBorrow(), pair.updateExchangeRate()])

    const res: BorrowerInfo[] = await Promise.all(
      borrowers.map(async (b) => {
        const [borrowPart, collateralShare] = await Promise.all([pair.userBorrowPart(b), pair.userCollateralShare(b)])
        const collateralUsed = collateralShare.mul(E18)
        const collateralUsedAmount = await bento.toAmount(kashiPair.collateral.address(), collateralUsed)
        const borrowCostInCollateral = totalBorrow.base.isZero()
          ? 0
          : parseFloat(borrowPart.mul(totalBorrow.elastic).mul(exchangeRate).div(totalBorrow.base).toString())
        const borrowAmount = totalBorrow.base.isZero()
          ? 0
          : parseFloat(borrowPart.mul(totalBorrow.elastic).div(totalBorrow.base).toString())
        const collateralAmount = parseFloat(collateralUsedAmount.toString())

        let coverage
        if (collateralAmount === 0) {
          coverage = borrowCostInCollateral > 0 ? Number.MAX_VALUE : 0
        } else {
          coverage = (borrowCostInCollateral / collateralAmount) * 100
        }
        return {
          address: b,
          kashiPair,
          borrowAmount,
          coverage,
        }
      })
    )

    return res
  } catch (e) {
    console.log(e)
    return []
  }
}

function numberPrecision(n: number, precision: number) {
  if (n == 0) return 0
  const digits = Math.ceil(Math.log10(n))
  if (digits >= precision) return Math.round(n)
  const shift = Math.pow(10, precision - digits)
  return Math.round(n * shift) / shift
}

export async function getBorrowers(network: Network, minCoverage = 50): Promise<BorrowerInfo[]> {
  const logs = await getLogs(network, {
    address: network.bentoBoxV1Address,
    event: 'LogDeploy(address,bytes,address)',
    address1: network.kashPairMasterAddress,
  })

  let borrowers: BorrowerInfo[] = []
  const b = await Promise.all(logs.map((l) => getPairBorrowers(network, l)))
  b.forEach((s) => (borrowers = borrowers.concat(s)))

  const borrowersFiltered = borrowers.filter((b) => b.coverage >= minCoverage)
  const borrowersSorted = borrowersFiltered.sort((a, b) => b.coverage - a.coverage)

  borrowersSorted.forEach((b) => {
    const assetDecimals = b.kashiPair.asset.decimals()
    const del = Math.pow(10, assetDecimals)

    console.log(
      `user=${b.address} ${b.kashiPair.collateral.symbol()} -> ${b.kashiPair.asset.symbol()}, ` +
        `coverage=${Math.round(b.coverage)}%, ` +
        `borrowAmount=${numberPrecision(b.borrowAmount / del, 3)}${b.kashiPair.asset.symbol()}`
    )
  })

  return borrowersSorted
}
