import OpenAI from './openai.js'
import Pinecone from './pinecone.js'
import * as uuid from 'uuid'
import { readFileSync } from 'fs'
import { RecursiveCharacterTextSplitter } from './textSplitter.js'

import * as dotenv from 'dotenv'
dotenv.config()

const main = async () => {
    const pinecone = new Pinecone()
    const openai = new OpenAI()

    // delete by IDs
    const docRecord = null
    if (docRecord) await pinecone.deleteMany(docRecord.vectorIds)
    // delete all vectors from namespace
    // await pinecone.deleteAll()

    const dataBuffer = readFileSync('./docs/dsajs-book-v2.7.4.pdf')
    const textContent = await getTextFromPdf(dataBuffer)

    console.log('Splitting doc...')
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100
    })
    const chunks = await textSplitter.createDocuments([textContent])

    const ids = chunks.map(() => uuid.v4())
    const texts = chunks.map(({ pageContent }) => pageContent)
    const embeddings = await openai.embedDocuments(texts)
    const vectors = []
    for (let i = 0, n = chunks.length; i < n; i++) {
        vectors.push({
            id: ids[i],
            values: embeddings[i],
            metadata: {
                docTypeId: 'SOP',
                docRecordId: 'dsajs-book-v2.7.4',
                text: texts[i]
            }
        })
    }

    console.log('Adding to vector store...')
    await pinecone.addVectors(vectors)
    // console.log('ids', ids)

    console.log('Vector store updated.')
    return ids
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
async function getTextFromPdf (raw) {
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

main()
