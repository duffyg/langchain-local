// loads postgres with docRecords table from mongodb
import { MongoClient } from 'mongodb'
import pg from 'pg'

import * as dotenv from 'dotenv'
dotenv.config()

export const run = async (params) => {
    const { Client } = pg
    const pgClient = new Client() // use env variables
    await pgClient.connect()
    const mongoClient = new MongoClient(process.env.MONGODB_URL)
    console.log('ok', process.env.MONGODB_URL)
    await mongoClient.connect()
    const mongodb = mongoClient.db('quality-records-apps')
    const docRecordsFile = mongodb.collection('docRecords')
    let result

    const dropTable = 'DROP TABLE docRecords'
    result = await pgClient.query(dropTable)
    console.log(result)

    // result = await pgClient.query('SELECT $1::text as message', ['Hello world!'])
    // console.log(result.rows[0].message) // Hello world!
    const createTable = `CREATE TABLE IF NOT EXISTS docRecords(
    tenantId TEXT,
    docRecordId TEXT,
    docRecordVersion INTEGER,
    docRecordStatus TEXT,
    docRecordDesc TEXT,
    appId TEXT,
    workflow TEXT,
    narrative TEXT,
    reviewers TEXT[],
    approvers TEXT[],
    addDate TIMESTAMPTZ,
    addUser TEXT,
    addUserId TEXT,
    changeDate TIMESTAMPTZ,
    changeUser TEXT,
    changeUserId TEXT,
    deleteDate TIMESTAMPTZ,
    deleteUser TEXT,
    deleteUserId TEXT,
    lockDate TIMESTAMPTZ,
    lockDateFirst TIMESTAMPTZ,
    lockUser TEXT,
    lockUserId TEXT,
    activeDate TIMESTAMPTZ,
    activeUser TEXT,
    activeUserId TEXT,
    archiveDate TIMESTAMPTZ,
    archiveUser TEXT,
    archiveUserId TEXT,
    PRIMARY KEY(tenantId, docRecordId, docRecordVersion)
    )`
    result = await pgClient.query(createTable)
    console.log(result)

    const insertRecord = `INSERT INTO docRecords(
        tenantId,
        docRecordId,
        docRecordVersion,
        docRecordStatus,
        docRecordDesc,
        appId,
        workflow,
        narrative,
        reviewers,
        approvers,
        addDate,
        addUser,
        addUserId,
        changeDate,
        changeUser,
        changeUserId,
        deleteDate,
        deleteUser,
        deleteUserId,
        lockDate,
        lockDateFirst,
        lockUser,
        lockUserId,
        activeDate,
        activeUser,
        activeUserId,
        archiveDate,
        archiveUser,
        archiveUserId
    ) VALUES(
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,
        $21,$22,$23,$24,$25,$26,$27,$28,$29)`

    const records = await docRecordsFile.find({}).toArray()
    for (const e of records) {
        const values = [
            e.tenantId,
            e.docRecordId,
            e.docRecordVersion,
            e.docRecordStatus,
            e.docRecordDesc,
            e.appId,
            e.workflow,
            e.narrative,
            e.reviewers,
            e.approvers,
            e.addDate,
            e.addUser,
            e.addUserId,
            e.changeDate,
            e.changeUser,
            e.changeUserId,
            e.deleteDate,
            e.deleteUser,
            e.deleteUserId,
            e.lockDate,
            e.lockDateFirst,
            e.lockUser,
            e.lockUserId,
            e.activeDate,
            e.activeUser,
            e.activeUserId,
            e.archiveDate,
            e.archiveUser,
            e.archiveUserId
        ]
        await pgClient.query(insertRecord, values)
    }

    await pgClient.end()
    await mongoClient.close()
}
run([''])
