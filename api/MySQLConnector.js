
function MySQLConnector (dbConnectionConfig) {
	this.getConnection = () => {
		return require('knex')({
      client: dbConnectionConfig.client,
      connection: dbConnectionConfig.connection,
      pool: dbConnectionConfig.pool
    });
	}
	return this;
}

module.exports = MySQLConnector;