import { DataSource } from 'typeorm'
import OpenAI from './openai.js'
import SqlDatabase from './sqlDatabase.js'

import * as dotenv from 'dotenv'
dotenv.config()

async function main (question) {
    const dataSource = new DataSource({
        type: 'postgres',
        database: process.env.PGDATABASE
    })
    await dataSource.driver.connect()
    const db = new SqlDatabase({
        dataSource,
        includeTables: ['docrecords']
    })
    await db.init()
    const schema = await db.getTableInfo()
    console.log(schema)

    let prompt =
        `Based on the table schema below, write a SQL query that would answer the user's question:
  ${schema}
  Restrict your answer to those rows with tenantId = "test" only
  
  Question: ${question}
  SQL Query:`

    let messages = [{ role: 'user', content: prompt }]
    const openai = new OpenAI()
    const query = await openai.chat(messages, { stop: ['\nSQLResult:\n'] })
    console.log(query)
    const response = await db.run(query)
    console.log(response)

    prompt =
        `Based on the table schema below, question, sql query, and sql response, write a natural language response:
  ${schema}
  Don't mention tenant or tenantId in your response
  
  Question: ${question}
  SQL Query: ${query}
  SQL Response: ${response}`

    messages = [{ role: 'user', content: prompt }]
    const answer = await openai.chat(messages)
    console.log(answer)
}
main('How many document records are there?')
