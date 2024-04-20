import OpenAI from 'openai'
import { Pinecone } from '@pinecone-database/pinecone'
import { chat, embedQuery, formatDocumentsAsString, similaritySearch } from './utils.js'

import * as dotenv from 'dotenv'
dotenv.config()

const main = async (params) => {
    const question = params[0]
    console.log('Prompt:', question)
    console.log('Reading existing index...')
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    const vector = await embedQuery(openai, question)
    // console.log(vector)
    const results = await similaritySearch(pinecone, vector, {
        topK: 4,
        filter: {
            docRecordId: 'dsajs-book-v2.7.4'
        }
    })
    // console.log(results)
    const context = formatDocumentsAsString(results)
    console.log('Context:', context)
    const prompt = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    ----------------
    ${context}`
    const messages = []
    messages.push({ role: 'system', content: prompt })
    messages.push({ role: 'user', content: question })
    const answer = await chat(openai, { messages })
    console.log(answer)
}

main(['Name some real-world applications of graphs'])
