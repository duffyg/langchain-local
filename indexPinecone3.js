import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStore } from '@langchain/pinecone'
// import { RetrievalQAChain, loadQARefineChain } from 'langchain/chains'

import { formatDocumentsAsString } from 'langchain/util/document'
import {
    RunnablePassthrough,
    RunnableSequence
} from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate
} from '@langchain/core/prompts'

import * as dotenv from 'dotenv'
dotenv.config()

export const run = async (params) => {
    const question = params[0]
    console.log('Prompt:', question)
    console.log('Reading existing index...')
    const pinecone = new Pinecone()
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX)
    const namespace = process.env.PINECONE_NAMESPACE
    const embeddings = new OpenAIEmbeddings()
    const llm = new ChatOpenAI({ modelName: process.env.OPENAI_API_MODEL })
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
        pineconeIndex,
        namespace,
        filter: {
            docRecordId: 'dsajs-book-v2.7.4'
            // docRecordId: 'COA-00001'
        }
    })
    const vectorStoreRetriever = vectorStore.asRetriever()
    console.log('Creating retrieval chain...')
    // Create a system & human prompt for the chat model
    const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    ----------------
    {context}`
    const messages = [
        SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
        HumanMessagePromptTemplate.fromTemplate('{question}')
    ]
    const prompt = ChatPromptTemplate.fromMessages(messages)
    const chain = RunnableSequence.from([
        {
            context: vectorStoreRetriever.pipe(formatDocumentsAsString),
            question: new RunnablePassthrough()
        },
        prompt,
        llm,
        new StringOutputParser()
    ])

    // const chain = RetrievalQAChain.fromLLM(
    //     llm,
    //     vectorStore.asRetriever()
    // )

    // const chain = new RetrievalQAChain({
    //   combineDocumentsChain: loadQARefineChain(model),
    //   retriever: vectorStore.asRetriever(),
    // });

    console.log('Querying chain...')
    const res = await chain.invoke(question)

    // console.log('Response:', res.text || res.output_text)
    console.log('Response:', res)
}

run(process.argv.slice(2))
