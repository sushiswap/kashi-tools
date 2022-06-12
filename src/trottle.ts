export function getTrottle(times: number, intervalMS: number): () => void {
  const lastTrorrledCalls: number[] = []
  const trottle = async () => {
    const now = Date.now()
    while (lastTrorrledCalls.length > 0) {
      const first = lastTrorrledCalls[0]
      if (now - first < intervalMS) break
      lastTrorrledCalls.shift()
    }
    if (lastTrorrledCalls.length < times) {
      lastTrorrledCalls.push(now)
      return
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMS + lastTrorrledCalls[0] - now + 1))
    await trottle()
  }
  return trottle
}
