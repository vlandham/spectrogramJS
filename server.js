const express = require('express');
var bodyParser = require('body-parser')

var session = require('express-session')

const app = express();
const path = require('path');


var db = require("./database.js")

const fs = require('fs')
const http = require('http')
const https = require('https')

const credentials = {
  key: fs.readFileSync('./security/key.pem'),
  cert: fs.readFileSync('./security/cert.pem'),
  // host: 8443,
  requestCert: false,
  rejectUnauthorized: false
}

const httpPort = 3000;
const httpsPort = 443;

app.use(session({
	secret: 'secret',
	resave: true,
	saveUninitialized: true
}));

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json())

app.use('/', express.static(path.join(__dirname, 'public')))

// app.get('/', (req, res) => {
//   res.redirect('/static/spectrogram.html');
// });

app.all("/database",function(req,res){
  var sql = "select * from audio_config"
  var params = []
  db.all(sql, params, (err, rows) => {
    if (err) {
      res.status(400).json({"error":err.message});
      return;
    }
    res.json({
        "message": "success",
        "data": rows
    })
  });
});

app.all("/getfilelist",function(req,res){
  console.log(req.session.userid, req.session.username)
  db.all('select * from audio_config where user_id = ?', [req.session.userid], (err, rows) => {
    console.log(rows)
    if (err) {
      res.status(400).json({"error":err.message});
      return;
    }
    res.json({
        "message": "success",
        "data": rows
    })
  });
});

app.get('/', function(req, res) {
	res.redirect('/login.html');
});


app.post('/auth', function(req, res) {
	var username = req.body.username;
  var password = req.body.password;
	if (username && password) {
		db.all('SELECT * FROM user_accounts WHERE Username = ? AND Password = ?', [username, password], function(error, results, fields) {

			if (results.length > 0) {
				req.session.loggedin = true;
        req.session.username = username;
        // console.log(results[0]);
        // console.log(results[0]['ID']);
        req.session.userid = results[0]['ID'];
				res.redirect('/directory.html');
			} else {
				res.send('Incorrect Username and/or Password!');
			}			
			res.end();
		});
	} else {
		res.send('Please enter Username and Password!');
		res.end();
	}
});

app.get("/file", function(req,res){
  if (req.session.loggedin && req.query) {
    // console.log(req.session.username + "/" + req.query.file)
    res.sendFile(path.join(__dirname, "file/" + req.session.username + "/" + req.query.file))
	} else {
    res.status(401)
		// res.redirect('login.html');
	}
});




// app.listen(PORT, HOST, () => console.log(`Server listening on port: ${PORT}`));

// var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

// httpServer.listen(httpPort, "192.168.1.166", () => {
//   console.log("Http server listing on port : " + httpPort)
// });

httpsServer.listen(httpsPort, "localhost", () => {
  console.log("Https server listing on port : " + httpsPort)
});