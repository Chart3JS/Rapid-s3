module.exports = {
	db: {
		client: 'mysql2',
		connection: {
			host : 'DB_HOST',
	    user : 'YOU_DB_USER',
	    password : 'YOUR_DB_PASSWORD',
	    database : 'rapidapi_db'
		},
		pool: { min: 0, max: 7 }
	},
	api_base_url: '/api/v1/storage'
};
