# A Tool to calculate Kashi liquidation statistics

## Supported networks
- Ethereum
- Kovan
- Polygon

## Installation

- Clone the repo
- Sign up at https://auth.alchemyapi.io/signup, copy the key to env variable ALCHEMY_API_KEY. A free account is enough
- For Ethereum & Kovan, sign up at https://etherscan.io/apis, copy the key to env variable ETHERSCAN_API_KEY. A free account is enough
- For Polygon, sign up at https://polygonscan.com/apis, copy the key to env variable POLYGONSCAN_API_KEY. A free account is enough
- yarn

## Launching
yarn statistics \<network\> \<command\> \<args\>

\<network\> - ether, polygon, kovan

\<command\>:
- insolvent  - show all insolvent borrowers
- borrowers \<min coverage%\>  - show all borrowers with coverage more than \<min coverage %\>

Examples: 
- yarn statistics polygon borrowers 10
- yarn statistics polygon insolvent   

## Known Issues
Alchemistry API failed to process too many requests simultaniously. But exactly maximum quantity of requests per seconds
varies significantly from time and region. If works instable - reduce web3Trottle first argument in networks.ts
## Licence

UNLICENCED
