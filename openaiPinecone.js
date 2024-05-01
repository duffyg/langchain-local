import OpenAI from './openai.js'
import Pinecone from './pinecone.js'
import { v4 as uuidv4 } from 'uuid'
import { readFileSync } from 'fs'
import { getTextFromPdf, RecursiveCharacterTextSplitter } from './textSplitter.js'

import * as dotenv from 'dotenv'
dotenv.config()

const main = async () => {
    const namespace = 'local'
    const pinecone = new Pinecone({ namespace })
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

    const vectorIds = chunks.map(() => uuidv4())
    const texts = chunks.map(({ pageContent }) => pageContent)
    const embeddings = await openai.embedDocuments(texts)
    const vectors = []
    for (let i = 0, n = chunks.length; i < n; i++) {
        vectors.push({
            id: vectorIds[i],
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
}

main()
