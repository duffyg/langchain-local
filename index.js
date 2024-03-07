// 1. Import document loaders for different file formats
// import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
// import { TextLoader } from 'langchain/document_loaders/fs/text'
// import { JSONLoader } from 'langchain/document_loaders/fs/json'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'

// 2. Import OpenAI langugage model and other related modules
import { OpenAI, OpenAIEmbeddings } from '@langchain/openai'
// import { RetrievalQAChain, loadQARefineChain } from 'langchain/chains'
import { RetrievalQAChain } from 'langchain/chains'
// import { HNSWLib } from 'langchain/community/vectorstores/hnswlib'
import { Chroma } from '@langchain/community/vectorstores/chroma'
// import { Pinecone } from "@pinecone-database/pinecone"
// import { PineconeStore } from "@langchain/pinecone"
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

// 3. Import dotenv for loading environment variables and fs for file system operations
import * as dotenv from 'dotenv'

// 4. Load Environment Variables
dotenv.config()

// 5. Load local files such as .json and .txt from ./docs
// const loader = new DirectoryLoader('./docs', {
//   '.json': (path) => new JSONLoader(path),
//   '.txt': (path) => new TextLoader(path)
// sss})

// 6. Define a function to normalize the content of the documents
const normalizeDocuments = (docs) => {
    return docs.map((doc) => {
        if (typeof doc.pageContent === 'string') {
            return doc.pageContent
        }
        if (Array.isArray(doc.pageContent)) {
            return doc.pageContent.join('\n')
        }
        return ''
    })
}

// const VECTOR_STORE_PATH = 'Documents.index'

// 7. Define the main function to run the entire process
export const run = async (params) => {
    const prompt = params[0]
    console.log('Prompt:', prompt)

    console.log('Loading docs...')
    const loader = new PDFLoader('./docs/dsajs-book-v2.7.4.pdf', {
        splitPages: false
    })
    const docs = await loader.load()

    console.log('Processing...')
    const llm = new OpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, modelName: process.env.OPENAI_API_MODEL })

    // let vectorStore;

    console.log('Creating new vector store...')
    const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000
    })
    const normalizedDocs = normalizeDocuments(docs)
    const splitDocs = await textSplitter.createDocuments(normalizedDocs)

    // 8. Generate the vector store from the documents

    // Instantiate a new Pinecone client, which will automatically read the
    // // env vars: PINECONE_API_KEY and PINECONE_ENVIRONMENT which come from
    // // the Pinecone dashboard at https://app.pinecone.io
    // const pinecone = new Pinecone()
    // const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX)
    // const vectorStore = await PineconeStore.fromDocuments(docs, new OpenAIEmbeddings(), {
    //     pineconeIndex,
    //     maxConcurrency: 5, // Maximum number of batch requests to allow at once. Each batch is 1000 vectors.
    // })

    // pip install chromadb
    // chroma run --host localhost --port 8000 --path users/ger/ai/chroma_db
    const vectorStore = await Chroma.fromDocuments(splitDocs, new OpenAIEmbeddings(), {
        collectionName: 'a-test-collection',
        url: 'http://localhost:8000', // Optional, will default to this value
        collectionMetadata: {
            'hnsw:space': 'cosine'
        } // Optional, can be used to specify the distance method of the embedding space https://docs.trychroma.com/usage-guide#changing-the-distance-function
    })

    // const vectorStore = await HNSWLib.fromDocuments(
    //     docs,
    //     new OpenAIEmbeddings()
    // )

    // await vectorStore.save(VECTOR_STORE_PATH)
    console.log('Vector store created.')

    console.log('Creating retrieval chain...')
    // 9. Query the retrieval chain with the specified question
    const chain = RetrievalQAChain.fromLLM(
        llm,
        vectorStore.asRetriever()
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
