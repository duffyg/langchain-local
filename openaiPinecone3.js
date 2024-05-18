import OpenAI from './openai.js'
import Pinecone from './pinecone.js'

import * as dotenv from 'dotenv'
dotenv.config()

const main = async (params) => {
    const question = params[0]
    console.log('Prompt:', question)
    console.log('Reading existing index...')
    const namespace = 'local'
    const pinecone = new Pinecone({ namespace })
    const openai = new OpenAI()
    const vector = await openai.embedQuery(question)
    // console.log(vector)
    const results = await pinecone.similaritySearch(vector, {
        topK: 4,
        filter: {
            docRecordId: 'dsajs-book-v2.7.4'
        }
    })
    // console.log(results)
    const context = results.map((e) => e.metadata.text).join('\n\n')
    console.log('Context:', context)
    const prompt = `Use the following pieces of context to answer the question at the end.
    If you don't know the answer, just say that you don't know, don't try to make up an answer.
    ----------------
    ${context}`
    const messages = []
    messages.push({ role: 'system', content: prompt })
    messages.push({ role: 'user', content: question })
    const answer = await openai.chat(messages)
    console.log(answer)
}

main(['Name some real-world applications of graphs'])
