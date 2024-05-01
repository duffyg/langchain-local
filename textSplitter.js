class TextSplitter {
    constructor (fields) {
        fields = fields || {}
        this.chunkSize = fields.chunkSize || 1000
        this.chunkOverlap = fields.chunkOverlap ?? 200
        this.keepSeparator = fields.keepSeparator ?? false
        this.lengthFunction =
            fields?.lengthFunction ?? ((text) => text.length)
        if (this.chunkOverlap >= this.chunkSize) {
            throw new Error('Cannot have chunkOverlap >= chunkSize')
        }
    }

    splitOnSeparator (text, separator) {
        let splits
        if (separator) {
            if (this.keepSeparator) {
                const regexEscapedSeparator = separator.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')
                splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`))
            }
            else {
                splits = text.split(separator)
            }
        }
        else {
            splits = text.split('')
        }
        return splits.filter((s) => s !== '')
    }

    async createDocuments (texts,
        metadatas = [], chunkHeaderOptions = {}) {
        // if no metadata is provided, we create an empty one for each text
        const _metadatas = metadatas.length > 0
            ? metadatas
            : [...Array(texts.length)].map(() => ({}))
        const { chunkHeader = '', chunkOverlapHeader = "(cont'd) ", appendChunkOverlapHeader = false } = chunkHeaderOptions
        const documents = []
        for (let i = 0; i < texts.length; i += 1) {
            const text = texts[i]
            let lineCounterIndex = 1
            let prevChunk = null
            let indexPrevChunk = -1
            for (const chunk of await this.splitText(text)) {
                let pageContent = chunkHeader
                // we need to count the \n that are in the text before getting removed by the splitting
                const indexChunk = text.indexOf(chunk, indexPrevChunk + 1)
                if (prevChunk === null) {
                    const newLinesBeforeFirstChunk = this.numberOfNewLines(text, 0, indexChunk)
                    lineCounterIndex += newLinesBeforeFirstChunk
                }
                else {
                    const indexEndPrevChunk = indexPrevChunk + (await this.lengthFunction(prevChunk))
                    if (indexEndPrevChunk < indexChunk) {
                        const numberOfIntermediateNewLines = this.numberOfNewLines(text, indexEndPrevChunk, indexChunk)
                        lineCounterIndex += numberOfIntermediateNewLines
                    }
                    else if (indexEndPrevChunk > indexChunk) {
                        const numberOfIntermediateNewLines = this.numberOfNewLines(text, indexChunk, indexEndPrevChunk)
                        lineCounterIndex -= numberOfIntermediateNewLines
                    }
                    if (appendChunkOverlapHeader) {
                        pageContent += chunkOverlapHeader
                    }
                }
                const newLinesCount = this.numberOfNewLines(chunk)
                const loc = _metadatas[i].loc && typeof _metadatas[i].loc === 'object'
                    ? { ..._metadatas[i].loc }
                    : {}
                loc.lines = {
                    from: lineCounterIndex,
                    to: lineCounterIndex + newLinesCount
                }
                const metadataWithLinesNumber = {
                    ..._metadatas[i],
                    loc
                }
                pageContent += chunk
                documents.push({
                    pageContent,
                    metadata: metadataWithLinesNumber
                })
                lineCounterIndex += newLinesCount
                prevChunk = chunk
                indexPrevChunk = indexChunk
            }
        }
        return documents
    }

    numberOfNewLines (text, start, end) {
        const textSection = text.slice(start, end)
        return (textSection.match(/\n/g) || []).length
    }

    async splitDocuments (documents, chunkHeaderOptions = {}) {
        const selectedDocuments = documents.filter((doc) => doc.pageContent !== undefined)
        const texts = selectedDocuments.map((doc) => doc.pageContent)
        const metadatas = selectedDocuments.map((doc) => doc.metadata)
        return this.createDocuments(texts, metadatas, chunkHeaderOptions)
    }

    joinDocs (docs, separator) {
        const text = docs.join(separator).trim()
        return text === '' ? null : text
    }

    async mergeSplits (splits, separator) {
        const docs = []
        const currentDoc = []
        let total = 0
        for (const d of splits) {
            const _len = await this.lengthFunction(d)
            if (total + _len + (currentDoc.length > 0 ? separator.length : 0) >
                this.chunkSize) {
                if (total > this.chunkSize) {
                    console.warn(`Created a chunk of size ${total}, +
which is longer than the specified ${this.chunkSize}`)
                }
                if (currentDoc.length > 0) {
                    const doc = this.joinDocs(currentDoc, separator)
                    if (doc !== null) {
                        docs.push(doc)
                    }
                    // Keep on popping if:
                    // - we have a larger chunk than in the chunk overlap
                    // - or if we still have any chunks and the length is long
                    while (total > this.chunkOverlap ||
                        (total + _len > this.chunkSize && total > 0)) {
                        total -= await this.lengthFunction(currentDoc[0])
                        currentDoc.shift()
                    }
                }
            }
            currentDoc.push(d)
            total += _len
        }
        const doc = this.joinDocs(currentDoc, separator)
        if (doc !== null) {
            docs.push(doc)
        }
        return docs
    }
}
export class RecursiveCharacterTextSplitter extends TextSplitter {
    static lc_name () {
        return 'RecursiveCharacterTextSplitter'
    }

    constructor (fields) {
        super(fields)
        this.separators = ['\n\n', '\n', ' ', '']
        this.separators = fields?.separators ?? this.separators
        this.keepSeparator = fields?.keepSeparator ?? true
    }

    async _splitText (text, separators) {
        const finalChunks = []
        // Get appropriate separator to use
        let separator = separators[separators.length - 1]
        let newSeparators
        for (let i = 0; i < separators.length; i += 1) {
            const s = separators[i]
            if (s === '') {
                separator = s
                break
            }
            if (text.includes(s)) {
                separator = s
                newSeparators = separators.slice(i + 1)
                break
            }
        }
        // Now that we have the separator, split the text
        const splits = this.splitOnSeparator(text, separator)
        // Now go merging things, recursively splitting longer texts.
        let goodSplits = []
        const _separator = this.keepSeparator ? '' : separator
        for (const s of splits) {
            if ((await this.lengthFunction(s)) < this.chunkSize) {
                goodSplits.push(s)
            }
            else {
                if (goodSplits.length) {
                    const mergedText = await this.mergeSplits(goodSplits, _separator)
                    finalChunks.push(...mergedText)
                    goodSplits = []
                }
                if (!newSeparators) {
                    finalChunks.push(s)
                }
                else {
                    const otherInfo = await this._splitText(s, newSeparators)
                    finalChunks.push(...otherInfo)
                }
            }
        }
        if (goodSplits.length) {
            const mergedText = await this.mergeSplits(goodSplits, _separator)
            finalChunks.push(...mergedText)
        }
        return finalChunks
    }

    async splitText (text) {
        return this._splitText(text, this.separators)
    }

    static fromLanguage (language, options) {
        return new RecursiveCharacterTextSplitter({
            ...options,
            separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage(language)
        })
    }
}
async function PDFLoaderImports () {
    try {
        const { default: mod } = await import('pdf-parse/lib/pdf.js/v1.10.100/build/pdf.js')
        const { getDocument, version } = mod
        return { getDocument, version }
    }
    catch (e) {
        console.error(e)
        throw new Error('Failed to load pdf-parse. Please install it with eg. `npm install pdf-parse`.')
    }
}
export async function getTextFromPdf (raw) {
    const { getDocument } = await PDFLoaderImports()
    const pdf = await getDocument({
        data: new Uint8Array(raw),
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
    }).promise
    // const meta = await pdf.getMetadata().catch(() => null)
    const documents = []
    for (let i = 1; i <= pdf.numPages; i += 1) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        if (content.items.length === 0) {
            continue
        }
        // Eliminate excessive newlines
        // Source: https://github.com/albertcui/pdf-parse/blob/7086fc1cc9058545cdf41dd0646d6ae5832c7107/lib/pdf-parse.js#L16
        let lastY
        const textItems = []
        for (const item of content.items) {
            if ('str' in item) {
                if (lastY === item.transform[5] || !lastY) {
                    textItems.push(item.str)
                }
                else {
                    textItems.push(`\n${item.str}`)
                }
                // eslint-disable-next-line prefer-destructuring
                lastY = item.transform[5]
            }
        }
        const parsedItemSeparator = ''
        const text = textItems.join(parsedItemSeparator)
        documents.push(text)
    }
    const splitPages = false
    if (splitPages) return documents
    return documents.join('\n\n')
}
