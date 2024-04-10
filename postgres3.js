// https://js.langchain.com/docs/integrations/toolkits/sql
import { DataSource } from 'typeorm'
import { SqlDatabase } from 'langchain/sql_db'
import { OpenAI } from '@langchain/openai'
import { createSqlAgent, SqlToolkit } from 'langchain/agents/toolkits/sql'

import * as dotenv from 'dotenv'
dotenv.config()

const datasource = new DataSource({
    type: 'postgres',
    database: process.env.PGDATABASE
})

const db = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource
})

const model = new OpenAI({ modelName: process.env.OPENAI_API_MODEL, temperature: 0 })

const toolkit = new SqlToolkit(db, model)
const executor = createSqlAgent(model, toolkit)

const input = 'How many documents are there?'

console.log(`Executing with input "${input}"...`)

const result = await executor.invoke({ input })

console.log(`Got output ${result.output}`)

console.log(
    `Got intermediate steps ${JSON.stringify(
        result.intermediateSteps,
        null,
        2
    )}`
)

await datasource.destroy()
