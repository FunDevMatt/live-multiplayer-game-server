let app = require('express')();
let server = require('http').Server(app);
let io = require('socket.io')(server);

server.listen(3500);

let searchingPool = {};

io.on('connection', (socket) => {
	// player starts looking for opponent
	socket.on('game-searching', (name) => {
		// check if there are any opponents waiting in the search pool
		let opponentAvailable = Object.entries(searchingPool).length > 0;

		// if there is a player waiting, match with that player
		if (opponentAvailable) {
			let opponentId = Object.keys(searchingPool)[0];
			let opponent = searchingPool[opponentId];

			socket.emit('opponent-found', {
				socketId: opponentId,
				name: opponent.name
			});

			// remove the matched player out of the search pool
			delete searchingPool[opponentId];

			// let player who was waiting in pool know they have been matched
			socket.to(opponentId).emit('opponent-found', {
				socketId: socket.id,
				name: name
			});

			// if there are no players waiting in pool, place the player searching in the pool
		} else {
			searchingPool[socket.id] = {
				name: name
			};
		}
	});

	socket.on('disconnect', () => {
		delete searchingPool[socket.id];
	});
});
