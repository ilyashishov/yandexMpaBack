var express = require('express');
var expressWs = require('express-ws');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');
var pg = require('pg');
var conString = "postgres://my_app:1234@localhost/my_app";
var uuid = require('node-uuid');
var WebSocketServer = require('ws').Server
, wss = new WebSocketServer({ port: 8080 });
var log = require('./libs/log')(module);
const app  = express();


function makeid(length){
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < length; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}


app.use(session({ secret: 'HIGHLY_SECRET_DATUM', resave: true, saveUninitialized: true }));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/static'));


var wsFunction, wsDBData, wsNewMessage;
const wsConnections = [], messages = [], loginUser= [];
wss.on('connection', function connection(ws) {
    log.info('WebSocket connect');
  wsConnections.push({ws: ws, id: uuid.v4()});

  ws.on('message', function incoming(message) {
    console.log('received: %s', message);
  });
  ws.on('error', function incoming(message) {
    console.log('Error: %s', message);
  });
  ws.on('close', function incoming(message) {
    wsConnections.forEach(function(item, i, arr){
        if(item.ws == ws){
            wsConnections.splice(i, 1);
        }
    })
    console.log('WebSocket close');
  });
  wsFunction = function(a){
    wsConnections.forEach(function(item, i, arr){
        // item.ws.send('{id:' + a.id + ', message: "' + a.mes + '"}');
        item.ws.send(JSON.stringify(a));
    })
  }

  wsNewMessage = function(data){
    messages.push({
        id: data.id,
        text: data.mes
    })
    wsConnections.forEach(function(item, i, arr){
        // item.ws.send('{id:' + a.id + ', message: "' + a.mes + '"}');
        item.ws.send(JSON.stringify(messages));
    })
  }

  wsDBData = function(){
    DbData('SELECT * FROM test', function(data){
        wsConnections.forEach(function(item, i, arr){
            item.ws.send(JSON.stringify(data));
        });
    })
  }

});

function DbData(sql, callback){
    pg.connect(conString, function(err, client, done) {
        if(err) {
            return console.error('error fetching client from pool', err);
        }
        client.query(sql, function(err, result) {
            done();
            if(err) {
                return console.error('error running query', err);
            }
            callback(result.rows)
        });
    });
}



app.get('/ws', function(req, res){
    // wsFunction(req.query);
    // wsDBData();
    wsNewMessage(req.query);
    res.send({ok: true});
})

app.post('/login', function(req, res){
    var code = (Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000);
    log.info(code);
    res.send({ok: true});
    loginUser.push({phoneNumber: req.body.phoneNumber, code: code});
    return;
})

app.post('/login/code', function(req, res){
    var request = false;
    var user = loginUser.filter(function (el) {
        return el.phoneNumber == req.body.phoneNumber && el.code == req.body.code ? true : false;
    });
    if(user.length != 0){
        DbData("SELECT * FROM users WHERE phone = '" + req.body.phoneNumber + "'", function(data){
            if(data.length == 0){
                request = true;
                res.send({ok: true});
            }else{
                var hash = makeid(15);
                DbData("UPDATE users SET token = '"+hash+"' WHERE id = '"+data[0].id+"'", function(data){
                    if(data.length == 0){
                        request = true;
                        res.send({ok: true, hash: hash});
                    }else{
                        request = true;
                        res.send({ok: false });
                    }
                });
            }
        });
    }else{
        res.send({ok: false});
        return;
    }
})

app.post('/registration', function(req, res){
    var hash = makeid(15);
    DbData("INSERT INTO users (phone, last_name, first_name, date_of_birth, token) VALUES ('"+req.body.phoneNumber+"', '"+req.body.lastName+"', '"+req.body.firstName+"', '"+req.body.dateOfBirth+"', '"+hash+"' );", function(data){
        if(data.length == 0){
            res.send({ok: true, hash: hash});
            hash = true;
        }
    });
    if(hash){
        return;
    }
    res.send({ok: false})
})

app.post('/current', function(req, res){
    DbData("SELECT * FROM users WHERE token = '"+req.body.hash+"'", function(data){
        if(data.length != 0){
            res.send({data: data[0], ok: true});
        }else{
            res.send({ok: false});
        }
    });
    return;
})

app.post('/getMessages', function(req, res){
    res.send(messages);
})

app.get('/', function(req, res) {
     res.send('API is running');
})

app.listen(80, '0.0.0.0',  function(){
     log.info('Express server listening on port 8090');
});
