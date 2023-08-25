import { openDatabase, addBlobs, retrieveBlobs } from './indexDB'
import _ from 'lodash'
self.addEventListener(
    'message',
    async (e: MessageEvent) => {
        const images: string[] = e.data.images
        const fixedHeight: number = e.data.fixedHeight
        // Open the IndexedDB connection
        const db = await openDatabase()
        const cachedBlobs = await retrieveBlobs(db, images)
        async function resizeImage(path: string, fixedHeight: number) {
            const cached = cachedBlobs.find((bw) => bw.path === path)
            if (cached) {
                console.debug('cache hit', cached)
                return cached
            }
            try {
                const response = await fetch(path)
                const blob = await response.blob()
                const img = await createImageBitmap(blob)

                const ratio = img.width / img.height
                const newWidth = fixedHeight * ratio
                const offscreenCanvas = new OffscreenCanvas(newWidth, fixedHeight)

                const ctx = offscreenCanvas.getContext('2d')
                if (ctx) {
                    ctx.drawImage(img, 0, 0, newWidth, fixedHeight)
                    const blob = await offscreenCanvas.convertToBlob()
                    return { path, blob }
                } else {
                    console.log(new Error('Failed to get canvas context'))
                    return { path, blob: null }
                }
            } catch (e) {
                console.log(e, path)
                return { path, blob: null }
            }
        }

        const results: { path: string; blob: Blob }[] = []
        for (const imageSrc of images) {
            results.push(await resizeImage(imageSrc, fixedHeight))
        }
        const toAdd = _.difference(
            results.filter((res) => res.blob != null),
            cachedBlobs,
        )
        if (toAdd.length > 0) {
            console.log('adding  blobs', toAdd)

            await addBlobs(db, toAdd)
        }

        self.postMessage('done')
    },
    false,
)

export default {} as typeof Worker & (new () => Worker)
