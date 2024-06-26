// https://js.langchain.com/docs/expression_language/cookbook/sql_db
import { DataSource } from 'typeorm'
import { SqlDatabase } from 'langchain/sql_db'
import { ChatOpenAI } from '@langchain/openai'
import { RunnablePassthrough, RunnableSequence } from '@langchain/core/runnables'
import { PromptTemplate } from '@langchain/core/prompts'
import { StringOutputParser } from '@langchain/core/output_parsers'

import * as dotenv from 'dotenv'
dotenv.config()

const datasource = new DataSource({
    type: 'postgres',
    database: process.env.PGDATABASE
})

const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    includesTables: ['docrecords']
})

async function dbinfo () {
    const schema = await db.getTableInfo()
    console.log(schema)
}
dbinfo()

const prompt =
  PromptTemplate.fromTemplate(`Based on the table schema below, write a SQL query that would answer the user's question:
{schema}
Restrict your answer to those rows with tenantId = "test" only

Question: {question}
SQL Query:`)

const model = new ChatOpenAI({ modelName: process.env.OPENAI_API_MODEL })

// The `RunnablePassthrough.assign()` is used here to passthrough the input from the `.invoke()`
// call (in this example it's the question), along with any inputs passed to the `.assign()` method.
// In this case, we're passing the schema.
const sqlQueryGeneratorChain = RunnableSequence.from([
    RunnablePassthrough.assign({
        schema: async () => db.getTableInfo()
    }),
    prompt,
    model.bind({ stop: ['\nSQLResult:'] }),
    new StringOutputParser()
])

const result = await sqlQueryGeneratorChain.invoke({
    question: 'How many document records are there?'
})

console.log({
    result
})

/*
  {
    result: "SELECT COUNT(EmployeeId) AS TotalEmployees FROM Employee"
  }
*/

const finalResponsePrompt =
  PromptTemplate.fromTemplate(`Based on the table schema below, question, sql query, and sql response, write a natural language response:
{schema}

Question: {question}
SQL Query: {query}
SQL Response: {response}`)

const fullChain = RunnableSequence.from([
    RunnablePassthrough.assign({
        query: sqlQueryGeneratorChain
    }),
    {
        schema: async () => db.getTableInfo(),
        question: (input) => input.question,
        query: (input) => input.query,
        response: (input) => db.run(input.query)
    },
    finalResponsePrompt,
    model
])

const finalResponse = await fullChain.invoke({
    question: 'How many document records are there?'
})

console.log(finalResponse)

/*
  AIMessage {
    content: 'There are 8 employees.',
    additional_kwargs: { function_call: undefined }
  }
*/
