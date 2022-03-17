import * as fs from 'fs'
import * as path from 'path'

const cacheDir = './cache'
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir)

const defaultHash = (a:any) => a.toString()

const caches = new Map<string, any>()
export function wrapPermCache<Result>(func: (...a: any[]) => Promise<Result>, hashFunc: (...a: any[]) => string): 
    (...a: any[]) => Promise<Result> {
    const fileName = path.resolve(cacheDir, func.name)
    hashFunc = hashFunc || defaultHash
    let cache = caches.get(func.name)
    if (cache === undefined) {
        let fileData = ''
        try {
            fileData = fs.readFileSync(fileName, {encoding: 'utf8', flag: 'r'})
        } catch (e) {
            fileData = ''
        }
        const records = fileData.split('\n')
        cache = {}
        records.forEach(r => {
            if (r.trim() == '') return
            const separatorIndex = r.search(' ')
            const hash = r.substring(0, separatorIndex)
            const data = JSON.parse(r.substring(separatorIndex+1))
            cache[hash] = data
        })
        caches.set(func.name, cache)
    }
    return async (...args) => {
        const hash = hashFunc(...args)
        // const cached = cache[hash]
        // if (cached) return cached
        if (hash in cache) return cache[hash]
        const res = await func(...args)
        if (!(hash in cache)) {
            cache[hash] = res
            fs.writeFileSync(
                fileName, 
                `${hash} ${JSON.stringify(res)}\n`, 
                {encoding: 'utf8', flag: 'a'}
            )
        }
        return res
    }
}