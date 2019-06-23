let app = require('express')();
let server = require('http').Server(app);
let io = require('socket.io')(server);
const uuidv1 = require('uuid/v1');

server.listen(3500);

let searchingPool = {};
let activeMatches = {};

io.on('connection', (socket) => {
	// player starts looking for opponent
	socket.on('game-searching', (name) => {
		// check if there are any opponents waiting in the search pool
		let opponentAvailable = Object.entries(searchingPool).length > 0;

		// if there is a player waiting, match with that player
		if (opponentAvailable) {
			let opponentId = Object.keys(searchingPool)[0];
			let opponent = searchingPool[opponentId];

			// generate random namespace name for match
			const gameNamespace = uuidv1();

			socket.emit('opponent-found', {
				socketId: opponentId,
				name: opponent.name,
				nameSpace: '/' + gameNamespace
			});

			// remove the matched player out of the search pool
			delete searchingPool[opponentId];

			// let player who was waiting in pool know they have been matched
			socket.to(opponentId).emit('opponent-found', {
				socketId: socket.id,
				name: name,
				nameSpace: '/' + gameNamespace
			});

			// create a namespace for match
			const nameSpace = io.of(gameNamespace);

			let activeMatches = {};
			activeMatches[gameNamespace] = {};

			nameSpace.on('connection', (nspSocket) => {
				// Make sure both users have loaded correctly
				nspSocket.on('user-ready', (name) => {
					activeMatches[gameNamespace][nspSocket.id] = name;
					if (Object.entries(activeMatches[gameNamespace]).length === 2) {
						let opponentName = '';
						for (let player in activeMatches[gameNamespace]) {
							if (player !== nspSocket.id) {
								opponentName = activeMatches[gameNamespace][player];
							}
						}
						nspSocket.to(nspSocket.id).emit('match-info', {
							username: activeMatches[gameNamespace][nspSocket.id],
							opponentUsername: opponentName
						});
					}
				});

				nspSocket.on('disconnect', () => {
					nameSpace.emit('user-left', 'A user has left');
					delete activeMatches[gameNamespace];
					delete io.nsps['/' + gameNamespace];
				});
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
