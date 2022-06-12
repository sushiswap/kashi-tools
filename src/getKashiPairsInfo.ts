import { Network } from './networks'
import { BigNumber } from '@ethersproject/bignumber'
import { getToken, Token } from './token'
import { BentoBoxV1 } from './BentoBoxV1'
import { KashiPair } from './KashiPair'
import { Transaction, Log, getLogs, getAddrTransactions } from './scanAPI'
interface InSolventBorrower {
  address: string
  collateralShare: number
  collateralAmount: number
  borrowAmount: number
  borrowCostInCollateral: number
  coverage: number
}
interface PairData {
  address: string
  collateral: Token
  asset: Token
  oracle: string
  //oracleData: string;
  borrowers: string[]
  inSolventBorrowers?: InSolventBorrower[]
  liquidateTxs: Transaction[]
}

// network.web3.utils.keccak256('liquidate(address[],uint256[],address,address,bool)').substring(0, 10);
const liquidateMethodId = '0x76ee101b'

async function getPairData(network: Network, log: Log): Promise<PairData> {
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

  const [collateral, asset, txsAll] = await Promise.all([
    getToken(network, pairInfo[0]),
    getToken(network, pairInfo[1]),
    borrowers.length > 0 ? getAddrTransactions(network, address) : Promise.resolve([]),
  ])
  const liquidateTxs = txsAll.filter((t) => t.input?.startsWith(liquidateMethodId))

  const pairData: PairData = {
    address,
    collateral,
    asset,
    oracle: pairInfo[2],
    //oracleData: pairData[3],
    borrowers,
    liquidateTxs,
  }

  const bento = new BentoBoxV1(network)
  pairData.inSolventBorrowers = await getInSolventBorrowersBentoV1(network, bento, pairData)

  return pairData
}

function numberPrecision(n: number, precision: number) {
  if (n == 0) return 0
  const digits = Math.ceil(Math.log10(n))
  if (digits >= precision) return Math.round(n)
  const shift = Math.pow(10, precision - digits)
  return Math.round(n * shift) / shift
}

async function getInSolventBorrowersBentoV1(
  network: Network,
  bento: BentoBoxV1,
  kashiPair: PairData
): Promise<InSolventBorrower[]> {
  console.log(
    `Checking pair ${kashiPair.collateral.symbol()} -> ${kashiPair.asset.symbol()} ` +
      `(${kashiPair.borrowers.length} borrowers)`
  )

  if (kashiPair.borrowers.length === 0) return []
  const pair = new KashiPair(network, kashiPair.address)
  const inSolvent: string[] = []
  await Promise.all(
    kashiPair.borrowers.map(async (b) => {
      const canBeLiquidated = await pair.canBeLiquidated(b)
      if (canBeLiquidated) inSolvent.push(b)
    })
  )

  const inSolventData = await getBorrowerInfo(network, bento, pair, kashiPair, inSolvent)

  const assetDecimals = kashiPair.asset.decimals()
  const del = Math.pow(10, assetDecimals)
  inSolventData.forEach((b) => {
    console.log(
      `Can be liquidated: user=${b.address}, pair=${kashiPair.collateral.symbol()}->${kashiPair.asset.symbol()}, ` +
        `coverage=${Math.round(b.coverage)}%, ` +
        `borrowAmount=${numberPrecision(b.borrowAmount / del, 3)}${kashiPair.asset.symbol()}`
    )
  })
  return inSolventData
}

const E18 = BigNumber.from(1e9).mul(1e9)
async function getBorrowerInfo(
  network: Network,
  bento: BentoBoxV1,
  pair: KashiPair,
  kashiPair: PairData,
  inSolvent: string[]
): Promise<InSolventBorrower[]> {
  if (inSolvent.length === 0) return []

  const [totalBorrow, exchangeRate] = await Promise.all([pair.accruedTotalBorrow(), pair.updateExchangeRate()])

  const res: InSolventBorrower[] = await Promise.all(
    inSolvent.map(async (b) => {
      const [borrowPart, collateralShare] = await Promise.all([pair.userBorrowPart(b), pair.userCollateralShare(b)])
      const collateralUsed = collateralShare.mul(E18)
      const collateralUsedAmount = await bento.toAmount(kashiPair.collateral.address(), collateralUsed)
      const borrowCostInCollateral = parseFloat(
        borrowPart.mul(totalBorrow.elastic).mul(exchangeRate).div(totalBorrow.base).toString()
      )
      const borrowAmount = parseFloat(borrowPart.mul(totalBorrow.elastic).div(totalBorrow.base).toString())
      const collateralAmount = parseFloat(collateralUsedAmount.toString())

      return {
        address: b,
        collateralShare: parseFloat(collateralShare.toString()),
        collateralAmount,
        borrowAmount,
        borrowCostInCollateral,
        coverage: (borrowCostInCollateral / collateralAmount) * 100,
      }
    })
  )

  return res
}

export async function getAllKashiPairsBentoV1(network: Network): Promise<PairData[]> {
  const logs = await getLogs(network, {
    address: network.bentoBoxV1Address,
    event: 'LogDeploy(address,bytes,address)',
    address1: network.kashPairMasterAddress,
  })

  const pairs = await Promise.all(logs.map((l) => getPairData(network, l)))

  let totalForLiquidation = 0
  let totalBorrowers = 0
  let totalLiquidates = 0
  const liquidators = new Map<string, number>()
  pairs.forEach((p) => {
    totalForLiquidation += p.inSolventBorrowers ? p.inSolventBorrowers.length : 0
    totalBorrowers += p.borrowers.length
    totalLiquidates += p.liquidateTxs.length
    p.liquidateTxs.forEach((t) => {
      const prev = liquidators.get(t.from)
      if (prev === undefined) liquidators.set(t.from, 1)
      else liquidators.set(t.from, prev + 1)
    })
  })

  console.log(`Kashi liquidation statistics for ${network.name}`)
  console.log(`Total number of pairs: ${pairs.length}`)
  console.log(`Total number of borrowers: ${totalBorrowers}`)
  console.log(`Total number of insolvent borrowers: ${totalForLiquidation}`)
  console.log(`Total number of liquidations: ${totalLiquidates}`)
  console.log('Liquidators:')
  liquidators.forEach((num, from) => console.log(`    ${from} - ${num}`))

  return pairs
}
