import { OpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStore } from '@langchain/pinecone'
// import { RetrievalQAChain, loadQARefineChain } from 'langchain/chains'
import { RetrievalQAChain } from 'langchain/chains'

import * as dotenv from 'dotenv'
dotenv.config()

export const run = async (params) => {
    const prompt = params[0]
    console.log('Prompt:', prompt)
    console.log('Reading existing index...')
    const pinecone = new Pinecone()
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX)
    const namespace = process.env.PINECONE_NAMESPACE
    const embeddings = new OpenAIEmbeddings()
    const llm = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, modelName: process.env.OPENAI_API_MODEL })
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        namespace,
        filter: {
            docRecordId: 'dxxxsajs-book-v2.7.4'
        }
    })
    console.log('Creating retrieval chain...')
    const chain = RetrievalQAChain.fromLLM(
        llm,
        vectorStore.asRetriever(),
        { verbose: true }
    )

    // const chain = new RetrievalQAChain({
    //   combineDocumentsChain: loadQARefineChain(model),
    //   retriever: vectorStore.asRetriever(),
    // });

    console.log('Querying chain...')
    const res = await chain.invoke({
        query: prompt
    })

    console.log('Response:', res.text || res.output_text)
}

run(process.argv.slice(2))
