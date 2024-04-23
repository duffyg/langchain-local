import { chunkArray } from './utils.js'
import { OpenAI as OpenAIClient } from 'openai'
export default class OpenAI {
    constructor (options) {
        options = options || {}
        this.client = new OpenAIClient({
            apiKey: options.apiKey || process.env.OPENAI_API_KEY,
            modelName: options.modelName || process.env.OPENAI_API_MODEL
        })
        this.stripNewLines = true
        this.batchSize = 512
    }

    async chat (messages, options) {
        options = options || {}
        const response = await this.client.chat.completions.create({
            model: process.env.OPENAI_API_MODEL,
            messages,
            temperature: 1,
            max_tokens: 256,
            top_p: 1,
            frequency_penalty: 0,
            presence_penalty: 0,
            stop: options.stop || []
        })
        const content = response.choices[0].message.content
        return content
    }

    async embedDocuments (texts) {
        const batches = chunkArray(this.stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts, this.batchSize)
        const batchRequests = batches.map((batch) => {
            return this.client.embeddings.create({
                model: process.env.EMBEDDING_MODEL,
                input: batch
            })
        })
        const batchResponses = await Promise.all(batchRequests)
        const embeddings = []
        for (let i = 0; i < batchResponses.length; i += 1) {
            const batch = batches[i]
            const { data: batchResponse } = batchResponses[i]
            for (let j = 0; j < batch.length; j += 1) {
                embeddings.push(batchResponse[j].embedding)
            }
        }
        return embeddings
    }

    async embedQuery (input) {
        const response = await this.client.embeddings.create({
            model: process.env.EMBEDDING_MODEL,
            input: this.stripNewLines ? input.replace(/\n/g, ' ') : input
        })
        const embedding = response.data[0].embedding
        return embedding
    }
}
