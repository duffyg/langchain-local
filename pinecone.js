import { chunkArray } from './utils.js'
import { Pinecone as PineconeClient } from '@pinecone-database/pinecone'
export default class Pinecone {
    constructor (options) {
        options = options || {}
        this.client = new PineconeClient({
            apiKey: options.apiKey || process.env.PINECONE_API_KEY
        })
        this.index = this.client.index(options.index || process.env.PINECONE_INDEX)
        // the tenantId must be passed as the options namespace variable
        this.ns = this.index.namespace(options.namespace)
        this.batchSize = 100
    }

    async addVectors (vectors) {
        // Pinecone recommends a limit of 100 vectors per upsert request
        const chunkSize = 100
        const chunkedVectors = chunkArray(vectors, chunkSize)
        const batchRequests = chunkedVectors.map((chunk) => this.ns.upsert(chunk))
        await Promise.all(batchRequests)
    }

    async deleteAll () {
        // delete all vectors from namespace
        try {
            await this.ns.deleteAll()
        }
        catch (err) {
            console.error('Vector delete failed:', err)
        }
    }

    async deleteMany (param) {
        // can't delete by metadata filter on Pinecone starter index
        // possible when serverless but needs a paginated list call
        // workaround is to store IDs in mongodb after adding the docs/chunks
        // console.log('Deleting existing vectors from vector store...')
        await this.ns.deleteMany(param)
    }

    async similaritySearch (vector, options) {
        const results = await this.ns.query({
            vector,
            topK: options.topK,
            filter: options.filter,
            includeMetadata: true
        })
        const result = []
        if (results.matches) {
            for (const e of results.matches) {
                if (e.score) {
                    result.push({ metadata: e.metadata, score: e.score })
                }
            }
        }
        return result
    }
}
