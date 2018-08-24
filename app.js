var express = require('express');
var bodyParser =  require('body-parser');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
var config = require('./config/');
// import StorageAPI with relative to /api/v1/storage http entry points
const StorageAPI = require('./api/StorageAPI');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(logger('dev'));
app.use(express.static(path.join(__dirname, 'public')));

// register Storage API routes
app.use(config.api_base_url, StorageAPI);
module.exports = app;
