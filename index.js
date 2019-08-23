/*Modules to load*/
var http = require('http');
var express = require("express");
var app     = express();
var path    = require("path");
var mysql   = require('mysql');

app.all('/', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    next();
});

/*Load config parameters*/
var config = require('./setup/config');
var request = require('request');
var multer = require('multer');
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(express.static(__dirname + '/public')); 

var $users                  = [];
var $users_details          = [];

var $debug                  = true;

/** DB connection with mysql database **/
var connection = mysql.createConnection({
    host    : config.DB_host,
    user    : config.DB_user,
    password: config.DB_password,
    database: config.DB_database,
});

connection.connect(function(err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
});

/*Create Server*/
var server = http.createServer(app).listen(config.port, function(err) {
  if (err) {
    console.log(err);
  } else {
    const host = server.address().address;
    const port = server.address().port;
    console.log(`Server listening on ${host}:${port}`);
  }
});

app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

app.post('/', function(req, res){

    var findSQL = 'SELECT * FROM users WHERE email="'+req.body.email+'"';
    connection.query(findSQL, function(err, response){
        if(err)
        {
            var json_arr  = {
                data    : response,
                status  : 'fail',
                message : 'Query Exception: ' + err
            };
            
            res.contentType('application/json');
            res.end(JSON.stringify(json_arr));
        }
        else if(response.length > 0)
        {
            var json_arr  = {
                data    : response,
                status  : 'success',
                message : 'User Found.'
            };
            
            res.contentType('application/json');
            res.end(JSON.stringify(json_arr));
        }
        else
        {
            var json_arr  = {
                data    : response,
                status  : 'fail',
                message : 'No User Found.'
            };
            
            res.contentType('application/json');
            res.end(JSON.stringify(json_arr));
        }
    });
});

app.get('/chatboard', function(req, res){
    console.log(req.query.user_id);
    res.sendFile(__dirname + '/chatboard.html', { title: 'The index page!' });
});

var io = require('socket.io').listen(server);

io.on('connection', function(socket){
    console.log('got connected.');
    /*Load all socket files*/
    require('./route/chat')(io,app, connection,socket,config,bodyParser,$users,$users_details,$debug,request);
});