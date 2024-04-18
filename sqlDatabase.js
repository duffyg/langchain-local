const formatToSqlTable = (rawResultsTableAndColumn) => {
    const sqlTable = []
    for (const oneResult of rawResultsTableAndColumn) {
        const sqlColumn = {
            columnName: oneResult.column_name,
            dataType: oneResult.data_type,
            isNullable: oneResult.is_nullable === 'YES'
        }
        const currentTable = sqlTable.find((oneTable) => oneTable.tableName === oneResult.table_name)
        if (currentTable) {
            currentTable.columns.push(sqlColumn)
        }
        else {
            const newTable = {
                tableName: oneResult.table_name,
                columns: [sqlColumn]
            }
            sqlTable.push(newTable)
        }
    }
    return sqlTable
}
const formatSqlResponseToSimpleTableString = (rawResult) => {
    if (!rawResult || !Array.isArray(rawResult) || rawResult.length === 0) {
        return ''
    }
    let globalString = ''
    for (const oneRow of rawResult) {
        globalString += `${Object.values(oneRow).reduce((completeString, columnValue) => `${completeString} ${columnValue}`, '')}\n`
    }
    return globalString
}
const getTableAndColumnsName = async (dataSource) => {
    let sql
    if (dataSource.options.type === 'postgres') {
        const schema = dataSource.options?.schema ?? 'public'
        sql = `SELECT 
          t.table_name, 
          c.* 
        FROM 
          information_schema.tables t 
            JOIN information_schema.columns c 
              ON t.table_name = c.table_name 
        WHERE 
          t.table_schema = '${schema}' 
            AND c.table_schema = '${schema}' 
        ORDER BY 
          t.table_name,
          c.ordinal_position;`
        const rep = await dataSource.query(sql)
        return formatToSqlTable(rep)
    }
}
const generateTableInfoFromTables = async (tables, dataSource, nbSampleRow, customDescription) => {
    if (!tables) {
        return ''
    }
    let globalString = ''
    for (const currentTable of tables) {
        // Add the custom info of the table
        const tableCustomDescription = customDescription &&
          Object.keys(customDescription).includes(currentTable.tableName)
            ? `${customDescription[currentTable.tableName]}\n`
            : ''
        // Add the creation of the table in SQL
        let schema = null
        if (dataSource.options.type === 'postgres') {
            schema = dataSource.options?.schema ?? 'public'
        }
        else if (dataSource.options.type === 'mssql') {
            schema = dataSource.options?.schema
        }
        else if (dataSource.options.type === 'sap') {
            schema =
              dataSource.options?.schema ??
                  dataSource.options?.username ??
                  'public'
        }
        else if (dataSource.options.type === 'oracle') {
            schema = dataSource.options.schema
        }
        let sqlCreateTableQuery = schema
            ? `CREATE TABLE "${schema}"."${currentTable.tableName}" (\n`
            : `CREATE TABLE ${currentTable.tableName} (\n`
        for (const [key, currentColumn] of currentTable.columns.entries()) {
            if (key > 0) {
                sqlCreateTableQuery += ', '
            }
            sqlCreateTableQuery += `${currentColumn.columnName} ${currentColumn.dataType} ${currentColumn.isNullable ? '' : 'NOT NULL'}`
        }
        sqlCreateTableQuery += ') \n'
        let sqlSelectInfoQuery
        if (dataSource.options.type === 'postgres') {
            const schema = dataSource.options?.schema ?? 'public'
            sqlSelectInfoQuery = `SELECT * FROM "${schema}"."${currentTable.tableName}" LIMIT ${nbSampleRow};\n`
        }
        const columnNamesConcatString = `${currentTable.columns.reduce((completeString, column) => `${completeString} ${column.columnName}`, '')}\n`
        let sample = ''
        try {
            const infoObjectResult = nbSampleRow
                ? await dataSource.query(sqlSelectInfoQuery)
                : null
            sample = formatSqlResponseToSimpleTableString(infoObjectResult)
        }
        catch (error) {
            // If the request fails we catch it and only display a log message
            console.log(error)
        }
        globalString = globalString.concat(tableCustomDescription +
          sqlCreateTableQuery +
          sqlSelectInfoQuery +
          columnNamesConcatString +
          sample)
    }
    return globalString
}
export default class SqlDatabase {
    constructor (fields) {
        this.dataSource = fields.dataSource
        this.dataSourceOptions = fields.dataSource.options
        if (fields?.includeTables && fields?.ignoreTables) {
            throw new Error('Cannot specify both includeTables and ignoreTables')
        }
        this.includeTables = fields?.includeTables ?? []
        this.ignoreTables = fields?.ignoreTables ?? []
        this.sampleRowsInTableInfo = fields?.sampleRowsInTableInfo ?? 3
    }

    async init () {
        this.allTables = await getTableAndColumnsName(this.dataSource)
    }

    async getTableInfo () {
        let selectedTables = this.includeTables.length > 0
            ? this.allTables.filter((e) => this.includeTables.includes(e.tableName))
            : this.allTables
        if (this.ignoreTables.length > 0) {
            selectedTables = selectedTables.filter((e) => !this.ignoreTables.includes(e.tableName))
        }
        const customDescription = null
        return await generateTableInfoFromTables(selectedTables, this.dataSource, this.sampleRowsInTableInfo, customDescription)
    }

    async run (command, fetch = 'all') {
        const result = await this.dataSource.query(command)
        if (fetch === 'all') {
            return JSON.stringify(result)
        }
        if (result.length > 0) {
            return JSON.stringify(result[0])
        }
        return ''
    }
}
