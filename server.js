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
var multer = require('multer');
var storage =   multer.diskStorage({
  destination: function (req, file, callback) {
    callback(null, './uploads');
  },
  filename: function (req, file, callback) {
    callback(null, file.fieldname + '-' + Date.now());
  }
});
var upload = multer({ storage : storage},{limits : {fieldSize : 100000000, fileSize : 100000000}}).single('userPhoto');

var MultiGeocoder = require('multi-geocoder'),
    geocoder = new MultiGeocoder({ provider: 'yandex-cache', coordorder: 'latlong' });
var request = require('request'), cheerio = require('cheerio');
var eventPosition = [];
request({uri:'http://vkevent.ru/city109/', method:'GET', encoding:'utf-8'},
    function (err, res, page) {
        var $=cheerio.load(page);

        $('.event_item').each(function (index, i) {

            if($(i).text().replace(/\s{2,}/g, ' ').length > 2){
                request({uri: $(i).find('.event_page_link').attr('href'), method:'GET', encoding:'utf-8'},
                    function (err, res, page) {
                        var $ = cheerio.load(page);
                        if (true) {
                            var title = $('.info_title').text().replace(/\s{2,}/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '');
                            var img = $('.event_image').attr('src');
                            var address = '';
                            var dateTime = '';
                            var position = $('#map_latlng').text();
                            var description = $('.info_line.status').text().replace(/\s{2,}/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '');
                            $('.info_line').each(function (index, i) {
                                if($(i).text().replace(/\s{2,}/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '').substr(0, 5) == 'Адрес'){
                                    address = $(i).text().replace(/\s{2,}/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '').substr(7);
                                }

                                if($(i).text().replace(/\s{2,}/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '').substr(0, 6) == 'Начало'){
                                    dateTime = $(i).text().replace(/\s{2,}/g, ' ').replace(/\s+$/, '').replace(/^\s+/, '').substr(8);
                                    dateTime = dateTime.substr(0, dateTime.length - 16)
                                }
                            });
                            if(position){
                                DbData('INSERT INTO events (date_time,img,title,description,address,position) VALUES (\''+dateTime+'\',\''+img+'\',\''+title+'\',\''+description+'\',\''+address+'\',array['+position.split(', ').map(Number)+'])', function(data){
                                    if (data.length == 0){
                                        console.log('ok');
                                    }else{
                                        console.log('err');

                                    }
                                });
//                                eventPosition.push({
//                                    dateTime: dateTime,
//                                    img: img,
//                                    title: title,
//                                    description: description,
//                                    address: address,
//                                    position: position.split(', ')
//                                })
                            }
                        }
                    });
            }
        })
    });


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
    wsConnections.forEach(function(item, i, arr){
        item.ws.send(JSON.stringify(data));
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
    return true;
});

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
        return true;
    }
});

app.post('/file/photo/uploaded',function(req,res){
    upload(req,res,function(err) {
        console.log(req.file);
        console.log(err);
        if(err) {
            return res.end("Error uploading file.");
        }
        res.end("File is uploaded");
    });
});

app.post('/user/position/update', function(req, res){
    DbData("UPDATE users SET latitude = "+req.body.latitude+", longitude = "+req.body.longitude+" WHERE token = '"+req.body.hash+"';", function(data){
        if(data.length == 0){
            request = true;
            res.send({ok:true});
        }else{
            request = false;
            res.send({ok:false});
        }
    })
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
        return true;
    }
    res.send({ok: false})
});

app.post('/user/edit', function(req, res){
    DbData("UPDATE users SET last_name = '"+req.body.lastName+"', first_name = '"+req.body.firstName+"' WHERE token = '"+req.body.hash+"';", function(data){
        if(data.length == 0){
            request = true;
            res.send({ok: true});
        }else{
            request = false;
            res.send({ok: false});
        }
    })
})


app.post('/current', function(req, res){
    DbData("SELECT * FROM users WHERE token = '"+req.body.hash+"'", function(data){
        if(data.length != 0){
            res.send({data: data[0], ok: true});
        }else{
            res.send({ok: false});
        }
    });
    return true;
});

app.post('/chats/new', function(req, res){
    var userID, user2ID;
    DbData("SELECT * FROM users WHERE token = '"+req.body.hash+"';", function(data){
        if(data.length != 0){
            userID = data[0].id;
        }else{
            user = false;
            resolve({ok:false});
        }
//        if(userID){
//
//        }
    })
})

app.post('/chats/list', function(req, res){
    var user, user2ID;
    var promise = new Promise(function(resolve, reject){
        DbData("SELECT * FROM users WHERE token = '"+req.body.hash+"'", function(data){
            if(data.length != 0){
                user = data[0];
            }else{
                user = false;
                resolve({ok: false});
            }
            if(user){
                // DbData("SELECT chats.id, chats.name, chats.last_change_date, chats.user_id_1, chats.user_id_2, users.avatar  FROM chats, users WHERE chats.user_id_1 = '"+user.id+"' OR chats.user_id_2 = '"+user.id+"' OR users.id <> '"+user.id+"'", function(data){
                DbData("SELECT c.id, c.name, c.last_change_date, c.user_id_1, c.user_id_2, c.last_message, u.avatar, u.last_name, u.first_name FROM chats c INNER JOIN users u ON (u.id = c.user_id_1 AND c.user_id_1 <> '"+user.id+"') OR (u.id = c.user_id_2 AND c.user_id_2 <> '"+user.id+"')  WHERE c.user_id_1 = '"+user.id+"' OR  c.user_id_2 = '"+user.id+"' ORDER BY last_change_date DESC NULLS LAST ", function(data){
                    if(data.length != 0){
                        resolve({ok: true, chats: data});
                    }else{
                        resolve({ok: false, chats: []});
                    }
                });
            }
        });
    });

    promise.then(
        function(result){
            res.send(result);
        }
    );
    return true;
});

app.post('/chat/messages', function(req, res){
    var promise = new Promise(function(resolve, reject){
        DbData("SELECT * FROM messages WHERE chat_id = '"+req.body.chat_id+"'", function(data){
            if(data.length != 0){
                resolve({ok: true, messages: data});
            }else{
                resolve({ok: false, messages: []});
            }
        });
    });

    promise.then(
        function(result){
            res.send(result);
        }
    );
    return true;
});

app.post('/chat/message/new', function(req, res){
    var promise = new Promise(function(resolve, reject){
        DbData("INSERT INTO messages (chat_id, user_id, text, date) VALUES ("+req.body.chat_id+", "+req.body.user_id+", '"+req.body.text+"', '"+req.body.date+"')", function(data){
            if(data.length != 0){
                resolve({ok: true});
            }else{
                resolve({ok: false});
            }
        });
        var lsatMassage = req.body.text.substr(0, 25);
        if(req.body.text.length > 25) {
            lsatMassage += '...'
        }
        DbData("UPDATE chats SET last_message = '"+lsatMassage+"', last_change_date = '"+req.body.date+"' WHERE id = '"+req.body.chat_id+"'", function () {
            
        });
    });

    promise.then(
        function(result){
            wsNewMessage(req.body);
            res.send(result);
        }
    );
    return true;
});

app.get('/events', function(req, res){
    res.send(eventPosition);
    return true;
});

app.post('/events/player/new',function(req, res){
    var players = [];

    DbData("SELECT players FROM events WHERE id = "+req.body.id+";",function(data){
        if(data.length !=0){
            players.slice(data[0]);
        }else{
            console.log('ne poshlo')
        }
        if(players.length != 0){

        }
    })
})

app.get('/users', function(req,res){
    var userID
    console.log(req.body)

    DbData("SELECT id FROM users WHERE token = '"+req.body.hash+"';",function(data){
        if(data.length != 0){
            userID = data[0];
             DbData("SELECT * FROM users",function(data){
                    if(data.length != 0){
                        data.forEach(function(index,i){
                        DbData("SELECT * FROM chats WHERE (user_id_1 = "+userID+"AND user_id_2 = "+i.id+") OR (user_id_1 = "+i.id+"AND user_id_2 = "+userID+")",function(data){
                            console.log(1);
                        })
                        if(data.length == index+1){
                            res.send(data);
                        }
                        })
                        console.log(2)
                    }else{
                        res.send({ok:false});
                    }
                });
        }else{
            res.send({ok:false});
        }

    })
})

app.get('/getAddress', function (req, res) {
    geocoder.geocode([req.query.latitude + ',' + req.query.longitude])
        .then(function (res1) {
            res.send(res1.result.features[0].properties.name)
        });
})



app.post('/getMessages', function(req, res){
    res.send(messages);
});

app.get('/', function(req, res) {
     res.send('API is running');
});

app.listen(80, '0.0.0.0',  function(){
     log.info('Express server listening on port 8090');
});

app.use(express.static('public'));
