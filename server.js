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

			// generate random namespace for match
			const gameNamespace = uuidv1();
			activeMatches[gameNamespace] = {
				playerOneId: socket.id,
				playerOneName: name,
				playerTwoId: opponentId,
				playerTwoName: opponent['name']
			};

			const nameSpace = io.of(gameNamespace);

			const nameSpaceArea = [];
			nameSpace.on('connection', (socket) => {
				nameSpaceArea.push(socket.id);
				if (nameSpaceArea.length === 2) {
					nameSpace.emit('welcome', gameNamespace);
				}

				socket.on('disconnect', () => {
					nameSpace.emit('user-left', 'A user has left');
					delete io.nsps['/' + gameNamespace];
				});
			});

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
