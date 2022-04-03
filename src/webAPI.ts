import { Network } from './networks'

export async function callAPI<T>(network: Network, call: () => Promise<T>): Promise<T> {
    for(let i = 0; i < 4; ++i) {
        await network.web3Trottle()
        try {
            return await call()
        } catch(e) {
            //console.log(`Iteration ${i}`, e);            
            continue
        }
    }
    await network.web3Trottle()
    return await call()
}

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export async function callMethod(network: Network, method: any): Promise<any> {
    return await callAPI(network, method.call)
}
