// see first example here: https://api.js.langchain.com/classes/langchain_chains_sql_db.SqlDatabaseChain.html
import { DataSource } from 'typeorm'
import { OpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { SqlDatabase } from 'langchain/sql_db'
import { SqlDatabaseChain } from 'langchain/chains/sql_db'

import * as dotenv from 'dotenv'
dotenv.config()

const llm = new OpenAI({ modelName: process.env.OPENAI_API_MODEL, temperature: 0 })
const datasource = new DataSource({
    type: 'postgres',
    database: process.env.PGDATABASE
})
const database = await SqlDatabase.fromDataSourceParams({
    appDataSource: datasource,
    includesTables: ['docrecords']
})

// based on SQL_POSTGRES_PROMPT in langchain/src/chains/sql_db/sql_db_prompt.ts:26
const prompt = new PromptTemplate({
    template: `You are a PostgreSQL expert. Given an input question, first create a syntactically correct PostgreSQL query to run, then look at the results of the query and return the answer to the input question.
Unless the user specifies in the question a specific number of examples to obtain, query for at most {top_k} results using the LIMIT clause as per PostgreSQL. You can order the results to return the most informative data in the database.
Never query for all columns from a table. You must query only the columns that are needed to answer the question. Wrap each column name in double quotes (") to denote them as delimited identifiers.
Pay attention to use only the column names you can see in the tables below. Be careful to not query for columns that do not exist. Also, pay attention to which column is in which table.
  
Use the following format:
  
Question: "Question here"
SQLQuery: "SQL Query to run"
SQLResult: "Result of the SQLQuery"
Answer: "Final answer here"
  
Only use the following tables:
{table_info}

Restrict your answer to those rows with tenantId = "test" only
  
Question: {input}`,
    inputVariables: ['dialect', 'table_info', 'input', 'top_k']
})

const chain = new SqlDatabaseChain({
    llm,
    database,
    prompt
})
const res = await chain.invoke({ query: 'How many documents are there?' })
console.log('Result:', res.result)

await datasource.destroy()
