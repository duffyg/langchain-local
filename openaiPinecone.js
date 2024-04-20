import OpenAI from 'openai'
import * as uuid from 'uuid'
// import { readFileSync } from 'fs'
// import pdf from 'pdf-parse'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { Pinecone } from '@pinecone-database/pinecone'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { chunkArray, embedDocuments } from './utils.js'

import * as dotenv from 'dotenv'
dotenv.config()

const main = async () => {
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
    const index = pinecone.index(process.env.PINECONE_INDEX)
    const ns = index.namespace(process.env.PINECONE_NAMESPACE)
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    // const embeddings = new OpenAIEmbeddings()
    // const pineconeStore = new PineconeStore(embeddings, { pineconeIndex, namespace })

    // can't delete by filter on Pinecone starter index
    // possible when serverless but needs a paginated list call
    // workaround is to store IDs in mongodb after adding the docs/chunks
    // console.log('Deleting existing vectors from vector store...')
    // await ns.deleteMany({
    //     docRecordId: 'dsajs-book-v2.7.4'
    // })
    // delete by IDs
    const docRecord = null
    if (docRecord) await ns.deleteMany(docRecord.vectorIds)

    // delete all vectors from namespace
    // try {
    //     await ns.deleteAll()
    // }
    // catch (err) {
    //     console.error('Vector delete failed:', err)
    // }
    console.log('Loading doc...')
    const loader = new PDFLoader('./docs/dsajs-book-v2.7.4.pdf', {
        splitPages: false
    })
    const docs = await loader.load()
    // const dataBuffer = readFileSync('./docs/dsajs-book-v2.7.4.pdf')

    // let textContent
    // pdf(dataBuffer).then(function (data) {
    //     textContent = data.text
    // })

    console.log('Splitting doc...')
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100
    })
    const chunks = await textSplitter.createDocuments([docs[0].pageContent])
    // const chunks = await textSplitter.createDocuments(textContent)

    const ids = chunks.map(() => uuid.v4())
    const texts = chunks.map(({ pageContent }) => pageContent)
    const embeddings = await embedDocuments(openai, texts)
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
    // Pinecone recommends a limit of 100 vectors per upsert request
    // await ns.upsert(vectors)
    const chunkSize = 100
    const chunkedVectors = chunkArray(vectors, chunkSize)
    const batchRequests = chunkedVectors.map((chunk) => ns.upsert(chunk))
    await Promise.all(batchRequests)
    // console.log('ids', ids)

    console.log('Vector store updated.')
    return ids
}

main()
