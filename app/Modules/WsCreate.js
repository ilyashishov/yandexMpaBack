var createWs = function(port, idClient){
	var WebSocketServer = require('ws').Server
	, wss = new WebSocketServer({ port: port });
	var log = require('../../libs/log')(module);

	const wsConnections = [];

	wss.on('connection', function connection(ws) {
		log.info('WebSocket connect');
		wsConnections.push({ws: ws, id: idClient});
		// ws.on('message', function incoming(message) {
		// 	console.log('received: %s', message);
		// });
		ws.on('close', function incoming(message) {
			wsConnections.forEach(function(item, i, arr){
				if(item.ws == ws){
					wsConnections.splice(i, 1);
				}
			})
			console.log('WebSocket close');
		});

		return wsFunction = function(a){
			wsConnections.forEach(function(item, i, arr){
				item.ws.send('{id:' + a.id + ', message: "' + a.mes + '"}');
			})
		}
	});
}

module.exports = createWs;