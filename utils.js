export async function chat (openai, options) {
    const messages = []
    if (options.systemMessage) messages.push({ role: 'system', content: options.systemMessage })
    if (options.userMessage) messages.push({ role: 'user', content: options.userMessage })
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
export async function embedQuery (openai, input) {
    const response = await openai.embeddings.create({
        model: process.env.EMBEDDING_MODEL,
        input
    })
    const embedding = response.data[0].embedding
    return embedding
}
export const formatDocumentsAsString = (documents) => documents.map((e) => e.metadata.text).join('\n\n')
export async function similaritySearch (pinecone, vector, options) {
    const namespace = process.env.PINECONE_NAMESPACE
    const index = pinecone.index(process.env.PINECONE_INDEX)
    const results = await index.namespace(namespace).query({
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
