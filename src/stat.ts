import 'dotenv/config'
import { getBorrowers } from './getBorrowers'
import { getAllKashiPairsBentoV1 } from './getKashiPairsInfo'
import { Network, networks } from './networks'

function getNetwork(name: string): Network {
  switch (name) {
    case 'ether':
      return networks.Ethereum
    case 'polygon':
      return networks.Polygon
    case 'kovan':
      return networks.Kovan
    default:
      console.log(`Unknown network: ${name}. Variants are: ether, polygon, kovan`)
      throw new Error()
  }
}

const network = getNetwork(process.argv[2])

switch (process.argv[3]) {
  case 'insolvent':
    getAllKashiPairsBentoV1(network)
    break
  case 'borrowers':
    getBorrowers(network, process.argv[4] === undefined ? 50 : parseFloat(process.argv[4]))
    break
  default:
    console.log(`Unknown command: ${process.argv[3]}. Variants are: insolvent, borrowers <min %>`)
}
