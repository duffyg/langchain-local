// https://thecodebarbarian.com/getting-started-with-vector-databases-in-node-js.html
import { ChromaClient, OpenAIEmbeddingFunction } from 'chromadb'
import * as dotenv from 'dotenv'
dotenv.config()

const client = new ChromaClient()
const embedder = new OpenAIEmbeddingFunction({ openai_api_key: process.env.OPENAI_API_KEY })

// const collection = await client.createCollection({
//     name: "my_collection",
//     embeddingFunction: embedder
// })
const collection = await client.getCollection({
    name: 'my_collection',
    embeddingFunction: embedder
})

const embeddings = await embedder.generate([
    'apple jumped 10% today',
    'i like apple pie'
])
// An array of 1536 numbers: [-0.016792895, -0.015178694, 0.015230765]
console.log(embeddings[0])

await collection.add({
    ids: ['id1', 'id2'],
    embeddings,
    metadatas: [{ category: 'Stocks' }, { category: 'Food' }]
})

const results = await collection.query({
    nResults: 1,
    queryTexts: [
        'is apple stock a good buy?',
        'i ate an apple flavored jolly rancher',
        'when is Apple\'s next earnings call?',
        'add 7 cups of thinly sliced apples'
    ]
})
// Correct classification: ['Stocks', 'Food', 'Stocks', 'Food']
console.log('Results', results.metadatas.map(res => res[0].category))
