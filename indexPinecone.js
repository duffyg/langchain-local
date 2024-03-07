import { PDFLoader } from 'langchain/document_loaders/fs/pdf'

import { OpenAIEmbeddings } from '@langchain/openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStore } from '@langchain/pinecone'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

import * as dotenv from 'dotenv'
dotenv.config()

export const run = async (params) => {
    const pinecone = new Pinecone()
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX)
    const namespace = process.env.PINECONE_NAMESPACE
    const embeddings = new OpenAIEmbeddings()
    const pineconeStore = new PineconeStore(embeddings, { pineconeIndex, namespace })

    // can't delete by filter on Pinecone starter index
    // possible when serverless but needs a paginated list call
    // workaround is to store IDs in mongodb after adding the docs/chunks
    // console.log('Deleting existing vectors from vector store...')
    // await pineconeStore.delete({
    //     namespace: '',
    //     filter: {
    //         docRecordId: 'dsajs-book-v2.7.4'
    //     }
    // })

    // this works, even for the default namespace (namespace: '')
    try {
        await pineconeStore.delete({
            namespace: 'local',
            deleteAll: true
        })
    } catch (err) {
        console.error('Vector delete failed:', err)
    }

    console.log('Loading doc...')
    const loader = new PDFLoader('./docs/dsajs-book-v2.7.4.pdf', {
        splitPages: false
    })
    const docs = await loader.load()

    console.log('Splitting doc...')
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 100
    })
    const chunks = await textSplitter.createDocuments([docs[0].pageContent])

    for (const doc of chunks) {
        // default metadata has loc.lines.from and loc.lines.to which we don't need
        // so overwrite with our own object
        // doc.metadata.tenantId = process.env.PINECONE_NAMESPACE
        // doc.metadata.docTypeId = 'SOP'
        // doc.metadata.docRecordId = 'dsajs-book-v2.7.4'
        doc.metadata = {
            // tenantId: process.env.PINECONE_NAMESPACE,
            docTypeId: 'SOP',
            docRecordId: 'dsajs-book-v2.7.4'
        }
    }

    console.log('Adding to vector store...')
    const ids = await pineconeStore.addDocuments(chunks)
    console.log('ids', ids)
    // now store the IDs in mongodb to use when deleting the chunks

    // Instantiate a new Pinecone client, which will automatically read the
    // env vars: PINECONE_API_KEY and PINECONE_ENVIRONMENT which come from
    // the Pinecone dashboard at https://app.pinecone.io
    // const vectorStore = await PineconeStore.fromDocuments(chunks, embeddings, {
    //     pineconeIndex,
    //     namespace
    // })

    console.log('Vector store updated.')
}

run(process.argv.slice(2))
