import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { PineconeStore } from '@langchain/pinecone'
import { formatDocumentsAsString } from 'langchain/util/document'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
// import { ChatPromptTemplate, HumanMessagePromptTemplate, SystemMessagePromptTemplate } from '@langchain/core/prompts'
import { ChatPromptTemplate } from '@langchain/core/prompts'

import * as dotenv from 'dotenv'
dotenv.config()

export const run = async (params) => {
    const question = params[0]
    console.log('Prompt:', question)
    console.log('Reading existing index...')
    const pinecone = new Pinecone()
    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX)
    const namespace = 'local'
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
    const results = await vectorStore.similaritySearch(question, 4)
    const context = formatDocumentsAsString(results)
    console.log('Context:', context)
    console.log('Creating retrieval chain...')
    // Create a system & human prompt for the chat model
    const SYSTEM_TEMPLATE = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    ----------------
    {context}`
    const messages = [
        // SystemMessagePromptTemplate.fromTemplate(SYSTEM_TEMPLATE),
        // HumanMessagePromptTemplate.fromTemplate('{question}')
        ['system', SYSTEM_TEMPLATE],
        // add history here, loop through question/answer pairs
        ['human', 'Hey, I\'m Bob'],
        ['ai', 'Hi Bob! How can I help you'],
        // now add the question
        ['human', '{question}']
    ]
    const prompt = ChatPromptTemplate.fromMessages(messages)
    // invoke the prompt to debug the generated prompt
    // const text = await prompt.invoke({ context, question })
    // console.log('Prompt:', text)
    const chain = RunnableSequence.from([
        prompt,
        llm,
        new StringOutputParser()
    ])
    console.log('Querying chain...')
    const res = await chain.invoke({ context, question })
    console.log('Response:', res)
}

// run(process.argv.slice(2))
run(['Name some real-world applications of graphs'])
// run(['What\'s my name?'])
