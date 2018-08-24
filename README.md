# Rapid-s3 #
Storage API project - backend file storage build exercise

### Project structure ###
*app.js* - main file to start application.
*public* directory contains files and directory of WPA built with Vue, Vuex, Vuetify in complement project you can to download and rebuild

### Installation ###
To install and run the project you need node.js >= v8.* and mysql DB installed
#### MySQL DB ####
First create DB *rapid_db* on your server. 
Edit file <PROJECT_ROOT>/config/index.js
``` 
connection: {
  host : 'YOUR_DB_HOST',
  user : 'YOUR_DB_USER',
  password : 'YOUR_DB_PAASSWORD',
  database : 'rapidapi_db'
} 
```
To import DB structure and init data (two users) download sql script ``` rapidapi_db_2018-08-24.sql ``` from the project root.<br/>
Then run ``` $ mysqldump -P 3306 -h [YOUR_DB_HOST] -u [YOUR_DB_USER] -p[YOUR_DB_PAASSWORD] rapidapi_db > rapidapi_db_2018-08-24.sql  ```<br/>
To preview DB you can open ``` rapidapi.mwb ``` with MySQL Workbench https://www.mysql.com/products/workbench/
#### Application ####
* Clone the project to your disk ``` git clone git@github.com:Chart3JS/Rapid-s3.git ```
* Run ``` npm install ``` from the project dir
* Start up your server by running ``` npm run start ```. Open your browser on http://localhost:3001
