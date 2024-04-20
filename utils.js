export async function chat (openai, messages, options) {
    options = options || {}
    const response = await openai.chat.completions.create({
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
export const chunkArray = (arr, chunkSize) => arr.reduce((chunks, elem, index) => {
    const chunkIndex = Math.floor(index / chunkSize)
    const chunk = chunks[chunkIndex] || []
    chunks[chunkIndex] = chunk.concat([elem])
    return chunks
}, [])
const stripNewLines = true
const batchSize = 512
export async function embedDocuments (openai, texts) {
    const batches = chunkArray(stripNewLines ? texts.map((t) => t.replace(/\n/g, ' ')) : texts, batchSize)
    const batchRequests = batches.map((batch) => {
        return openai.embeddings.create({
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
export async function embedQuery (openai, input) {
    const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL,
        input: stripNewLines ? input.replace(/\n/g, ' ') : input
    })
    const embedding = response.data[0].embedding
    return embedding
}
export const formatDocumentsAsString = (documents) => documents.map((e) => e.metadata.text).join('\n\n')
export async function similaritySearch (pinecone, vector, options) {
    const index = pinecone.index(process.env.PINECONE_INDEX)
    const ns = index.namespace(process.env.PINECONE_NAMESPACE)
    const results = await ns.query({
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
