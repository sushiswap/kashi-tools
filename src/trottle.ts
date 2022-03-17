
export function getTrottle(times: number, intervalMS: number): () => void {
    const lastTrorrledCalls: number[] = []
    const trottle = async () => {
        const now = Date.now()
        while(lastTrorrledCalls.length > 0) {
            const first = lastTrorrledCalls[0]
            if ((now - first) < intervalMS) break
            lastTrorrledCalls.shift()
        }
        if (lastTrorrledCalls.length < times) {
            lastTrorrledCalls.push(now)
            return
        }
        await new Promise(resolve => setTimeout(resolve, intervalMS + lastTrorrledCalls[0] - now + 1))
        await trottle()
    }
    return trottle
}

// testing
// async function test () {
//     const trot = getTrottle(2, 1000)
//     const arr = []
//     for (let i = 0; i < 100; ++i) arr.push(i)
//     await Promise.all(arr.map(async n => {
//         await trot()
//         console.log(n);
//     }))
// }
// test()