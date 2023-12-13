//const htmlparser2 = require("htmlparser2");
import * as htmlparser2 from 'htmlparser2'

self.addEventListener(
    'message',
    async (e: MessageEvent) => {
        async function fetchHtml(url: string): Promise<string> {
            const response = await fetch(url)
            return response.text()
        }

        interface wimg {
            biggestImageCanv?: ImageBitmap
            biggestUrl?: string
            size?: number
        }

        function extractImageUrls(html: string): string[] {
            const regex = /<img[^>]+src=["']?([^"'>\s]+)["']?[^>]*>/gi
            const urls: any[] = []

            const parser = new htmlparser2.Parser(
                {
                    onopentag(name: any, attribs: any) {
                        // Check if the tag is an image tag
                        if (name === 'img' && attribs.src) {
                            // Push the src attribute (URL) to the urls array
                            urls.push(attribs.src)
                            console.log(attribs.src)
                        }
                    },
                },
                { decodeEntities: true },
            )

            // Feed the HTML to the parser
            parser.write(html)
            parser.end()

            return urls
        }

        function getImgSize(img: any) {
            return img ? img.width * img.height : 0
        }
        async function findBiggestImage(url: string): Promise<wimg> {
            try {
                const response = await fetch(url, { method: 'HEAD' })
                const contentType = response.headers.get('Content-Type')

                if (contentType && contentType.startsWith('image/')) {
                    // URL is an image
                    return await loadImage(url)
                }

                const html = await fetchHtml(url)
                const imageUrls = extractImageUrls(html)
                let _biggestImageCanv = undefined
                let _biggestUrl = undefined
                let maxSize = 0

                for (const imageUrl of imageUrls) {
                    try {
                        const { biggestImageCanv, biggestUrl, size } = await loadImage(imageUrl)

                        //const size = getImgSize(biggestImageCanv)
                        if (size > maxSize) {
                            maxSize = size
                            _biggestImageCanv = biggestImageCanv
                            _biggestUrl = biggestUrl
                        }
                    } catch (error) {
                        console.error(`Error loading image: ${imageUrl}`, error)
                    }
                }

                return { biggestImageCanv: _biggestImageCanv, biggestUrl: _biggestUrl }
            } catch (error) {
                console.error('Error:', error)
                return { biggestImageCanv: null, biggestUrl: null }
            }
        }
        const ISCache: any = {}
        function loadImage(url: string): Promise<wimg> {
            return new Promise(async (resolve, reject) => {
                if (ISCache[url]) {
                    resolve(ISCache[url])
                }
                try {
                    const response = await fetch(url)
                    console.log(response)
                    const blob = await response.blob()
                    const img = await createImageBitmap(blob)
                    ISCache[url] = { biggestImageCanv: img, biggestUrl: url, size: blob.size }
                    resolve({ biggestImageCanv: img, biggestUrl: url, size: blob.size })
                    //todo pass url also all the way to ui for full view?
                } catch (e) {
                    console.log('couldnt fetch', url, e)
                    ISCache[url] = {}
                    resolve({})
                }
            })
        }

        const images: string[] = e.data.paths
        const fixedHeight = 256 //e.data.fixedHeight
        // Open the IndexedDB connection
        async function resizeImage(_path: string, fixedHeight: number) {
            const path = _path.replaceAll('\\', '/')
            try {
                const { biggestImageCanv, biggestUrl } = await findBiggestImage(path)

                if (!biggestImageCanv) {
                    return { source: _path, resource: '404' }
                }

                const ratio = biggestImageCanv.width / biggestImageCanv.height
                const newWidth = fixedHeight * ratio
                const offscreenCanvas = new OffscreenCanvas(newWidth, fixedHeight)

                const ctx = offscreenCanvas.getContext('2d')
                if (ctx) {
                    console.log('gotcontext!')
                    ctx.drawImage(biggestImageCanv, 0, 0, newWidth, fixedHeight)
                    console.log('drewimage!')
                    const blob = await offscreenCanvas.convertToBlob()
                    console.log('convertedtoblob!')
                    function blobToBase64(blob: Blob) {
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader()
                            reader.onloadend = () => {
                                const base64data = reader.result as string
                                console.log('convertedtob64!')
                                resolve({ base64data, biggestUrl })
                            }
                            reader.onerror = (error) => {
                                console.log(error)
                                resolve('error')
                                //reject(error)
                            }
                            reader.readAsDataURL(blob)
                        })
                    }
                    return { source: _path, resource: await blobToBase64(blob) }
                } else {
                    console.log(new Error('Failed to get canvas context'))
                    return { source: _path, resource: 'error' }
                }
            } catch (e) {
                console.log(e, path)
                return { source: _path, resource: 'error' }
            }
        }

        const results: { source: string; resource: any }[] = []
        for (const imageSrc of images) {
            try {
                results.push(await resizeImage(imageSrc, fixedHeight))
            } catch (e) {
                console.log(e, imageSrc)
                return { source: imageSrc, resource: 'error' }
            }
        }

        self.postMessage(results)
    },
    false,
)

export default {} as typeof Worker & (new () => Worker)
