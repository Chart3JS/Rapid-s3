module.exports = {
	db: {
		client: 'mysql2',
		connection: {
			host : '127.0.0.1',
	    user : 'root',
	    password : 'Ald0n1n!',
	    database : 'rapidapi_db'
		},
		pool: { min: 0, max: 7 }
	},
	api_base_url: '/api/v1/storage'
};